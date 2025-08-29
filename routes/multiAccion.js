const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');

// Buscar pedido
router.get('/pedido/:numero', async (req, res) => {
  try {
    console.log('🚀 ENDPOINT PEDIDO LLAMADO con número:', req.params.numero);
    const numeroLimpio = req.params.numero.trim();
    
    // Buscar información del pedido
    const pedidoQuery = `
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

    const pedidoResult = await executeQuery(pedidoQuery, { numero: numeroLimpio });
    console.log('📋 Pedido encontrado:', pedidoResult.recordset[0]);

    if (pedidoResult.recordset.length > 0) {
      // Buscar detalles del pedido
      const detallesQuery = `
        SELECT 
          d.Numero,
          d.Producto,
          p.Nombre as NombreProducto,
          d.Cantidad,
          d.Costo,
          d.Descuento1,
          d.Descuento2,
          d.Descuento3,
          d.Subtotal
        FROM DetaPedido d
        LEFT JOIN Productos p ON d.Producto = p.CodPro
        WHERE d.Numero = @numero
        ORDER BY d.Producto
      `;

      console.log('🔍 Ejecutando consulta de detalles con número:', numeroLimpio);
      const detallesResult = await executeQuery(detallesQuery, { numero: numeroLimpio });

      // Debug: mostrar información de los detalles encontrados
      console.log(`🔍 Detalles encontrados para pedido ${numeroLimpio}:`, detallesResult.recordset.length);
      console.log('🔍 Resultado completo de detalles:', detallesResult);
      
      if (detallesResult.recordset.length > 0) {
        console.log('📋 Primer detalle:', detallesResult.recordset[0]);
      } else {
        // Debug: buscar todos los detalles para ver qué hay
        const debugQuery = `SELECT TOP 5 Numero, Producto FROM DetaPedido WHERE Numero LIKE '%${numeroLimpio}%'`;
        const debugResult = await executeQuery(debugQuery);
        console.log('🔍 Debug - Búsqueda parcial:', debugResult.recordset);
        
        // También buscar el pedido exacto
        const exactQuery = `SELECT TOP 5 Numero, Producto FROM DetaPedido WHERE Numero = '${numeroLimpio}'`;
        const exactResult = await executeQuery(exactQuery);
        console.log('🔍 Debug - Búsqueda exacta:', exactResult.recordset);
        
        // Verificar si hay algún detalle en la tabla
        const allQuery = `SELECT TOP 10 Numero, Producto FROM DetaPedido ORDER BY Numero DESC`;
        const allResult = await executeQuery(allQuery);
        console.log('🔍 Debug - Últimos 10 detalles en la tabla:', allResult.recordset);
      }

      // Asegurarnos de que los campos sean números
      const pedido = {
        ...pedidoResult.recordset[0],
        Validado: parseInt(pedidoResult.recordset[0].Validado, 10),
        Eliminado: parseInt(pedidoResult.recordset[0].Eliminado, 10),
        detalles: detallesResult.recordset
      };
      
      console.log('📦 Pedido completo a enviar:', {
        numero: pedido.Numero,
        detallesCount: pedido.detalles.length,
        detalles: pedido.detalles
      });
      
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

// Eliminar producto del pedido
router.delete('/pedido/:numero/producto/:producto', async (req, res) => {
  try {
    const numeroLimpio = req.params.numero.trim();
    const producto = req.params.producto.trim();
    
    const deleteQuery = 'DELETE FROM DetaPedido WHERE Numero = @numero AND Producto = @producto';
    const result = await executeQuery(deleteQuery, { numero: numeroLimpio, producto });

    if (result.rowsAffected[0] > 0) {
      res.json({ message: 'Producto eliminado del pedido correctamente' });
    } else {
      res.status(404).json({ message: 'Producto no encontrado en el pedido' });
    }
  } catch (error) {
    console.error('Error al eliminar producto del pedido:', error);
    res.status(500).json({ message: 'Error al eliminar producto del pedido' });
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

// Autorizar códigos - Siguiendo el mismo patrón que movimientos
router.post('/autorizar', async (req, res) => {
  try {
    console.log('=== DEBUG AUTORIZAR ===');
    console.log('Headers:', req.headers);
    console.log('Body completo:', req.body);
    console.log('Body.codigos:', req.body.codigos);
    console.log('Body.codigos tipo:', typeof req.body.codigos);
    
    const codigosInput = req.body.codigos?.trim();
    
    if (!codigosInput) {
      console.log('❌ ERROR: Códigos vacíos o undefined');
      console.log('codigosInput:', codigosInput);
      return res.status(400).json({ message: 'Códigos requeridos' });
    }
    
    // Dividir por comas y limpiar espacios
    const codigosArray = codigosInput
      .split(',')
      .map(codigo => codigo.trim())
      .filter(codigo => codigo.length > 0);
    
    if (codigosArray.length === 0) {
      console.log('❌ ERROR: Array de códigos vacío después de procesar');
      console.log('codigosArray:', codigosArray);
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
      mensaje = `${codigosAutorizados} código${codigosAutorizados > 1 ? 's' : ''} autorizado${codigosAutorizados > 1 ? 's' : ''}. ${errores.length} errores.`;
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

// Buscar guías por serie
router.get('/guias-serie/:serie', async (req, res) => {
  try {
    const serie = req.params.serie.trim();
    
    if (!serie) {
      return res.status(400).json({ message: 'Serie requerida' });
    }
    
    const query = `
      SELECT TOP 50
        Numero,
        Docventa,
        TipoDoc,
        Fecha,
        Empresa,
        Ruc,
        Placa,
        PtoLLegada,
        Destino,
        CAST(Eliminado AS INT) as Eliminado,
        CAST(Impreso AS INT) as Impreso,
        Peso
      FROM DoccabGuia 
      WHERE LEFT(Numero, 4) = @serie 
      ORDER BY Numero DESC
    `;
    
    const result = await executeQuery(query, { serie });
    
    // Formatear los datos para el frontend
    const guias = result.recordset.map(guia => ({
      ...guia,
      Eliminado: parseInt(guia.Eliminado, 10),
      Impreso: parseInt(guia.Impreso, 10),
      Fecha: guia.Fecha ? new Date(guia.Fecha).toLocaleString('es-ES') : null
    }));
    
    res.json({
      success: true,
      data: guias,
      total: guias.length,
      serie: serie
    });
  } catch (error) {
    console.error('Error al buscar guías por serie:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al buscar guías por serie' 
    });
  }
});

module.exports = router; 