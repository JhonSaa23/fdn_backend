const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');
const sql = require('mssql');



// Endpoint para obtener todos los datos de la tabla Kardex
router.get('/tabla', async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM Kardex WITH(NOLOCK)
      ORDER BY Fecha DESC
    `;

    const result = await executeQuery(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener datos del kardex:', error);
    res.status(500).json({
      error: 'Error al obtener datos del kardex',
      details: error.message
    });
  }
});

// Endpoint para obtener observaciones de un documento
router.get('/observaciones/:documento', async (req, res) => {
  try {
    const { documento } = req.params;
    
    const query = `
      SELECT Documento, Fecha, Observaciones, Anulado
      FROM Movimientos_cab WITH(NOLOCK)
      WHERE LTRIM(RTRIM(Documento)) = @documento
    `;
    
    const params = {
      documento: documento
    };
    
    const result = await executeQuery(query, params);
    
    if (result.recordset.length === 0) {
      return res.json({ 
        success: true, 
        data: null, 
        message: 'No se encontraron observaciones para este documento' 
      });
    }
    
    res.json({ 
      success: true, 
      data: result.recordset[0] 
    });
    
  } catch (error) {
    console.error('Error al obtener observaciones:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

module.exports = router; 