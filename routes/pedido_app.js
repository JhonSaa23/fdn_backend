const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getConnection } = require('../database');

// Cache simple en memoria para optimizar búsquedas repetidas
const clientCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos

// Función para limpiar cache expirado
const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of clientCache.entries()) {
    if (now - value.timestamp > CACHE_EXPIRY) {
      clientCache.delete(key);
    }
  }
};

// Limpiar cache cada 2 minutos
setInterval(cleanExpiredCache, 2 * 60 * 1000);

// Buscar clientes con optimizaciones
router.get('/clientes', async (req, res) => {
  try {
    const pool = await getConnection();
    const { q: query, limit = 20 } = req.query;
    
    // Permitir límites más altos para carga completa
    const maxLimit = Math.min(parseInt(limit) || 20, 1000);
    
    // Obtener el CodigoInterno del usuario logueado desde el token
    const authHeader = req.headers.authorization;
    console.log('🔐 [CLIENTES] Auth header recibido:', authHeader ? 'Presente' : 'Ausente');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [CLIENTES] Error: Token de autorización requerido');
      return res.status(401).json({
        success: false,
        error: 'Token de autorización requerido'
      });
    }
    
    const token = authHeader.substring(7);
    console.log('🔑 [CLIENTES] Token extraído:', token.substring(0, 20) + '...');
    
    // Decodificar el token para obtener el CodigoInterno
    let codigoInterno;
    try {
      const jwtSecret = process.env.JWT_SECRET || 'tu_secret_key';
      console.log('🔐 [CLIENTES] JWT Secret configurado:', jwtSecret ? 'Sí' : 'No');
      
      const decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [CLIENTES] Token decodificado exitosamente:', decoded);
      
      codigoInterno = decoded.CodigoInterno;
      console.log('👤 [CLIENTES] CodigoInterno extraído:', codigoInterno);
      
      if (!codigoInterno) {
        console.log('❌ [CLIENTES] Error: CodigoInterno no encontrado en el token');
        return res.status(401).json({
          success: false,
          error: 'CodigoInterno no encontrado en el token'
        });
      }
    } catch (jwtError) {
      console.log('❌ [CLIENTES] Error decodificando token:', jwtError.message);
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        details: jwtError.message
      });
    }
    
    // Si no hay query, devolver clientes recientes del vendedor
    if (!query || query.trim() === '') {
    const defaultQuery = `
      SELECT TOP (@limit) 
        Codclie, 
        Razon, 
        Documento,
        Direccion
      FROM clientes 
      WHERE Razon IS NOT NULL 
        AND Razon != '' 
        AND vendedor = @codigoInterno
      ORDER BY Codclie DESC
    `;
      
      const result = await pool.request()
        .input('limit', maxLimit)
        .input('codigoInterno', codigoInterno)
        .query(defaultQuery);
      
      console.log(`📋 [CLIENTES] Carga inicial: ${result.recordset.length} clientes para vendedor: ${codigoInterno}`);
      
      return res.json({
        success: true,
        data: result.recordset,
        total: result.recordset.length,
        cached: false
      });
    }
    
    const searchTerm = query.trim().toLowerCase();
    const cacheKey = `clientes_${searchTerm}_${maxLimit}_${codigoInterno}`;
    
    // Verificar cache primero
    if (clientCache.has(cacheKey)) {
      const cached = clientCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
        console.log(`📦 Cache hit para búsqueda: "${searchTerm}" (vendedor: ${codigoInterno})`);
        return res.json({
          success: true,
          data: cached.data,
          total: cached.data.length,
          cached: true
        });
      }
    }
    
    console.log(`🔍 [CLIENTES] Búsqueda de clientes: "${searchTerm}" (limit: ${maxLimit}, vendedor: ${codigoInterno})`);
    
    // Query optimizada con índices y filtro por vendedor
    const searchQuery = `
      SELECT TOP (@limit) 
        Codclie, 
        Razon, 
        Documento,
        Direccion
      FROM clientes 
      WHERE (
        LOWER(Razon) LIKE @searchTerm 
        OR LOWER(Documento) LIKE @searchTerm
        OR LOWER(Direccion) LIKE @searchTerm
        OR Codclie LIKE @searchTerm
      )
      AND Razon IS NOT NULL 
      AND Razon != ''
      AND vendedor = @codigoInterno
      ORDER BY 
        CASE 
          WHEN LOWER(Razon) = @exactMatch THEN 1
          WHEN LOWER(Razon) LIKE @startsWith THEN 2
          WHEN LOWER(Razon) LIKE @contains THEN 3
          WHEN LOWER(Documento) LIKE @searchTerm THEN 4
          WHEN LOWER(Direccion) LIKE @searchTerm THEN 5
          ELSE 6
        END,
        Razon
    `;
    
    const result = await pool.request()
      .input('limit', maxLimit)
      .input('searchTerm', `%${searchTerm}%`)
      .input('exactMatch', searchTerm)
      .input('startsWith', `${searchTerm}%`)
      .input('contains', `%${searchTerm}%`)
      .input('codigoInterno', codigoInterno)
      .query(searchQuery);
    
    const clientes = result.recordset;
    
    // Guardar en cache
    clientCache.set(cacheKey, {
      data: clientes,
      timestamp: Date.now()
    });
    
    console.log(`✅ [CLIENTES] Encontrados ${clientes.length} clientes para: "${searchTerm}" (vendedor: ${codigoInterno})`);
    
    res.json({
      success: true,
      data: clientes,
      total: clientes.length,
      cached: false,
      searchTerm: searchTerm,
      vendedor: codigoInterno,
      limit: maxLimit
    });

  } catch (error) {
    console.error('Error al buscar clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar clientes',
      details: error.message
    });
  }
});

