const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');

// Buscar pedido
router.get('/pedido/:numero', async (req, res) => {
  try {
    const numeroLimpio = req.params.numero.trim();
    
    const query = `
      SELECT 
        Numero,
        Laboratorio,
        FechaPed,
        FechaRec,
        FechaAnt,
        CAST(Validado AS INT) as Validado,
        CAST(Eliminado AS INT) as Eliminado,
        Observaciones,
        Proveedor
      FROM Pedido 
      WHERE Numero = @numero
    `;

    const result = await executeQuery(query, { numero: numeroLimpio });

    if (result.recordset.length > 0) {
      // Asegurarnos de que los campos sean números
      const pedido = {
        ...result.recordset[0],
        Validado: parseInt(result.recordset[0].Validado, 10),
        Eliminado: parseInt(result.recordset[0].Eliminado, 10)
      };
      res.json(pedido);
    } else {
      res.status(404).json({ message: 'Pedido no encontrado' });
    }
  } catch (error) {
    console.error('Error al buscar pedido:', error);
    res.status(500).json({ message: 'Error al buscar pedido' });
  }
});

// Invalidar pedido
router.post('/pedido/:numero/invalidar', async (req, res) => {
  try {
    const numeroLimpio = req.params.numero.trim();
    
    // Primero verificamos que el pedido exista y esté validado
    const checkQuery = 'SELECT CAST(Validado AS INT) as Validado FROM Pedido WHERE Numero = @numero';
    const checkResult = await executeQuery(checkQuery, { numero: numeroLimpio });

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    const validado = parseInt(checkResult.recordset[0].Validado, 10);
    if (validado !== 1) {
      return res.status(400).json({ message: 'El pedido ya está invalidado' });
    }

    // Si todo está bien, procedemos a invalidar
    const updateQuery = 'UPDATE Pedido SET Validado = 0 WHERE Numero = @numero';
    const result = await executeQuery(updateQuery, { numero: numeroLimpio });

    if (result.rowsAffected[0] > 0) {
      res.json({ message: 'Pedido invalidado correctamente' });
    } else {
      res.status(500).json({ message: 'No se pudo invalidar el pedido' });
    }
  } catch (error) {
    console.error('Error al invalidar pedido:', error);
    res.status(500).json({ message: 'Error al invalidar pedido' });
  }
});

// Buscar guía
router.get('/guia/:numero', async (req, res) => {
  try {
    const numeroLimpio = req.params.numero.trim();
    
    const query = 'SELECT * FROM DoccabGuia WHERE Numero = @numero';
    const result = await executeQuery(query, { numero: numeroLimpio });

    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).json({ message: 'Guía no encontrada' });
    }
  } catch (error) {
    console.error('Error al buscar guía:', error);
    res.status(500).json({ message: 'Error al buscar guía' });
  }
});

// Reusar guía
router.post('/guia/:numero/reusar', async (req, res) => {
  try {
    const numeroLimpio = req.params.numero.trim();
    
    const query = 'DELETE FROM DoccabGuia WHERE Numero = @numero';
    const result = await executeQuery(query, { numero: numeroLimpio });

    if (result.rowsAffected[0] > 0) {
      res.json({ message: 'Guía reusada correctamente' });
    } else {
      res.status(404).json({ message: 'Guía no encontrada' });
    }
  } catch (error) {
    console.error('Error al reusar guía:', error);
    res.status(500).json({ message: 'Error al reusar guía' });
  }
});

// Autorizar código
router.post('/autorizar', async (req, res) => {
  try {
    const codigosInput = req.body.codigos?.trim();
    
    if (!codigosInput) {
      return res.status(400).json({ message: 'Códigos requeridos' });
    }
    
    // Dividir por comas y limpiar espacios
    const codigosArray = codigosInput
      .split(',')
      .map(codigo => codigo.trim())
      .filter(codigo => codigo.length > 0);
    
    if (codigosArray.length === 0) {
      return res.status(400).json({ message: 'Códigos requeridos' });
    }
    
    let codigosAutorizados = 0;
    let errores = [];
    
    // Procesar cada código
    for (const codigo of codigosArray) {
      try {
        const query = 'INSERT INTO PRODBOLETA VALUES (@codigo)';
        await executeQuery(query, { codigo });
        codigosAutorizados++;
      } catch (error) {
        console.error(`Error al autorizar código ${codigo}:`, error);
        errores.push(`Error en código ${codigo}: ${error.message}`);
      }
    }
    
    let mensaje = '';
    if (codigosAutorizados === codigosArray.length) {
      mensaje = `${codigosAutorizados} código${codigosAutorizados > 1 ? 's' : ''} autorizado${codigosAutorizados > 1 ? 's' : ''} correctamente`;
    } else if (codigosAutorizados > 0) {
      mensaje = `${codigosAutorizados} de ${codigosArray.length} códigos autorizados. ${errores.length} errores.`;
    } else {
      mensaje = `No se pudo autorizar ningún código. Errores: ${errores.join(', ')}`;
    }
    
    res.json({ 
      message: mensaje,
      autorizados: codigosAutorizados,
      total: codigosArray.length,
      errores: errores
    });
  } catch (error) {
    console.error('Error al autorizar códigos:', error);
    res.status(500).json({ message: 'Error al autorizar códigos' });
  }
});

module.exports = router; 