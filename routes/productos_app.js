const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getConnection } = require('../database');

console.log('🚀 [PRODUCTOS-APP] Router cargado correctamente');

// Endpoint de prueba para verificar que la ruta funciona
router.get('/test', (req, res) => {
  console.log('🧪 [PRODUCTOS-TEST] Endpoint de prueba accedido');
  res.json({
    success: true,
    message: 'Endpoint de productos funcionando correctamente',
    timestamp: new Date().toISOString(),
    user: req.user
  });
});

// Endpoint de prueba para verificar el stored procedure
router.get('/test-sp', async (req, res) => {
  try {
    const vendedorId = req.user.CodigoInterno;
    console.log(`🧪 [PRODUCTOS-TEST-SP] Probando SP para vendedor: ${vendedorId}`);

    const pool = await getConnection();
    
    const result = await pool.request()
      .execute('Jhon_Producto_BasicoOptimizado');

    console.log(`🧪 [PRODUCTOS-TEST-SP] Resultado:`, result);
    console.log(`🧪 [PRODUCTOS-TEST-SP] Recordset:`, result.recordset);

    res.json({
      success: true,
      message: 'Stored procedure ejecutado correctamente',
      recordset: result.recordset,
      count: result.recordset ? result.recordset.length : 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [PRODUCTOS-TEST-SP] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Obtener productos del vendedor actual
router.get('/vendedor/productos', async (req, res) => {
  try {
    const { limit = 10000 } = req.query;
    const vendedorId = req.user.CodigoInterno;

    console.log(`🔍 [PRODUCTOS] Obteniendo productos para vendedor (CodigoInterno): ${vendedorId}`);
    console.log(`🔍 [PRODUCTOS] Límite: ${limit}`);

    const pool = await getConnection();
    
    // Ejecutar el stored procedure Jhon_Producto_BasicoOptimizado
    const result = await pool.request()
      .execute('Jhon_Producto_BasicoOptimizado');

    console.log(`✅ [PRODUCTOS] Productos obtenidos: ${result.recordset.length}`);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [PRODUCTOS] Error obteniendo productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener productos'
    });
  }
});

// Server-Sent Events para tiempo real de productos
router.get('/vendedor/productos/stream', async (req, res) => {
  try {
    console.log(`🌊 [PRODUCTOS-SSE] ✅ RUTA ACCEDIDA - /vendedor/productos/stream`);
    console.log(`🌊 [PRODUCTOS-SSE] Headers:`, req.headers);
    console.log(`🌊 [PRODUCTOS-SSE] User object:`, req.user);
    
    const vendedorId = req.user.CodigoInterno;
    
    console.log(`🌊 [PRODUCTOS-SSE] Iniciando stream en tiempo real para vendedor (CodigoInterno): ${vendedorId}`);
    
    // Configurar headers para SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Enviar evento inicial
    res.write(`data: ${JSON.stringify({
      type: 'connection_established',
      message: 'Conexión establecida para productos en tiempo real',
      vendedorId: vendedorId,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Variable para controlar si la conexión está activa
    let connectionActive = true;
    let interval;
    let heartbeat;

    // Función para enviar actualización de productos
    const sendProductosUpdate = async () => {
      try {
        // Verificar si la conexión sigue activa antes de proceder
        if (!connectionActive) {
          console.log(`🌊 [PRODUCTOS-SSE] Conexión inactiva, cancelando envío para vendedor: ${vendedorId}`);
          return;
        }

        const pool = await getConnection();
        
        // Ejecutar el stored procedure Jhon_Producto_BasicoOptimizado
        const result = await pool.request()
          .execute('Jhon_Producto_BasicoOptimizado');

        console.log(`🌊 [PRODUCTOS-SSE] Resultado del SP:`, result);
        console.log(`🌊 [PRODUCTOS-SSE] Recordset:`, result.recordset);

        // Validar que el resultado no sea null
        if (!result || !result.recordset) {
          console.error(`❌ [PRODUCTOS-SSE] Resultado nulo para vendedor: ${vendedorId}`);
          throw new Error('El stored procedure no devolvió datos');
        }

        const productos = result.recordset;

        // Validar que productos sea un array válido
        if (!Array.isArray(productos)) {
          console.error(`❌ [PRODUCTOS-SSE] Productos no es un array para vendedor: ${vendedorId}`);
          throw new Error('El stored procedure no devolvió un array de productos');
        }

        console.log(`🌊 [PRODUCTOS-SSE] Productos obtenidos: ${productos.length}`);

        // Verificar nuevamente si la conexión sigue activa antes de enviar
        if (!connectionActive) {
          console.log(`🌊 [PRODUCTOS-SSE] Conexión inactiva, cancelando envío de datos para vendedor: ${vendedorId}`);
          return;
        }

        // Enviar actualización con manejo de errores
        try {
          // Crear el objeto de datos de forma segura
          const updateData = {
            type: 'productos_update',
            data: productos,
            timestamp: new Date().toISOString(),
            count: productos.length
          };

          console.log(`🌊 [PRODUCTOS-SSE] Enviando datos:`, JSON.stringify(updateData).substring(0, 200) + '...');

          res.write(`data: ${JSON.stringify(updateData)}\n\n`);

          console.log(`🌊 [PRODUCTOS-SSE] Actualización enviada: ${productos.length} productos`);
        } catch (writeError) {
          console.log(`🌊 [PRODUCTOS-SSE] Error escribiendo datos, conexión probablemente cerrada para vendedor: ${vendedorId}`);
          connectionActive = false;
          clearInterval(interval);
          clearInterval(heartbeat);
          return;
        }
        
      } catch (error) {
        console.error('❌ [PRODUCTOS-SSE] Error enviando actualización:', error);
        console.error('❌ [PRODUCTOS-SSE] Stack trace:', error.stack);
        
        // Solo enviar error si la conexión está activa
        if (connectionActive) {
          try {
            res.write(`data: ${JSON.stringify({
              type: 'error',
              message: `Error al obtener productos: ${error.message}`,
              timestamp: new Date().toISOString(),
              vendedorId: vendedorId
            })}\n\n`);
          } catch (writeError) {
            console.log(`🌊 [PRODUCTOS-SSE] Error escribiendo mensaje de error, conexión cerrada para vendedor: ${vendedorId}`);
            connectionActive = false;
            clearInterval(interval);
            clearInterval(heartbeat);
          }
        }
      }
    };

    // Enviar actualización inicial
    await sendProductosUpdate();

    // Configurar intervalo para actualizaciones periódicas (cada 10 segundos)
    interval = setInterval(async () => {
      if (connectionActive) {
        await sendProductosUpdate();
      }
    }, 10000);

    // Heartbeat cada 30 segundos para mantener la conexión viva
    heartbeat = setInterval(() => {
      if (connectionActive) {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`);
        } catch (writeError) {
          console.log(`🌊 [PRODUCTOS-SSE] Error escribiendo heartbeat, conexión cerrada para vendedor: ${vendedorId}`);
          connectionActive = false;
          clearInterval(interval);
          clearInterval(heartbeat);
        }
      }
    }, 30000);

    // Limpiar al cerrar conexión
    req.on('close', () => {
      console.log(`🌊 [PRODUCTOS-SSE] Conexión cerrada para vendedor: ${vendedorId}`);
      connectionActive = false; // Marcar conexión como inactiva
      clearInterval(interval);
      clearInterval(heartbeat);
    });

    req.on('aborted', () => {
      console.log(`🌊 [PRODUCTOS-SSE] Conexión abortada para vendedor: ${vendedorId}`);
      connectionActive = false; // Marcar conexión como inactiva
      clearInterval(interval);
      clearInterval(heartbeat);
    });

  } catch (error) {
    console.error('❌ [PRODUCTOS-SSE] Error estableciendo conexión:', error);
    res.status(500).json({
      success: false,
      error: 'Error estableciendo conexión en tiempo real'
    });
  }
});

// Obtener detalles de un producto específico
router.get('/vendedor/productos/:codpro', async (req, res) => {
  try {
    const { codpro } = req.params;
    const vendedorId = req.user.CodigoInterno;

    console.log(`🔍 [PRODUCTOS] Obteniendo detalle del producto: ${codpro} para vendedor: ${vendedorId}`);

    const pool = await getConnection();
    
    // Ejecutar el stored procedure para obtener el producto específico
    const result = await pool.request()
      .execute('Jhon_Producto_BasicoOptimizado');

    // Filtrar el producto específico
    const producto = result.recordset.find(p => p.codpro == codpro);

    if (producto) {
      res.json({
        success: true,
        data: producto,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

  } catch (error) {
    console.error('❌ [PRODUCTOS] Error obteniendo detalle del producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener detalle del producto'
    });
  }
});

module.exports = router;