// Obtener cliente por código (para detalles)
router.get('/clientes/:codclie', async (req, res) => {
  try {
    const pool = await getConnection();
    const { codclie } = req.params;
    
    // Obtener el CodigoInterno del usuario logueado desde el token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de autorización requerido'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Decodificar el token para obtener el CodigoInterno
    let codigoInterno;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_secret_key');
      codigoInterno = decoded.CodigoInterno;
      
      if (!codigoInterno) {
        return res.status(401).json({
          success: false,
          error: 'CodigoInterno no encontrado en el token'
        });
      }
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido'
      });
    }
    
    const query = `
      SELECT 
        Codclie, 
        Razon, 
        Documento,
        Direccion,
        Telefono1,
        Telefono2,
        Email
      FROM clientes 
      WHERE Codclie = @codclie
        AND vendedor = @codigoInterno
    `;
    
    const result = await pool.request()
      .input('codclie', codclie)
      .input('codigoInterno', codigoInterno)
      .query(query);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el cliente',
      details: error.message
    });
  }
});

// Obtener pedidos de un cliente específico
router.get('/clientes/:codclie/pedidos', async (req, res) => {
  try {
    const pool = await getConnection();
    const { codclie } = req.params;
    const { limit = 50, estado } = req.query;
    
    let whereClause = 'd.CodClie = @codclie AND d.Eliminado = 0';
    if (estado) {
      whereClause += ' AND d.Estado = @estado';
    }
    
    const query = `
      SELECT TOP (@limit)
        d.Numero,
        d.Estado,
        d.Fecha,
        d.Total,
        d.Moneda,
        d.Observacion,
        CASE d.Estado
          WHEN 1 THEN 'Crédito'
          WHEN 2 THEN 'Comercial'
          WHEN 3 THEN 'Por Facturar'
          WHEN 4 THEN 'Facturado'
          WHEN 5 THEN 'Por Despachar'
          WHEN 6 THEN 'Embalado'
          WHEN 7 THEN 'Reparto'
          WHEN 8 THEN 'Entregado'
          WHEN 9 THEN 'No Atendido por falta de stock'
          ELSE 'Estado Desconocido'
        END as EstadoDescripcion
      FROM DoccabPed d
      WHERE ${whereClause}
      ORDER BY d.Fecha DESC
    `;
    
    const request = pool.request()
      .input('codclie', codclie)
      .input('limit', parseInt(limit));
    
    if (estado) {
      request.input('estado', parseInt(estado));
    }
    
    const result = await request.query(query);
    
    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
      cliente: codclie
    });

  } catch (error) {
    console.error('Error al obtener pedidos del cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los pedidos del cliente',
      details: error.message
    });
  }
});

