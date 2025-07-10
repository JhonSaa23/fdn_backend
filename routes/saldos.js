const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const ExcelJS = require('exceljs');

// Obtener saldos con filtro por código de producto (primeros 2 dígitos)
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Obtener parámetros de filtro
    const { codigoProducto = '00' } = req.query;

    const query = `
      SELECT TOP 20
        s.codpro,
        p.Nombre AS NombreProducto,
        s.almacen,
        s.lote,
        s.vencimiento,
        s.saldo,
        s.protocolo
      FROM dbo.Saldos AS s 
      INNER JOIN dbo.Productos AS p ON s.codpro = p.CodPro
      WHERE LEFT(s.codpro, 2) = @codigoProducto
      ORDER BY s.codpro, s.almacen, s.lote
    `;

    const result = await pool.request()
      .input('codigoProducto', codigoProducto)
      .query(query);

    res.json({
      success: true,
      data: result.recordset,
      filtros: {
        codigoProducto
      }
    });

  } catch (error) {
    console.error('Error al obtener saldos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los saldos',
      details: error.message
    });
  }
});

// Nueva exportación real a Excel
router.get('/export', async (req, res) => {
  try {
    const pool = await getConnection();
    const { codigoProducto = '00' } = req.query;

    const query = `
      SELECT 
        s.codpro,
        p.Nombre AS NombreProducto,
        s.almacen,
        s.lote,
        s.vencimiento,
        s.saldo,
        s.protocolo
      FROM dbo.Saldos AS s 
      INNER JOIN dbo.Productos AS p ON s.codpro = p.CodPro
      WHERE LEFT(s.codpro, 2) = @codigoProducto
      ORDER BY s.codpro, s.almacen, s.lote
    `;

    const result = await pool.request()
      .input('codigoProducto', codigoProducto)
      .query(query);

    // Crear workbook y worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Saldos');

    // Definir columnas
    worksheet.columns = [
      { header: 'CodPro', key: 'codpro', width: 12 },
      { header: 'Nombre', key: 'NombreProducto', width: 40 },
      { header: 'Almacen', key: 'almacen', width: 10 },
      { header: 'Lote', key: 'lote', width: 18 },
      { header: 'Vencimiento', key: 'vencimiento', width: 20 },
      { header: 'Saldo', key: 'saldo', width: 12 },
      { header: 'Protocolo', key: 'protocolo', width: 15 }
    ];

    // Agregar filas
    result.recordset.forEach(row => {
      worksheet.addRow({
        codpro: row.codpro ? row.codpro.toString().padStart(5, '0') : '',
        NombreProducto: row.NombreProducto || '',
        almacen: row.almacen || '',
        lote: row.lote || '',
        vencimiento: row.vencimiento ? new Date(row.vencimiento) : '',
        saldo: row.saldo || 0,
        protocolo: row.protocolo || ''
      });
    });

    // Formatear columna de vencimiento como fecha y hora
    worksheet.getColumn('vencimiento').numFmt = 'dd/mm/yyyy hh:mm';

    // Forzar columna codpro como texto (para ceros a la izquierda)
    worksheet.getColumn('codpro').eachCell(cell => {
      cell.numFmt = '@';
    });

    // Agregar autofiltro
    worksheet.autoFilter = {
      from: 'A1',
      to: 'G1'
    };

    // Aplicar formato de cabecera
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }
    };
    worksheet.getRow(1).border = {
      bottom: { style: 'thin', color: { argb: 'FFB4B4B4' } }
    };

    // Preparar respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="saldos_${codigoProducto}_${new Date().toISOString().split('T')[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar saldos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al exportar los saldos',
      details: error.message
    });
  }
});

// Obtener códigos de productos disponibles (primeros 2 dígitos)
router.get('/codigos-disponibles', async (req, res) => {
  try {
    const pool = await getConnection();

    const query = `
      SELECT DISTINCT LEFT(s.codpro, 2) as codigo
      FROM dbo.Saldos AS s 
      INNER JOIN dbo.Productos AS p ON s.codpro = p.CodPro
      ORDER BY LEFT(s.codpro, 2)
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset.map(row => row.codigo)
    });

  } catch (error) {
    console.error('Error al obtener códigos disponibles:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los códigos disponibles',
      details: error.message
    });
  }
});

module.exports = router; 