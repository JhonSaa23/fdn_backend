const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { getConnection } = require('../database');

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  console.log(`🔐 [AUTH] Ruta: ${req.path}`);
  console.log(`🔐 [AUTH] Headers:`, req.headers);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log(`❌ [AUTH] No token found`);
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  console.log(`🔐 [AUTH] Token encontrado: ${token.substring(0, 20)}...`);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log(`❌ [AUTH] Token inválido:`, err.message);
      return res.status(403).json({ error: 'Token inválido' });
    }
    console.log(`✅ [AUTH] Token válido, usuario:`, user);
    req.user = user;
    next();
  });
};

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

// Estados de pedidos para convertir números a descripciones
const estadosPedidos = {
  1: 'Crédito',
  2: 'Comercial', 
  3: 'Por Facturar',
  4: 'Facturado',
  5: 'Por Despachar',
  6: 'Embalado',
  7: 'Reparto',
  8: 'Entregado',
  9: 'No Atendido por falta de stock'
};

// Obtener pedidos del vendedor actual
router.get('/vendedor/pedidos', async (req, res) => {
  try {
    const { estado, limit = 50 } = req.query;
    const vendedorId = req.user.idus;

    console.log(`🔍 [SEGUIMIENTO] Obteniendo pedidos para vendedor: ${vendedorId}`);
    console.log(`🔍 [SEGUIMIENTO] Filtros - estado: ${estado}, limit: ${limit}`);

    const pool = await getConnection();
    
    let query = `
      SELECT 
        d.Numero,
        d.Estado,
        d.CodClie,
        c.Razon,
        d.Fecha,
        d.Tipo,
        d.Direccion,
        d.Subtotal,
        d.Igv,
        d.Total,
        d.Moneda,
        d.Cambio,
        d.Vendedor,
        d.Dias,
        d.Condicion,
        d.Eliminado,
        d.Impreso,
        d.FecCre,
        d.FecPre,
        d.FecFac,
        d.FecOrd,
        d.FecDes,
        d.FecAte,
        d.FecClie,
        d.Observacion,
        d.ConLetra,
        d.Urgente,
        d.Representante
      FROM DoccabPed d
      LEFT JOIN clientes c ON d.CodClie = c.Codclie
      WHERE d.Vendedor = @vendedorId AND d.Eliminado = 0
    `;

    const request = pool.request();
    request.input('vendedorId', sql.Int, vendedorId);

    // Agregar filtro por estado si se especifica
    if (estado) {
      query += ' AND d.Estado = @estado';
      request.input('estado', sql.Int, parseInt(estado));
    }

    // Ordenar por fecha descendente
    query += ' ORDER BY d.Fecha DESC';

    // Agregar límite
    if (limit) {
      query += ` OFFSET 0 ROWS FETCH NEXT ${parseInt(limit)} ROWS ONLY`;
    }

    console.log(`🔍 [SEGUIMIENTO] Ejecutando query: ${query}`);
    
    const result = await request.query(query);
    
    console.log(`🔍 [SEGUIMIENTO] Query ejecutado. Registros encontrados: ${result.recordset.length}`);

    // Formatear los datos para el frontend
    const pedidos = result.recordset.map(pedido => ({
      id: pedido.Numero,
      numeroCorrelativo: pedido.Numero,
      fechaCreacion: pedido.Fecha,
      fechaModificacion: pedido.FecCre,
      estado: pedido.Estado,
      total: pedido.Total,
      urgente: pedido.Urgente,
      observacion: pedido.Observacion,
      tipoDocumento: pedido.Tipo,
      condicion: pedido.Condicion,
      subtotal: pedido.Subtotal,
      igv: pedido.Igv,
      moneda: pedido.Moneda,
      cambio: pedido.Cambio,
      dias: pedido.Dias,
      eliminado: pedido.Eliminado,
      impreso: pedido.Impreso,
      conLetra: pedido.ConLetra,
      representante: pedido.Representante,
      cliente: {
        Codclie: pedido.CodClie,
        Razon: pedido.Razon,
        Documento: pedido.CodClie, // Usar CodClie como documento
        Direccion: pedido.Direccion
      },
      estadoDescripcion: estadosPedidos[pedido.Estado] || 'Estado Desconocido',
      fechas: {
        creacion: pedido.FecCre,
        preparacion: pedido.FecPre,
        facturacion: pedido.FecFac,
        orden: pedido.FecOrd,
        despacho: pedido.FecDes,
        atencion: pedido.FecAte,
        cliente: pedido.FecClie
      }
    }));

    console.log(`✅ [SEGUIMIENTO] ${pedidos.length} pedidos encontrados para vendedor ${vendedorId}`);

    res.json({
      success: true,
      data: pedidos,
      total: pedidos.length
    });

  } catch (error) {
    console.error('❌ [SEGUIMIENTO] Error obteniendo pedidos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener pedidos'
    });
  }
});