// Limpiar cache manualmente (endpoint de utilidad)
router.delete('/cache', (req, res) => {
  const initialSize = clientCache.size;
  clientCache.clear();
  
  res.json({
    success: true,
    message: `Cache limpiado. Se eliminaron ${initialSize} entradas.`
  });
});

// Obtener estadísticas del cache
router.get('/cache/stats', (req, res) => {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  
  for (const [key, value] of clientCache.entries()) {
    if (now - value.timestamp < CACHE_EXPIRY) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  res.json({
    success: true,
    data: {
      totalEntries: clientCache.size,
      validEntries,
      expiredEntries,
      cacheExpiryMinutes: CACHE_EXPIRY / (60 * 1000)
    }
  });
});

// Obtener datos de tablas del sistema (tipos de documento, condiciones, etc.)
router.get('/tablas-listar/:codigoTabla', async (req, res) => {
  try {
    const pool = await getConnection();
    const { codigoTabla } = req.params;
    
    console.log(`🔍 Ejecutando sp_tablas_Listar con código: ${codigoTabla}`);
    
    // Para tipos de documento (código 3), devolver solo Factura y Boleta
    if (parseInt(codigoTabla) === 3) {
      const tiposDocumento = [
        { n_numero: 1, c_describe: 'Factura' },
        { n_numero: 2, c_describe: 'Boleta' }
      ];
      
      console.log(`✅ Tipos de documento fijos devueltos: ${tiposDocumento.length} elementos`);
      console.log(`📋 Datos:`, tiposDocumento);
      
      return res.json({
        success: true,
        data: tiposDocumento,
        total: tiposDocumento.length,
        codigoTabla: parseInt(codigoTabla)
      });
    }
    
    // Para otras tablas, usar el stored procedure normal
    const query = `EXEC sp_tablas_Listar @codigoTabla`;
    
    const result = await pool.request()
      .input('codigoTabla', parseInt(codigoTabla))
      .query(query);
    
    console.log(`✅ sp_tablas_Listar ejecutado. Registros encontrados: ${result.recordset.length}`);
    console.log(`📋 Datos:`, result.recordset);
    
    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
      codigoTabla: parseInt(codigoTabla)
    });

  } catch (error) {
    console.error('Error al ejecutar sp_tablas_Listar:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos de la tabla',
      details: error.message,
      codigoTabla: req.params.codigoTabla
    });
  }
});

// =====================================================
// BÚSQUEDA DE PRODUCTOS CON SALDOS
// =====================================================

/**
 * GET /api/pedido_app/productos
 * Busca productos con saldos disponibles
 * Query params: search (opcional), limit (opcional, default 50)
 */
