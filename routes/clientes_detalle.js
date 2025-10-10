const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const sql = require('mssql');
const { authenticateToken } = require('../middleware/auth');

// Obtener deudas de un cliente por RUC
router.get('/:ruc/deudas', authenticateToken, async (req, res) => {
  try {
    const { ruc } = req.params;
    
    console.log(`📋 [CLIENTES-DETALLE] Obteniendo deudas para RUC: ${ruc}`);
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('ruc', sql.Char(12), ruc)
      .execute('sp_CtaClie_ListarDeudas');
    
    const deudas = result.recordset;
    
    console.log(`✅ [CLIENTES-DETALLE] Deudas obtenidas: ${deudas.length} registros`);
    
    res.json({
      success: true,
      data: deudas,
      count: deudas.length
    });
    
  } catch (error) {
    console.error('❌ [CLIENTES-DETALLE] Error obteniendo deudas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener deudas'
    });
  }
});

// Obtener pagos y compromisos de un cliente por RUC
router.get('/:ruc/pagos', authenticateToken, async (req, res) => {
  try {
    const { ruc } = req.params;
    
    console.log(`💰 [CLIENTES-DETALLE] Obteniendo pagos/compromisos para RUC: ${ruc}`);
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('ruc', sql.Char(12), ruc)
      .execute('sp_pagos_compromiso_lista');
    
    const pagos = result.recordset;
    
    console.log(`✅ [CLIENTES-DETALLE] Pagos/compromisos obtenidos: ${pagos.length} registros`);
    
    res.json({
      success: true,
      data: pagos,
      count: pagos.length
    });
    
  } catch (error) {
    console.error('❌ [CLIENTES-DETALLE] Error obteniendo pagos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener pagos'
    });
  }
});

// Obtener detalle completo de un documento (cabecera + detalle)
router.get('/documento/:numero/detalle', authenticateToken, async (req, res) => {
  try {
    const { numero } = req.params;
    
    console.log(`📄 [DOCUMENTO-DETALLE] Obteniendo detalle para documento: ${numero}`);
    
    const pool = await getConnection();
    
    // Obtener cabecera del documento
    const cabeceraResult = await pool.request()
      .input('numero', sql.VarChar(20), numero)
      .query(`
        SELECT 
          numero, tipo, CodClie, fecha, dias, FechaV, bruto, 
          Descuento, flete, Subtotal, igv, total, Vendedor, 
          Transporte, NroPedido 
        FROM doccab 
        WHERE numero = @numero
      `);
    
    if (cabeceraResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado'
      });
    }
    
    const cabecera = cabeceraResult.recordset[0];
    
    // Obtener detalle del documento
    const detalleResult = await pool.request()
      .input('numero', sql.VarChar(20), numero)
      .query(`
        SELECT 
          Numero, tipo, Codpro, lote, Vencimiento, Cantidad, 
          Precio, Descuento1, Descuento2, Descuento3, Subtotal 
        FROM docdet 
        WHERE numero = @numero
        ORDER BY Codpro
      `);
    
    const detalle = detalleResult.recordset;
    
    console.log(`✅ [DOCUMENTO-DETALLE] Detalle obtenido: ${detalle.length} productos`);
    
    res.json({
      success: true,
      data: {
        cabecera: cabecera,
        detalle: detalle
      },
      count: detalle.length
    });
    
  } catch (error) {
    console.error('❌ [DOCUMENTO-DETALLE] Error obteniendo detalle:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener detalle del documento'
    });
  }
});

module.exports = router;