// Server-Sent Events para tiempo real
router.get('/vendedor/pedidos/stream', async (req, res) => {
  try {
    console.log(`🌊 [SEGUIMIENTO-SSE] Endpoint llamado - Headers:`, req.headers);
    console.log(`🌊 [SEGUIMIENTO-SSE] User object:`, req.user);
    
    const vendedorId = req.user.idus;
    
    console.log(`🌊 [SEGUIMIENTO-SSE] Iniciando stream en tiempo real para vendedor: ${vendedorId}`);
    
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
      type: 'connected',
      message: 'Conexión establecida',
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Función para enviar actualización de pedidos
    const sendPedidosUpdate = async () => {
      try {
        const pool = await getConnection();
        
        const query = `
          SELECT 
            d.Numero,
            d.Estado,
            d.CodClie,
            c.Razon,
            d.Fecha,
            d.Total,
            d.Urgente,
            d.Observacion,
            d.Tipo,
            d.Condicion,
            d.Subtotal,
            d.Igv,
            d.Moneda,
            d.Cambio,
            d.Vendedor,
            d.Dias,
            d.Eliminado,
            d.Impreso,
            d.FecCre,
            d.FecPre,
            d.FecFac,
            d.FecOrd,
            d.FecDes,
            d.FecAte,
            d.FecClie,
            d.ConLetra,
            d.Representante
          FROM DoccabPed d
          LEFT JOIN clientes c ON d.CodClie = c.Codclie
          WHERE d.Vendedor = @vendedorId AND d.Eliminado = 0
          ORDER BY d.Fecha DESC
          OFFSET 0 ROWS
          FETCH NEXT 60 ROWS ONLY
        `;

        const request = pool.request();
        request.input('vendedorId', sql.Int, vendedorId);
        const result = await request.query(query);

        // Formatear los datos
        const pedidos = result.recordset.map(pedido => ({
          id: pedido.Numero,
          numeroCorrelativo: pedido.Numero,
          fechaCreacion: pedido.Fecha,
          fechaModificacion: pedido.FecCre,
          estado: pedido.Estado,
          total: pedido.Total,
          urgente: pedido.Urgente,
          observacion: pedido.Observacion,
          tipoDocumento: pedido.Tipo,
          condicion: pedido.Condicion,
          subtotal: pedido.Subtotal,
          igv: pedido.Igv,
          moneda: pedido.Moneda,
          cambio: pedido.Cambio,
          dias: pedido.Dias,
          eliminado: pedido.Eliminado,
          impreso: pedido.Impreso,
          conLetra: pedido.ConLetra,
          representante: pedido.Representante,
          cliente: {
            Codclie: pedido.CodClie,
            Razon: pedido.Razon,
            Documento: pedido.CodClie,
            Direccion: pedido.Direccion
          },
          estadoDescripcion: estadosPedidos[pedido.Estado] || 'Estado Desconocido',
          fechas: {
            creacion: pedido.FecCre,
            preparacion: pedido.FecPre,
            facturacion: pedido.FecFac,
            orden: pedido.FecOrd,
            despacho: pedido.FecDes,
            atencion: pedido.FecAte,
            cliente: pedido.FecClie
          }
        }));

        // Enviar actualización
        res.write(`data: ${JSON.stringify({
          type: 'pedidos_update',
          data: pedidos,
          timestamp: new Date().toISOString(),
          count: pedidos.length
        })}\n\n`);

        console.log(`🌊 [SEGUIMIENTO-SSE] Actualización enviada: ${pedidos.length} pedidos`);
        
      } catch (error) {
        console.error('❌ [SEGUIMIENTO-SSE] Error enviando actualización:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Error al obtener pedidos',
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    };

    // Enviar actualización inicial
    await sendPedidosUpdate();

    // Enviar actualizaciones cada 5 segundos
    const interval = setInterval(async () => {
      await sendPedidosUpdate();
    }, 5000);

    // Enviar heartbeat cada 30 segundos
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      })}\n\n`);
    }, 30000);

    // Limpiar al cerrar conexión
    req.on('close', () => {
      console.log(`🌊 [SEGUIMIENTO-SSE] Conexión cerrada para vendedor: ${vendedorId}`);
      clearInterval(interval);
      clearInterval(heartbeat);
    });

    req.on('aborted', () => {
      console.log(`🌊 [SEGUIMIENTO-SSE] Conexión abortada para vendedor: ${vendedorId}`);
      clearInterval(interval);
      clearInterval(heartbeat);
    });

  } catch (error) {
    console.error('❌ [SEGUIMIENTO-SSE] Error estableciendo conexión:', error);
    res.status(500).json({
      success: false,
      error: 'Error estableciendo conexión en tiempo real'
    });
  }
});

// Obtener detalles de un pedido específico
router.get('/vendedor/pedidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vendedorId = req.user.idus;

    console.log(`🔍 [SEGUIMIENTO] Obteniendo detalles del pedido: ${id} para vendedor: ${vendedorId}`);

    const pool = await getConnection();
    
    const query = `
      SELECT 
        d.Numero,
        d.Estado,
        d.CodClie,
        c.Razon,
        d.Fecha,
        d.Tipo,
        d.Direccion,
        d.Subtotal,
        d.Igv,
        d.Total,
        d.Moneda,
        d.Cambio,
        d.Vendedor,
        d.Dias,
        d.Condicion,
        d.Eliminado,
        d.Impreso,
        d.FecCre,
        d.FecPre,
        d.FecFac,
        d.FecOrd,
        d.FecDes,
        d.FecAte,
        d.FecClie,
        d.Observacion,
        d.ConLetra,
        d.Urgente,
        d.Representante
      FROM DoccabPed d
      LEFT JOIN clientes c ON d.CodClie = c.Codclie
      WHERE d.Numero = @id AND d.Vendedor = @vendedorId AND d.Eliminado = 0
    `;

    const request = pool.request();
    request.input('id', id);
    request.input('vendedorId', sql.Int, vendedorId);

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    const pedido = result.recordset[0];

    // Obtener productos del pedido usando la estructura de pedidos.js
    const productosQuery = `
      SELECT 
        dp.Numero,
        dp.CodPro,
        dp.Unimed,
        dp.Cantidad,
        dp.Precio,
        dp.Descuento1,
        dp.Descuento2,
        dp.Descuento3,
        dp.Adicional,
        dp.Unidades,
        dp.Subtotal,
        dp.Paquete,
        dp.Editado,
        dp.Autoriza,
        dp.Nbonif
      FROM DocdetPed dp
      WHERE dp.numero = @id
      ORDER BY dp.CodPro
    `;

    const productosRequest = pool.request();
    productosRequest.input('id', id);
    const productosResult = await productosRequest.query(productosQuery);

    // Formatear los datos
    const pedidoDetallado = {
      id: pedido.Numero,
      numeroCorrelativo: pedido.Numero,
      fechaCreacion: pedido.Fecha,
      fechaModificacion: pedido.FecCre,
      estado: pedido.Estado,
      total: pedido.Total,
      urgente: pedido.Urgente,
      observacion: pedido.Observacion,
      tipoDocumento: pedido.Tipo,
      condicion: pedido.Condicion,
      subtotal: pedido.Subtotal,
      igv: pedido.Igv,
      moneda: pedido.Moneda,
      cambio: pedido.Cambio,
      dias: pedido.Dias,
      eliminado: pedido.Eliminado,
      impreso: pedido.Impreso,
      conLetra: pedido.ConLetra,
      representante: pedido.Representante,
      cliente: {
        Codclie: pedido.CodClie,
        Razon: pedido.Razon,
        Documento: pedido.CodClie,
        Direccion: pedido.Direccion
      },
      estadoDescripcion: estadosPedidos[pedido.Estado] || 'Estado Desconocido',
      fechas: {
        creacion: pedido.FecCre,
        preparacion: pedido.FecPre,
        facturacion: pedido.FecFac,
        orden: pedido.FecOrd,
        despacho: pedido.FecDes,
        atencion: pedido.FecAte,
        cliente: pedido.FecClie
      },
      productos: productosResult.recordset.map(prod => {
        // Calcular descuento total (suma de los 3 descuentos)
        const descuentoTotal = (prod.Descuento1 || 0) + (prod.Descuento2 || 0) + (prod.Descuento3 || 0);
        
        return {
          numero: prod.Numero,
          codigo: prod.CodPro,
          unidadMedida: prod.Unimed,
          cantidad: prod.Cantidad,
          precio: prod.Precio,
          descuento1: prod.Descuento1,
          descuento2: prod.Descuento2,
          descuento3: prod.Descuento3,
          descuentoTotal: descuentoTotal,
          adicional: prod.Adicional,
          unidades: prod.Unidades,
          subtotal: prod.Subtotal,
          paquete: prod.Paquete,
          editado: prod.Editado,
          autoriza: prod.Autoriza,
          nbonif: prod.Nbonif,
          requiereAutorizacion: prod.Autoriza === 1 || prod.Autoriza === true
        };
      })
    };

    console.log(`✅ [SEGUIMIENTO] Detalles del pedido ${id} obtenidos exitosamente`);

    res.json({
      success: true,
      data: pedidoDetallado
    });

  } catch (error) {
    console.error('❌ [SEGUIMIENTO] Error obteniendo detalles del pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener detalles del pedido'
    });
  }
});

// Obtener estadísticas de pedidos del vendedor
router.get('/vendedor/estadisticas', async (req, res) => {
  try {
    const vendedorId = req.user.idus;

    console.log(`📊 [SEGUIMIENTO] Obteniendo estadísticas para vendedor: ${vendedorId}`);

    const pool = await getConnection();
    
    const query = `
      SELECT 
        Estado,
        COUNT(*) as cantidad,
        SUM(Total) as total_monto
      FROM DoccabPed
      WHERE Vendedor = @vendedorId AND Eliminado = 0
      GROUP BY Estado
    `;

    const request = pool.request();
    request.input('vendedorId', sql.Int, vendedorId);

    const result = await request.query(query);

    // Formatear estadísticas usando los estados reales del sistema
    const estadisticas = {
      credito: 0,
      comercial: 0,
      porFacturar: 0,
      facturado: 0,
      porDespachar: 0,
      embalado: 0,
      reparto: 0,
      entregado: 0,
      noAtendido: 0,
      totalMonto: 0,
      totalPedidos: 0
    };

    result.recordset.forEach(row => {
      const estado = row.Estado;
      const cantidad = row.cantidad;
      const monto = row.total_monto || 0;

      switch (estado) {
        case 1:
          estadisticas.credito = cantidad;
          break;
        case 2:
          estadisticas.comercial = cantidad;
          break;
        case 3:
          estadisticas.porFacturar = cantidad;
          break;
        case 4:
          estadisticas.facturado = cantidad;
          break;
        case 5:
          estadisticas.porDespachar = cantidad;
          break;
        case 6:
          estadisticas.embalado = cantidad;
          break;
        case 7:
          estadisticas.reparto = cantidad;
          break;
        case 8:
          estadisticas.entregado = cantidad;
          break;
        case 9:
          estadisticas.noAtendido = cantidad;
          break;
      }

      estadisticas.totalMonto += monto;
      estadisticas.totalPedidos += cantidad;
    });

    // Agregar descripciones de estados para el frontend
    estadisticas.estados = Object.entries(estadosPedidos).map(([codigo, descripcion]) => ({
      codigo: parseInt(codigo),
      descripcion,
      cantidad: estadisticas[getEstadoKey(parseInt(codigo))] || 0
    }));

    console.log(`✅ [SEGUIMIENTO] Estadísticas obtenidas para vendedor ${vendedorId}`);

    res.json({
      success: true,
      data: estadisticas
    });

  } catch (error) {
    console.error('❌ [SEGUIMIENTO] Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al obtener estadísticas'
    });
  }
});

// Función helper para obtener la clave del estado
function getEstadoKey(codigo) {
  switch (codigo) {
    case 1: return 'credito';
    case 2: return 'comercial';
    case 3: return 'porFacturar';
    case 4: return 'facturado';
    case 5: return 'porDespachar';
    case 6: return 'embalado';
    case 7: return 'reparto';
    case 8: return 'entregado';
    case 9: return 'noAtendido';
    default: return 'desconocido';
  }
}


module.exports = router;