router.get('/productos', async (req, res) => {
  try {
    const pool = await getConnection();
    const { search = '', limit = 50 } = req.query;
    
    console.log(`🔍 Búsqueda de productos - Término: "${search}", Límite: ${limit}`);
    
    // Construir la consulta base
    let query = `
      SELECT TOP (${parseInt(limit)})
          s.codpro,
          p.nombre AS nombre_producto,
          p.PventaMa as Pventa,
          p.ComisionH AS Desc1,
          p.comisionV AS Desc2,
          p.comisionR AS Desc3,
          SUM(s.saldo) AS saldo_total
      FROM
          saldos s
      JOIN
          productos p ON s.codpro = p.codpro
      WHERE
          s.almacen <> '3'
    `;
    
    // Agregar filtro de búsqueda si se proporciona
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query += `
          AND (
              p.nombre LIKE @searchTerm
              OR CAST(s.codpro AS VARCHAR) LIKE @searchTerm
          )
      `;
    }
    
    query += `
      GROUP BY
          s.codpro,
          p.nombre,
          p.PventaMa,
          p.ComisionH,
          p.comisionV,
          p.comisionR
      ORDER BY
          saldo_total DESC
    `;
    
    console.log(`📋 Query SQL:`, query);
    
    const request = pool.request();
    
    // Agregar parámetro de búsqueda si existe
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      request.input('searchTerm', searchTerm);
      console.log(`🔍 Parámetro de búsqueda: "${searchTerm}"`);
    }
    
    const result = await request.query(query);
    
    console.log(`✅ Productos encontrados: ${result.recordset.length}`);
    console.log(`📦 Primeros 3 productos:`, result.recordset.slice(0, 3));
    
    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
      search: search,
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('Error al buscar productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar productos',
      details: error.message
    });
  }
});

/**
 * GET /api/pedido_app/productos/:codpro
 * Obtiene un producto específico por código
 */
router.get('/productos/:codpro', async (req, res) => {
  try {
    const pool = await getConnection();
    const { codpro } = req.params;
    
    console.log(`🔍 Buscando producto específico: ${codpro}`);
    
    const query = `
      SELECT TOP (1)
          s.codpro,
          p.nombre AS nombre_producto,
          p.PventaMa as Pventa,
          p.ComisionH AS Desc1,
          p.comisionV AS Desc2,
          p.comisionR AS Desc3,
          SUM(s.saldo) AS saldo_total
      FROM
          saldos s
      JOIN
          productos p ON s.codpro = p.codpro
      WHERE
          s.almacen <> '3'
          AND s.codpro = @codpro
      GROUP BY
          s.codpro,
          p.nombre,
          p.PventaMa,
          p.ComisionH,
          p.comisionV,
          p.comisionR
      ORDER BY
          saldo_total DESC
    `;
    
    const result = await pool.request()
      .input('codpro', codpro)
      .query(query);
    
    if (result.recordset.length > 0) {
      console.log(`✅ Producto encontrado: ${result.recordset[0].nombre_producto}`);
      res.json({
        success: true,
        data: result.recordset[0],
        found: true
      });
    } else {
      console.log(`❌ Producto no encontrado: ${codpro}`);
      res.json({
        success: true,
        data: null,
        found: false,
        message: 'Producto no encontrado'
      });
    }

  } catch (error) {
    console.error('Error al buscar producto específico:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar producto',
      details: error.message
    });
  }
});

/**
 * GET /api/pedido_app/productos-test
 * Ruta de prueba para verificar la consulta base sin filtros
 */
router.get('/productos-test', async (req, res) => {
  try {
    const pool = await getConnection();
    
    console.log('🧪 Probando consulta base de productos...');
    
    const query = `
      SELECT TOP 10
          s.codpro,
          p.nombre AS nombre_producto,
          p.PventaMa as Pventa,
          p.ComisionH AS Desc1,
          p.comisionV AS Desc2,
          p.comisionR AS Desc3,
          SUM(s.saldo) AS saldo_total
      FROM
          saldos s
      JOIN
          productos p ON s.codpro = p.codpro
      WHERE
          s.almacen <> '3'
      GROUP BY
          s.codpro,
          p.nombre,
          p.PventaMa,
          p.ComisionH,
          p.comisionV,
          p.comisionR
      ORDER BY
          saldo_total DESC
    `;
    
    console.log('📋 Query de prueba:', query);
    
    const result = await pool.request().query(query);
    
    console.log(`✅ Productos encontrados en prueba: ${result.recordset.length}`);
    console.log(`📦 Primeros 3 productos:`, result.recordset.slice(0, 3));
    
    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
      test: true
    });

  } catch (error) {
    console.error('❌ Error en prueba de productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error en prueba de productos',
      details: error.message
    });
  }
});

module.exports = router;
