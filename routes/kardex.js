const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');
const sql = require('mssql');

// Endpoint para consultar movimientos (Kardex)
router.post('/consultar', async (req, res) => {
  try {
    console.log('Datos recibidos para consulta de kardex:', req.body);
    
    const { documento, fechaDesde, fechaHasta, codpro, lote, movimiento, clase } = req.body;
    
    // Construir condiciones de filtro dinámicamente
    let condiciones = [];
    let params = {};
    
    // Filtro por documento
    if (documento && documento.trim()) {
      condiciones.push('Documento LIKE @documento');
      params.documento = `%${documento.trim()}%`;
    }
    
    // Filtro por rango de fechas
    if (fechaDesde && fechaDesde.trim()) {
      condiciones.push('Fecha >= @fechaDesde');
      params.fechaDesde = new Date(fechaDesde.trim());
    }
    
    if (fechaHasta && fechaHasta.trim()) {
      condiciones.push('Fecha <= @fechaHasta');
      params.fechaHasta = new Date(fechaHasta.trim());
    }
    
    // Filtro por código de producto
    if (codpro && codpro.trim()) {
      condiciones.push('CodPro LIKE @codpro');
      params.codpro = `%${codpro.trim()}%`;
    }
    
    // Filtro por lote
    if (lote && lote.trim()) {
      condiciones.push('Lote LIKE @lote');
      params.lote = `%${lote.trim()}%`;
    }
    
    // Filtro por movimiento (1=Entrada, 2=Salida)
    if (movimiento && movimiento.trim()) {
      condiciones.push('Movimiento = @movimiento');
      params.movimiento = parseInt(movimiento.trim());
    }
    
    // Filtro por clase
    if (clase && clase.trim()) {
      condiciones.push('Clase = @clase');
      params.clase = parseInt(clase.trim());
    }
    
    // Construir la consulta SQL
    let query = `
      SELECT TOP 1000 
        Documento,
        Fecha,
        CodPro,
        Lote,
        Vencimiento,
        Movimiento,
        Clase,
        Cantidad,
        Costo,
        Venta,
        Stock,
        Almacen,
        Impreso,
        Anulado
      FROM Movimientos
    `;
    
    if (condiciones.length > 0) {
      query += ' WHERE ' + condiciones.join(' AND ');
    }
    
    // Ordenar por fecha descendente
    query += ' ORDER BY Fecha DESC';
    
    console.log('Ejecutando consulta:', query);
    console.log('Parámetros:', params);
    
    // Ejecutar la consulta
    const result = await executeQuery(query, params);
    
    console.log(`Movimientos encontrados: ${result.recordset.length}`);
    res.json(result.recordset);
    
  } catch (error) {
    console.error('Error en consulta de kardex:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

module.exports = router; 