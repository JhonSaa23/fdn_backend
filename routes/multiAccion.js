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
    const codigoLimpio = req.body.codigo?.trim();
    
    if (!codigoLimpio) {
      return res.status(400).json({ message: 'Código requerido' });
    }
    
    const query = 'INSERT INTO PRODBOLETA VALUES (@codigo)';
    await executeQuery(query, { codigo: codigoLimpio });

    res.json({ message: 'Código autorizado correctamente' });
  } catch (error) {
    console.error('Error al autorizar código:', error);
    res.status(500).json({ message: 'Error al autorizar código' });
  }
});

module.exports = router; 