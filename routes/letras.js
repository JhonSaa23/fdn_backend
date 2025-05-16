const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');

// Obtener todas las letras activas
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT Numero, Codclie, Vendedor, Plazo, FecIni, FecVen, Monto, Estado, MontoPagado 
      FROM DocLetra 
      WHERE Anulado=0 AND Estado=1
    `;
    
    const result = await executeQuery(query);
    
    // Formatear fechas y montos para enviar al frontend
    const letras = result.recordset.map(letra => {
      return {
        ...letra,
        FecIni: letra.FecIni ? new Date(letra.FecIni).toISOString().split('T')[0] : null,
        FecVen: letra.FecVen ? new Date(letra.FecVen).toISOString().split('T')[0] : null,
        EstadoText: letra.Estado === 1 ? 'Generado' : 'Otro estado'
      };
    });

    res.json(letras);
  } catch (error) {
    console.error('Error al obtener letras:', error);
    res.status(500).json({ error: 'Error al obtener listado de letras: ' + error.message });
  }
});

// Obtener detalles de una letra específica
router.get('/:numero', async (req, res) => {
  try {
    const { numero } = req.params;
    
    // Consulta para obtener detalle de letra
    const query = `
      SELECT Numero, Documento, TipoDoc, Saldo, ImpAsig
      FROM detletra 
      WHERE Numero = '${numero}'
    `;
    
    const result = await executeQuery(query);
    
    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No se encontraron detalles para la letra especificada' 
      });
    }
    
    res.json({
      success: true,
      detalles: result.recordset
    });
  } catch (error) {
    console.error('Error al obtener detalle de letra:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener detalle de letra: ' + error.message 
    });
  }
});

// Buscar letras por cliente o vendedor
router.get('/buscar/:criterio/:valor', async (req, res) => {
  try {
    const { criterio, valor } = req.params;
    
    let query = `
      SELECT Numero, Codclie, Vendedor, Plazo, FecIni, FecVen, Monto, Estado, MontoPagado 
      FROM DocLetra 
      WHERE Anulado=0 AND Estado=1
    `;
    
    if (criterio === 'cliente') {
      query += ` AND Codclie LIKE '%${valor}%'`;
    } else if (criterio === 'vendedor') {
      query += ` AND Vendedor LIKE '%${valor}%'`;
    } else if (criterio === 'numero') {
      query += ` AND Numero LIKE '%${valor}%'`;
    }
    
    const result = await executeQuery(query);
    
    // Formatear fechas y montos
    const letras = result.recordset.map(letra => {
      return {
        ...letra,
        FecIni: letra.FecIni ? new Date(letra.FecIni).toISOString().split('T')[0] : null,
        FecVen: letra.FecVen ? new Date(letra.FecVen).toISOString().split('T')[0] : null,
        EstadoText: letra.Estado === 1 ? 'Generado' : 'Otro estado'
      };
    });

    res.json(letras);
  } catch (error) {
    console.error('Error al buscar letras:', error);
    res.status(500).json({ error: 'Error al buscar letras: ' + error.message });
  }
});

module.exports = router; 