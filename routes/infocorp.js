const express = require('express');
const multer = require('multer');
const sql = require('mssql');
const { getConnection } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configuración de multer para archivos PDF
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  }
});

// ===== GET: Obtener todos los clientes activos con paginación =====
router.get('/clientes', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Parámetros de paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;
    const offset = (page - 1) * limit;
    
    // Parámetros de filtro
    const search = req.query.search || '';
    
    // Construir WHERE clause para búsqueda
    let whereClause = "WHERE c.activo = '1'";
    if (search) {
      whereClause += ` AND (
        c.Razon LIKE '%${search}%' OR 
        c.Documento LIKE '%${search}%' OR 
        c.CodClie LIKE '%${search}%'
      )`;
    }
    
    // Query para obtener el total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM clientes c
      ${whereClause}
    `;
    
    const countResult = await pool.request().query(countQuery);
    const total = countResult.recordset[0].total;
    
    // Query principal con paginación
    const query = `
      SELECT 
        c.codclie, c.tipoDoc, c.Documento as documento, c.Razon as razon, c.Direccion as direccion, c.Celular as celular, 
        c.zona, c.TipoNeg as tipoNeg, c.TipoClie as tipoClie, c.Vendedor as vendedor, c.Limite as limite,
        CASE WHEN ci.ArchivoPDF IS NOT NULL THEN 'uploads/infocorp/infocorp-' + c.Documento + '.pdf' ELSE NULL END as rutaReporte,
        ci.FechaActualizacion as fechaReporte
      FROM clientes c
      LEFT JOIN ClientesInfocorp ci ON c.Documento = ci.Documento
      ${whereClause}
      ORDER BY c.Razon
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
    
    const result = await pool.request().query(query);
    
    // Calcular información de paginación
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;
    
    res.json({
      success: true,
      data: result.recordset,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasMore
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo clientes',
      error: error.message
    });
  }
});

// ===== GET: Obtener reporte de un cliente (público para visualización) =====
router.get('/reporte/:documento', async (req, res) => {
  try {
    const { documento } = req.params;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('documento', sql.VarChar(20), documento)
      .execute('sp_ObtenerReporteCliente');
    
    if (result.recordset.length > 0) {
      const reporte = result.recordset[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${reporte.NombreArchivo}"`);
      res.send(reporte.ArchivoPDF);
    } else {
      res.status(404).json({
        success: false,
        message: 'No se encontró reporte para este cliente'
      });
    }
    
  } catch (error) {
    console.error('Error obteniendo reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo reporte',
      error: error.message
    });
  }
});

// ===== POST: Subir/actualizar reporte de cliente =====
router.post('/upload/:documento', upload.single('reporte'), async (req, res) => {
  try {
    const { documento } = req.params;
    const { subidoPor } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó archivo PDF'
      });
    }
    
    const pool = await getConnection();
    
    await pool.request()
      .input('documento', sql.VarChar(20), documento)
      .input('archivoPDF', sql.VarBinary, req.file.buffer)
      .input('nombreArchivo', sql.VarChar(255), req.file.originalname)
      .input('subidoPor', sql.VarChar(50), subidoPor || 'Sistema')
      .execute('sp_GuardarReporteCliente');
    
    res.json({
      success: true,
      message: 'Reporte guardado exitosamente'
    });
    
  } catch (error) {
    console.error('Error guardando reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error guardando reporte',
      error: error.message
    });
  }
});

// ===== DELETE: Eliminar reporte de cliente =====
router.delete('/reporte/:documento', async (req, res) => {
  try {
    const { documento } = req.params;
    const pool = await getConnection();
    
    await pool.request()
      .input('documento', sql.VarChar(20), documento)
      .execute('sp_EliminarReporteCliente');
    
    res.json({
      success: true,
      message: 'Reporte eliminado exitosamente'
    });
    
  } catch (error) {
    console.error('Error eliminando reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando reporte',
      error: error.message
    });
  }
});

// ===== GET: Verificar si existe reporte =====
router.get('/reporte-existe/:documento', async (req, res) => {
  try {
    const { documento } = req.params;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('documento', sql.VarChar(20), documento)
      .execute('sp_ObtenerReporteCliente');
    
    res.json({
      success: true,
      existe: result.recordset.length > 0,
      fechaActualizacion: result.recordset.length > 0 ? result.recordset[0].FechaActualizacion : null
    });
    
  } catch (error) {
    console.error('Error verificando reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando reporte',
      error: error.message
    });
  }
});

module.exports = router;
