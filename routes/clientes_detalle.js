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

module.exports = router;
