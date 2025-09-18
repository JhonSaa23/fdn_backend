const express = require('express');
const { getConnection } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

console.log('🔍 [LETRAS] Rutas de letras cargadas correctamente');

// Obtener letras del vendedor actual
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [LETRAS] Petición recibida:', req.url, 'User:', req.user);
    const pool = await getConnection();
    const codigoInterno = req.user.CodigoInterno;
    
    const result = await pool.request()
      .input('CodigoInterno', codigoInterno)
      .execute('sp_LetrasPorVendedor');
    
    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (error) {
    console.error('❌ [LETRAS] Error obteniendo letras:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener letras de cambio',
      details: error.message
    });
  }
});

// Obtener estadísticas de letras del vendedor
router.get('/estadisticas', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const codigoInterno = req.user.CodigoInterno;
    
    const result = await pool.request()
      .input('CodigoInterno', codigoInterno)
      .execute('sp_EstadisticasLetrasVendedor');
    
    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0]
      });
    } else {
      res.json({
        success: true,
        data: {
          TotalLetras: 0,
          LetrasPendientes: 0,
          LetrasPagadas: 0,
          LetrasVencidas: 0,
          MontoTotal: 0,
          MontoPagado: 0,
          SaldoTotal: 0,
          PromedioDiasPlazo: 0
        }
      });
    }
  } catch (error) {
    console.error('❌ [LETRAS-STATS] Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de letras',
      details: error.message
    });
  }
});

// Obtener estadísticas de letras con filtros por fechas
router.get('/estadisticas/filtradas', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const codigoInterno = req.user.CodigoInterno;
    const { fechaInicio, fechaFin, estado } = req.query;
    
    const result = await pool.request()
      .input('CodigoInterno', codigoInterno)
      .input('FechaInicio', fechaInicio || null)
      .input('FechaFin', fechaFin || null)
      .input('Estado', estado ? parseInt(estado) : null)
      .execute('sp_EstadisticasLetrasVendedorFiltradas');
    
    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0],
        filtros: {
          fechaInicio,
          fechaFin,
          estado
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          TotalLetras: 0,
          LetrasPendientes: 0,
          LetrasPagadas: 0,
          LetrasVencidas: 0,
          MontoTotal: 0,
          MontoPagado: 0,
          SaldoTotal: 0,
          PromedioDiasPlazo: 0,
          FechaInicioMasAntigua: null,
          FechaVencimientoMasReciente: null
        },
        filtros: {
          fechaInicio,
          fechaFin,
          estado
        }
      });
    }
  } catch (error) {
    console.error('❌ [LETRAS-STATS-FILTER] Error obteniendo estadísticas filtradas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas filtradas de letras',
      details: error.message
    });
  }
});

// Obtener letras con filtros usando el nuevo procedimiento
router.get('/filtradas', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const codigoInterno = req.user.CodigoInterno;
    const { estado, fechaInicio, fechaFin, cliente } = req.query;
    
    const result = await pool.request()
      .input('CodigoInterno', codigoInterno)
      .input('FechaInicio', fechaInicio || null)
      .input('FechaFin', fechaFin || null)
      .input('Estado', estado ? parseInt(estado) : null)
      .input('Cliente', cliente || null)
      .execute('sp_LetrasPorVendedorFiltradas');
    
    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
      filtros: {
        estado,
        fechaInicio,
        fechaFin,
        cliente
      }
    });
  } catch (error) {
    console.error('❌ [LETRAS-FILTER] Error filtrando letras:', error);
    res.status(500).json({
      success: false,
      error: 'Error al filtrar letras de cambio',
      details: error.message
    });
  }
});

// Obtener detalles de una letra específica
router.get('/:numero', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const codigoInterno = req.user.CodigoInterno;
    const numero = req.params.numero;
    
    const result = await pool.request()
      .input('CodigoInterno', codigoInterno)
      .input('Numero', numero)
      .query(`
        SELECT * FROM VistaLetrasVendedor 
        WHERE Vendedor = @CodigoInterno AND Numero = @Numero
      `);
    
    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0]
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Letra no encontrada'
      });
    }
  } catch (error) {
    console.error('❌ [LETRAS-DETAIL] Error obteniendo detalle de letra:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener detalle de la letra',
      details: error.message
    });
  }
});

module.exports = router;
