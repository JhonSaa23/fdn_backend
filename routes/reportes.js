const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');
const sql = require('mssql');

// Consultar reporte CodPro con filtros
router.post('/codpro', async (req, res) => {
  try {
    const { codProducto, fechaInicio, fechaFin } = req.body;
    
    // Validar que exista al menos el código de producto
    if (!codProducto) {
      return res.status(400).json({
        success: false,
        error: 'El código de producto es requerido'
      });
    }

    // Construir la consulta SQL
    let query = `
      SELECT 
        p.Numero    AS Pedido,
        CONVERT(date, p.Fecha) AS Fecha,
        c.Documento AS RUC,
        c.Razon     AS RazonSocial,
        d.Cantidad,
        d.Precio,
        d.Descuento1 AS Dscto1,
        d.Descuento2 AS Dscto2,
        d.Descuento3 AS Dscto3
      FROM 
        DoccabPed p
      JOIN 
        DocdetPed d ON p.Numero = d.Numero
      JOIN 
        Clientes c ON p.CodClie = c.CodClie
      WHERE 
        d.CodPro = @codProducto
    `;
    
    // Agregar filtro de fechas si se proporcionan
    if (fechaInicio && fechaFin) {
      query += ' AND CONVERT(date, p.Fecha) BETWEEN @fechaInicio AND @fechaFin';
    }
    
    // Crear la conexión y establecer los parámetros
    const pool = await sql.connect(require('../config').dbConfig);
    const request = pool.request();
    
    request.input('codProducto', sql.VarChar, codProducto);
    
    if (fechaInicio && fechaFin) {
      request.input('fechaInicio', sql.Date, new Date(fechaInicio));
      request.input('fechaFin', sql.Date, new Date(fechaFin));
    }
    
    // Ejecutar la consulta
    const result = await request.query(query);
    
    // Devolver los resultados
    res.json({
      success: true,
      data: result.recordset,
      totalRegistros: result.recordset.length
    });
    
  } catch (error) {
    console.error('Error al consultar reporte CodPro:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al consultar reporte: ' + error.message 
    });
  }
});

module.exports = router; 