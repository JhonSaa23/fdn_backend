const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { getConnection } = require('../database');

// Cache simple en memoria para optimizar búsquedas repetidas
const clientCache = new Map();
const escalasCache = new Map();
const tipificacionCache = new Map();
const descuentoCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos

// Cache global de clientes por vendedor (carga completa)
const clientesCompletosCache = new Map();
const CLIENTES_CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutos

// Función helper para cache con TTL
function getFromCache(cache, key, ttl = 300000) { // 5 minutos por defecto
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < ttl) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(cache, key, data, ttl = 300000) {
  cache.set(key, {
    data: data,
    timestamp: Date.now()
  });
}

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

// Cargar todos los clientes del vendedor en cache (UNA SOLA VEZ)
router.get('/clientes/load', async (req, res) => {
  try {
    // Obtener el parámetro force_reload del query string
    const forceReload = req.query.force_reload === 'true';
    
    // Obtener el CodigoInterno del usuario logueado desde el token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [CLIENTES-LOAD] Error: Token de autorización requerido');
      return res.status(401).json({
        success: false,
        error: 'Token de autorización requerido'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Decodificar el token para obtener el CodigoInterno
    let codigoInterno;
    try {
      const jwtSecret = process.env.JWT_SECRET || 'tu_secret_key';
      const decoded = jwt.verify(token, jwtSecret);
      codigoInterno = decoded.CodigoInterno;
      
      if (!codigoInterno) {
        console.log('❌ [CLIENTES-LOAD] Error: CodigoInterno no encontrado en el token');
        return res.status(401).json({
          success: false,
          error: 'CodigoInterno no encontrado en el token'
        });
      }
    } catch (jwtError) {
      console.log('❌ [CLIENTES-LOAD] Error decodificando token:', jwtError.message);
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        details: jwtError.message
      });
    }
    
    // Verificar si ya está en cache (solo si NO se fuerza la recarga)
    const cacheKey = `clientes_completos_${codigoInterno}`;
    if (!forceReload && clientesCompletosCache.has(cacheKey)) {
      const cached = clientesCompletosCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CLIENTES_CACHE_EXPIRY) {
        console.log(`✅ [CLIENTES-LOAD] Clientes ya cargados en cache: ${cached.data.length}`);
        return res.json({
          success: true,
          data: cached.data,
          total: cached.data.length,
          cached: true,
          message: 'Clientes ya cargados en cache'
        });
      }
    }
    
    // Si se fuerza la recarga, limpiar el cache primero
    if (forceReload) {
      clientesCompletosCache.delete(cacheKey);
      console.log(`🗑️ [CLIENTES-LOAD] Cache limpiado por force_reload para vendedor: ${codigoInterno}`);
    }
    
    // Cargar desde stored procedure
    const pool = await getConnection();
    const loadType = forceReload ? 'RECARGA FORZADA' : 'carga normal';
    console.log(`🔄 [CLIENTES-LOAD] Cargando clientes (${loadType}) para vendedor: ${codigoInterno}`);
    
    const result = await pool.request()
      .input('CodigoInterno', codigoInterno)
      .execute('ClientesPorVendedor');
    
    const clientes = result.recordset;
    
    // Guardar en cache
    clientesCompletosCache.set(cacheKey, {
      data: clientes,
      timestamp: Date.now()
    });
    
    console.log(`✅ [CLIENTES-LOAD] Clientes cargados exitosamente (${loadType}): ${clientes.length}`);
    
    res.json({
      success: true,
      data: clientes,
      total: clientes.length,
      cached: false,
      forceReload: forceReload,
      message: forceReload ? 'Clientes recargados desde servidor' : 'Clientes cargados exitosamente'
    });

  } catch (error) {
    console.error('❌ [CLIENTES-LOAD] Error cargando clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cargar clientes',
      details: error.message
    });
  }
});

// Buscar clientes (FILTRADO EN MEMORIA - INSTANTÁNEO)
router.get('/clientes', async (req, res) => {
  try {
    const { q: query, limit = 50 } = req.query;
    const maxLimit = parseInt(limit) || 50;
    
    // Obtener el CodigoInterno del usuario logueado desde el token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [CLIENTES] Error: Token de autorización requerido');
      return res.status(401).json({
        success: false,
        error: 'Token de autorización requerido'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Decodificar el token para obtener el CodigoInterno
    let codigoInterno;
    try {
      const jwtSecret = process.env.JWT_SECRET || 'tu_secret_key';
      const decoded = jwt.verify(token, jwtSecret);
      codigoInterno = decoded.CodigoInterno;
      
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
    
    // Obtener clientes desde cache
    const cacheKey = `clientes_completos_${codigoInterno}`;
    const cached = clientesCompletosCache.get(cacheKey);
    
    if (!cached || Date.now() - cached.timestamp > CLIENTES_CACHE_EXPIRY) {
      console.log('⚠️ [CLIENTES] Cache expirado o no existe, necesita cargar clientes primero');
      return res.status(400).json({
        success: false,
        error: 'Clientes no cargados en cache. Use /clientes/load primero',
        message: 'Debe cargar los clientes primero usando el endpoint /clientes/load'
      });
    }
    
    let clientes = cached.data;
    
    // Si no hay query, devolver clientes recientes
    if (!query || query.trim() === '') {
      const clientesRecientes = clientes.slice(0, maxLimit);
      return res.json({
        success: true,
        data: clientesRecientes,
        total: clientesRecientes.length,
        cached: true,
        source: 'memory_cache'
      });
    }
    
    // Filtrar en memoria (INSTANTÁNEO)
    const searchTerm = query.trim().toLowerCase();
    console.log(`🔍 [CLIENTES] Filtrando en memoria: "${searchTerm}"`);
    
    const clientesFiltrados = clientes.filter(cliente => 
      cliente.Razon.toLowerCase().includes(searchTerm) ||
      cliente.Codclie.toLowerCase().includes(searchTerm) ||
      cliente.Documento.toLowerCase().includes(searchTerm) ||
      cliente.Direccion.toLowerCase().includes(searchTerm)
    );
    
    // Aplicar límite
    const resultado = clientesFiltrados.slice(0, maxLimit);
    
    console.log(`✅ [CLIENTES] Filtrado completado: ${resultado.length} de ${clientes.length} clientes`);
    
    res.json({
      success: true,
      data: resultado,
      total: resultado.length,
      totalDisponibles: clientes.length,
      cached: true,
      source: 'memory_filter',
      searchTerm: searchTerm,
      vendedor: codigoInterno
    });

  } catch (error) {
    console.error('❌ [CLIENTES] Error filtrando clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al filtrar clientes',
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
  const clientesSize = clientesCompletosCache.size;
  
  clientCache.clear();
  clientesCompletosCache.clear();
  
  res.json({
    success: true,
    message: `Cache limpiado. Se eliminaron ${initialSize} entradas de búsquedas y ${clientesSize} entradas de clientes completos.`
  });
});

// Limpiar cache de clientes específicamente
router.delete('/clientes/cache', (req, res) => {
  const initialSize = clientesCompletosCache.size;
  clientesCompletosCache.clear();
  
  res.json({
    success: true,
    message: `Cache de clientes limpiado. Se eliminaron ${initialSize} entradas.`
  });
});

// Obtener estadísticas del cache
router.get('/cache/stats', (req, res) => {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  
  // Estadísticas del cache de búsquedas
  for (const [key, value] of clientCache.entries()) {
    if (now - value.timestamp < CACHE_EXPIRY) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  // Estadísticas del cache de clientes completos
  let clientesValidEntries = 0;
  let clientesExpiredEntries = 0;
  
  for (const [key, value] of clientesCompletosCache.entries()) {
    if (now - value.timestamp < CLIENTES_CACHE_EXPIRY) {
      clientesValidEntries++;
    } else {
      clientesExpiredEntries++;
    }
  }
  
  res.json({
    success: true,
    data: {
      busquedas: {
        totalEntries: clientCache.size,
        validEntries,
        expiredEntries,
        cacheExpiryMinutes: CACHE_EXPIRY / (60 * 1000)
      },
      clientesCompletos: {
        totalEntries: clientesCompletosCache.size,
        validEntries: clientesValidEntries,
        expiredEntries: clientesExpiredEntries,
        cacheExpiryMinutes: CLIENTES_CACHE_EXPIRY / (60 * 1000)
      }
    }
  });
});

// Obtener datos de tablas del sistema (tipos de documento, condiciones, etc.)
router.get('/tablas-listar/:codigoTabla', async (req, res) => {
  try {
    const pool = await getConnection();
    const { codigoTabla } = req.params;
    
    
    // Para tipos de documento (código 3), devolver solo Factura y Boleta
    if (parseInt(codigoTabla) === 3) {
      const tiposDocumento = [
        { n_numero: 1, c_describe: 'Factura' },
        { n_numero: 2, c_describe: 'Boleta' }
      ];
      
      
      return res.json({
        success: true,
        data: tiposDocumento,
        total: tiposDocumento.length,
        codigoTabla: parseInt(codigoTabla)
      });
    }
    
    // Para otras tablas, usar el stored procedure normal
    const result = await pool.request()
      .input('codigo', parseInt(codigoTabla))
      .execute('sp_tablas_Listar');
    
    
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
// CONFIGURACIÓN GENERAL (IGV, etc.)
// =====================================================

/**
 * GET /api/pedido_app/configuracion
 * Obtiene la configuración general del sistema (IGV, etc.)
 */
router.get('/configuracion', async (req, res) => {
  try {
    const pool = await getConnection();
    
    
    // Consulta optimizada para obtener el IGV
    const query = `
      SELECT c_valor, n_valor 
      FROM Valores 
      WHERE c_valor = 'Igv'
    `;
    
    const result = await pool.request().query(query);
    
    if (result.recordset.length > 0) {
      const igvData = result.recordset[0];
      const igv = parseFloat(igvData.n_valor) || 0;
      
      
      res.json({
        success: true,
        data: {
          igv: igv,
          igvPorcentaje: igv,
          igvDecimal: igv / 100
        },
        message: 'Configuración obtenida exitosamente'
      });
    } else {
      console.log('⚠️ [CONFIG] IGV no encontrado en la base de datos');
      res.json({
        success: true,
        data: {
          igv: 18,
          igvPorcentaje: 18,
          igvDecimal: 0.18
        },
        message: 'IGV no encontrado, usando valor por defecto: 18%'
      });
    }
    
  } catch (error) {
    console.error('❌ [CONFIG] Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener configuración',
      details: error.message
    });
  }
});

// =====================================================
// DESCUENTOS POR LABORATORIO Y TIPIFICACIÓN
// =====================================================

router.get('/cliente-tipificacion/:labo/:ruc', async (req, res) => {
  try {
    const { labo, ruc } = req.params;
    
    // Verificar cache primero
    const cacheKey = `tipificacion_${labo}_${ruc}`;
    const cachedData = getFromCache(tipificacionCache, cacheKey);
    
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        message: 'Tipificación obtenida desde cache'
      });
    }
    
    const pool = await getConnection();
    
    // Usar el procedimiento almacenado como especificaste
    const result = await pool.request()
      .input('labo', labo)
      .input('ruc', ruc)
      .execute('sp_cliente_tipificacion');
    
    if (result.recordset.length > 0) {
      const tipificacion = result.recordset[0].tipificacion;
      const data = { tipificacion: tipificacion };
      
      
      // Guardar en cache por 15 minutos (tipificaciones cambian poco)
      setCache(tipificacionCache, cacheKey, data, 900000);
      
      res.json({
        success: true,
        data: data,
        message: 'Tipificación obtenida exitosamente'
      });
    } else {
      
      const data = { tipificacion: null };
      
      // Cachear resultado negativo por 5 minutos
      setCache(tipificacionCache, cacheKey, data, 300000);
      
      res.json({
        success: true,
        data: data,
        message: 'No se encontró tipificación para este cliente y laboratorio'
      });
    }
  } catch (error) {
    console.error('❌ [TIPIFICACION] Error ejecutando sp_cliente_tipificacion:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipificación',
      details: error.message
    });
  }
});

// =====================================================
// DESCUENTOS POR LABORATORIO Y TIPIFICACIÓN - TODOS LOS RANGOS
// =====================================================

router.get('/descuento-laboratorio-rangos/:tipifica/:codpro', async (req, res) => {
  try {
    const { tipifica, codpro } = req.params;
    
    // Verificar cache primero
    const cacheKey = `descuento_rangos_${tipifica}_${codpro}`;
    const cachedData = getFromCache(descuentoCache, cacheKey);
    
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        message: 'Rangos de descuento obtenidos desde cache'
      });
    }
    
    const pool = await getConnection();
    console.log(`🔍 [DESCUENTO-RANGOS] Ejecutando sp_Descuento_labo_buscaY para tipificación: ${tipifica}, producto: ${codpro}`);
    
    // Usar el procedimiento almacenado para obtener TODOS los rangos
    const result = await pool.request()
      .input('tipifica', parseInt(tipifica))
      .input('cod', codpro)
      .execute('sp_Descuento_labo_buscaY');
    
    if (result.recordset.length > 0) {
      const escalas = result.recordset;
      console.log(`📊 [DESCUENTO-RANGOS] Rangos encontrados:`, escalas.map(e => `Desde: ${e.Desde}, Descuento: ${e.Porcentaje}%`));
      
      // Ordenar por cantidad desde (ascendente) para facilitar el cálculo
      const escalasOrdenadas = escalas.sort((a, b) => parseFloat(a.Desde) - parseFloat(b.Desde));
      
      // Crear estructura de datos optimizada para cálculos rápidos
      const rangosDescuento = {
        escalas: escalasOrdenadas
      };
      
      console.log(`✅ [DESCUENTO-RANGOS] Rangos procesados para tipificación: ${tipifica}, producto: ${codpro}`);
      
      // Guardar en cache por 10 minutos (más tiempo porque son datos más estables)
      setCache(descuentoCache, cacheKey, rangosDescuento, 600000);
      
      res.json({
        success: true,
        data: rangosDescuento,
        message: 'Rangos de descuento obtenidos exitosamente'
      });
    } else {
      console.log(`⚠️ [DESCUENTO-RANGOS] No se encontraron rangos para tipificación: ${tipifica}, producto: ${codpro}`);
      
      // Cachear resultado negativo por 5 minutos
      setCache(descuentoCache, cacheKey, null, 300000);
      
      res.json({
        success: true,
        data: null,
        message: 'No se encontraron rangos de descuento para este producto'
      });
    }
  } catch (error) {
    console.error('❌ [DESCUENTO-RANGOS] Error ejecutando sp_Descuento_labo_buscaY:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener rangos de descuento de laboratorio',
      details: error.message
    });
  }
});

// =====================================================
// DESCUENTOS POR LABORATORIO Y TIPIFICACIÓN - CANTIDAD ESPECÍFICA (MANTENER COMPATIBILIDAD)
// =====================================================

router.get('/descuento-laboratorio/:tipifica/:codpro/:cantidad', async (req, res) => {
  try {
    const { tipifica, codpro, cantidad } = req.params;
    
    // Verificar cache primero
    const cacheKey = `descuento_${tipifica}_${codpro}_${cantidad}`;
    const cachedData = getFromCache(descuentoCache, cacheKey);
    
    if (cachedData) {
      console.log(`✅ [CACHE-DESCUENTO] Descuento desde cache para tipificación: ${tipifica}, producto: ${codpro}, cantidad: ${cantidad}`);
      return res.json({
        success: true,
        data: cachedData,
        message: 'Descuento obtenido desde cache'
      });
    }
    
    const pool = await getConnection();
    console.log(`🔍 [DESCUENTO-LAB] Ejecutando sp_Descuento_labo_buscaY para tipificación: ${tipifica}, producto: ${codpro}, cantidad: ${cantidad}`);
    
    // Usar el procedimiento almacenado como especificaste
    const result = await pool.request()
      .input('tipifica', parseInt(tipifica))
      .input('cod', codpro)
      .execute('sp_Descuento_labo_buscaY');
    
    if (result.recordset.length > 0) {
      // Buscar la escala de descuento apropiada basada en la cantidad
      const escalas = result.recordset;
      console.log(`📊 [DESCUENTO-LAB] Escalas encontradas:`, escalas.map(e => `Desde: ${e.Desde}, Descuento: ${e.Porcentaje}%`));
      
      // Ordenar por cantidad desde (descendente) para encontrar la escala apropiada
      const escalasOrdenadas = escalas.sort((a, b) => parseFloat(b.Desde) - parseFloat(a.Desde));
      
      const cantidadNumerica = parseFloat(cantidad);
      let descuentoAplicable = null;
      
      // Encontrar la escala que corresponde a la cantidad
      for (const escala of escalasOrdenadas) {
        if (cantidadNumerica >= parseFloat(escala.Desde)) {
          descuentoAplicable = escala;
          break;
        }
      }
      
      if (descuentoAplicable) {
        console.log(`✅ [DESCUENTO-LAB] Descuento aplicable: ${descuentoAplicable.Porcentaje}% para cantidad ${cantidad} (escala desde ${descuentoAplicable.Desde})`);
        
        // Guardar en cache por 5 minutos
        setCache(descuentoCache, cacheKey, descuentoAplicable, 300000);
        
        res.json({
          success: true,
          data: descuentoAplicable,
          message: 'Descuento de laboratorio obtenido exitosamente'
        });
      } else {
        console.log(`⚠️ [DESCUENTO-LAB] No hay descuento aplicable para cantidad ${cantidad}. Escala mínima: ${Math.min(...escalas.map(e => parseFloat(e.Desde)))}`);
        
        // Cachear resultado negativo por 2 minutos
        setCache(descuentoCache, cacheKey, null, 120000);
        
        res.json({
          success: true,
          data: null,
          message: 'No hay descuento aplicable para esta cantidad'
        });
      }
    } else {
      console.log(`⚠️ [DESCUENTO-LAB] No se encontró descuento para tipificación: ${tipifica}, producto: ${codpro}`);
      
      // Cachear resultado negativo por 2 minutos
      setCache(descuentoCache, cacheKey, null, 120000);
      
      res.json({
        success: true,
        data: null,
        message: 'No se encontró descuento de laboratorio para este producto'
      });
    }
  } catch (error) {
    console.error('❌ [DESCUENTO-LAB] Error ejecutando sp_Descuento_labo_buscaY:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener descuento de laboratorio',
      details: error.message
    });
  }
});

// =====================================================
// BONIFICACIONES DE PRODUCTOS (TABLA DIRECTA)
// =====================================================
router.get('/bonificaciones/:codpro', async (req, res) => {
  try {
    const { codpro } = req.params;
    
    console.log(`🔍 [BONIFICACION] Buscando bonificaciones para producto: ${codpro}`);
    
    const pool = await getConnection();
    
    // Buscar en la tabla Bonificaciones directamente
    const result = await pool.request()
      .input('codpro', codpro.trim())
      .query(`
        SELECT Codproducto, Factor, CodBoni, Cantidad 
        FROM Bonificaciones 
        WHERE Codproducto = @codpro
      `);
    
    if (result.recordset.length > 0) {
      const bonificacion = result.recordset[0];
      console.log(`✅ [BONIFICACION] Bonificación encontrada: Factor ${bonificacion.Factor}, Producto bonificado: ${bonificacion.CodBoni}, Cantidad: ${bonificacion.Cantidad}`);
      
      // Obtener datos del producto bonificado
      const productoBonificadoResult = await pool.request()
        .input('codpro', bonificacion.CodBoni.trim())
        .query(`
          SELECT 
            p.codpro,
            p.nombre AS nombre_producto,
            p.PventaMa as Pventa,
            p.ComisionH AS Desc1,
            p.comisionV AS Desc2,
            p.comisionR AS Desc3,
            CAST(p.afecto AS INT) AS afecto,
            ISNULL(SUM(s.saldo), 0) AS saldo_total
          FROM productos p
          LEFT JOIN saldos s ON p.codpro = s.codpro AND s.almacen <> '3'
          WHERE p.codpro = @codpro
          GROUP BY p.codpro, p.nombre, p.PventaMa, p.ComisionH, p.comisionV, p.comisionR, CAST(p.afecto AS INT)
        `);
      
      if (productoBonificadoResult.recordset.length > 0) {
        const productoBonificado = productoBonificadoResult.recordset[0];
        
        const bonificacionData = {
          factor: bonificacion.Factor,
          cantidadBonificada: bonificacion.Cantidad,
          productoBonificado: productoBonificado,
          esBonificacion: true
        };
        
        res.json({ success: true, data: bonificacionData, message: 'Bonificación encontrada exitosamente' });
      } else {
        console.log('⚠️ [BONIFICACION] No se encontró el producto bonificado en la base de datos');
        res.json({ success: true, data: null, message: 'Producto bonificado no encontrado' });
      }
    } else {
      console.log('⚠️ [BONIFICACION] No hay bonificación disponible para producto: ' + codpro);
      res.json({ success: true, data: null, message: 'No hay bonificación disponible' });
    }
    
  } catch (error) {
    console.error('❌ [BONIFICACION] Error obteniendo bonificación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener bonificación',
      details: error.message,
      codpro: req.params.codpro
    });
  }
});

// =====================================================
// ESCALAS DE DESCUENTOS POR PRODUCTO
// =====================================================

router.get('/escalas-producto/:codpro', async (req, res) => {
  try {
    const { codpro } = req.params;
    
    // Verificar cache primero
    const cacheKey = `escalas_${codpro}`;
    const cachedData = getFromCache(escalasCache, cacheKey);
    
    if (cachedData) {
      console.log(`✅ [CACHE-ESCALAS] Escalas desde cache para producto: ${codpro}`);
      return res.json({
        success: true,
        data: cachedData,
        message: 'Escalas obtenidas desde cache'
      });
    }
    
    const pool = await getConnection();
    console.log(`🔍 [ESCALAS-PRODUCTO] Ejecutando sp_Escalas_Buscar1 para producto: ${codpro}`);
    
    // Usar el procedimiento almacenado como especificaste
    const result = await pool.request()
      .input('Codpro', codpro)
      .execute('sp_Escalas_Buscar1');
    
    if (result.recordset.length > 0) {
      const escalas = result.recordset[0];
      console.log(`✅ [ESCALAS-PRODUCTO] Escalas encontradas para producto: ${codpro}`);
      console.log(`📊 [ESCALAS-PRODUCTO] Rangos: ${escalas.Rango1}, ${escalas.Rango2}, ${escalas.Rango3}, ${escalas.Rango4}, ${escalas.Rango5}`);
      
      // Guardar en cache por 10 minutos
      setCache(escalasCache, cacheKey, escalas, 600000);
      
      res.json({
        success: true,
        data: escalas,
        message: 'Escalas de descuentos obtenidas exitosamente'
      });
    } else {
      console.log(`⚠️ [ESCALAS-PRODUCTO] No se encontraron escalas para producto: ${codpro}`);
      
      // Cachear resultado negativo por 2 minutos
      setCache(escalasCache, cacheKey, null, 120000);
      
      res.json({
        success: true,
        data: null,
        message: 'No se encontraron escalas de descuentos para este producto'
      });
    }
  } catch (error) {
    console.error('❌ [ESCALAS-PRODUCTO] Error ejecutando sp_Escalas_Buscar1:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener escalas de descuentos del producto',
      details: error.message
    });
  }
});

// =====================================================
// BÚSQUEDA DE PRODUCTOS CON SALDOS
// =====================================================

/**
 * GET /api/pedido_app/productos
 * Busca productos usando stored procedure Jhon_Producto_BasicoOptimizado
 * Query params: search (opcional), limit (opcional, default 50)
 */
router.get('/productos', async (req, res) => {
  try {
    const pool = await getConnection();
    const { search = '', limit = 50 } = req.query;
    
    console.log(`🔍 [PRODUCTOS] Búsqueda de productos - Término: "${search}" usando SP Jhon_Producto_BasicoOptimizado`);
    
    // Usar el stored procedure Jhon_Producto_BasicoOptimizado
    const result = await pool.request()
      .execute('Jhon_Producto_BasicoOptimizado');
    
    let productos = result.recordset;
    
    // Mapear campos para compatibilidad con frontend
    productos = productos.map(producto => ({
      ...producto,
      nombre_producto: producto.nombre, // Mapear nombre a nombre_producto
      codpro: producto.codpro?.trim(), // Limpiar espacios
      nombre: producto.nombre?.trim() // Limpiar espacios
    }));
    
    // Aplicar filtro de búsqueda si se proporciona
    if (search && search.trim() !== '') {
      const searchTerm = search.trim().toLowerCase();
      productos = productos.filter(producto => 
        producto.nombre.toLowerCase().includes(searchTerm) ||
        producto.codpro.toLowerCase().includes(searchTerm)
      );
      console.log(`🔍 Filtro aplicado: "${searchTerm}" - Productos filtrados: ${productos.length}`);
    }
    
    // Aplicar límite si se especifica
    if (limit && parseInt(limit) > 0) {
      productos = productos.slice(0, parseInt(limit));
    }
    
    console.log(`✅ Productos encontrados: ${productos.length}`);
    console.log(`📦 [PRODUCTOS] Primeros 3 productos:`, productos.slice(0, 3));
    console.log(`✅ [PRODUCTOS] Productos obtenidos con SP: ${productos.length}`);
    
    res.json({
      success: true,
      data: productos,
      total: productos.length,
      search: search,
      limit: parseInt(limit),
      source: 'Jhon_Producto_BasicoOptimizado'
    });

  } catch (error) {
    console.error('❌ [PRODUCTOS] Error al buscar productos con SP:', error);
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
    const { ruc, cantidad = 1 } = req.query; // Parámetros opcionales para el procedimiento
    
    console.log(`🔍 Buscando producto específico: ${codpro} con RUC: ${ruc}, cantidad: ${cantidad}`);
    
    // Si tenemos RUC, usar el procedimiento unificado
    if (ruc) {
      try {
        const sp = await pool.request()
          .input('ruc', ruc)
          .input('codpro', codpro)
          .input('cantidad', cantidad)
          .execute('Jhon_ProductoCalculos');

        const row = sp.recordset?.[0];
        if (row) {
          // Usar bonificaciones del procedimiento unificado
          let bonificaciones = null;
          if (row.bonificaciones) {
            try {
              bonificaciones = JSON.parse(row.bonificaciones);
              console.log(`✅ [BONIFICACION] Bonificaciones del procedimiento: ${bonificaciones.length} opciones`);
            } catch (e) {
              console.error('❌ [BONIFICACION] Error parseando bonificaciones del procedimiento:', e);
            }
          }
          
          // Para compatibilidad con el frontend, usar la primera bonificación aplicable
          let boni = null;
          if (bonificaciones && bonificaciones.length > 0) {
            const bonificacionAplicable = bonificaciones.find(b => b.Aplicable === true);
            if (bonificacionAplicable) {
              boni = {
                Codproducto: bonificacionAplicable.CodBoni,
                Factor: bonificacionAplicable.Factor,
                CodBoni: bonificacionAplicable.CodBoni,
                Cantidad: bonificacionAplicable.Cantidad
              };
              console.log(`✅ [BONIFICACION] Bonificación aplicable encontrada: Factor ${bonificacionAplicable.Factor}`);
            }
          }

          console.log(`✅ Producto encontrado con procedimiento unificado: ${row.nombre}`);
          return res.json({
            success: true,
            data: {
              codpro: row.codpro,
              nombre_producto: row.nombre,
              Pventa: row.Pventa,
              Desc1: row.Desc1,
              Desc2: row.Desc2,
              Desc3: row.Desc3,
              afecto: row.afecto,
              saldo_total: 0, // El procedimiento no incluye saldo, usar consulta separada si es necesario
              // Datos adicionales del procedimiento
              tipificacion: row.tipificacion,
              rangosTipificacion: row.tipifRangos ? JSON.parse(row.tipifRangos) : null,
              escalas: {
                Rango1: row.R1, Rango2: row.R2, Rango3: row.R3, Rango4: row.R4, Rango5: row.R5,
                rangoUsado: row.escalaRango,
                rangosCompletos: row.escalasRangos ? JSON.parse(row.escalasRangos) : null,
              },
              bonificacion: boni,
              bonificaciones: bonificaciones, // Todas las bonificaciones disponibles
            },
            found: true,
            source: 'sp_unificado'
          });
        }
      } catch (e) {
        console.error('⚠️ [UNIFICADO] SP unificado falló, usando consulta básica:', e.message);
        // Continúa con la consulta básica
      }
    }
    
    // Consulta básica (fallback o cuando no hay RUC)
    const query = `
      SELECT TOP (1)
          s.codpro,
          p.nombre AS nombre_producto,
          p.PventaMa as Pventa,
          p.ComisionH AS Desc1,
          p.comisionV AS Desc2,
          p.comisionR AS Desc3,
          CAST(p.afecto AS INT) AS afecto,
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
          p.comisionR,
          CAST(p.afecto AS INT)
      ORDER BY
          saldo_total DESC
    `;
    
    const result = await pool.request()
      .input('codpro', codpro)
      .query(query);
    
    if (result.recordset.length > 0) {
      console.log(`✅ Producto encontrado con consulta básica: ${result.recordset[0].nombre_producto}`);
      res.json({
        success: true,
        data: result.recordset[0],
        found: true,
        source: 'consulta_basica'
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
 * GET /api/pedido_app/productos-debug/:codpro
 * Ruta de debug para verificar datos de un producto específico (SIN AUTENTICACIÓN)
 */
router.get('/productos-debug/:codpro', async (req, res) => {
  try {
    const pool = await getConnection();
    const { codpro } = req.params;
    
    console.log(`🔍 [DEBUG] Verificando datos del producto: ${codpro}`);
    
    // Consulta directa a la tabla productos
    const queryProducto = `
      SELECT 
        codpro,
        nombre,
        PventaMa,
        ComisionH,
        comisionV,
        comisionR,
        afecto
      FROM productos 
      WHERE codpro = @codpro
    `;
    
    const resultProducto = await pool.request()
      .input('codpro', codpro)
      .query(queryProducto);
    
    // Consulta de saldos
    const querySaldos = `
      SELECT 
        codpro,
        almacen,
        saldo
      FROM saldos 
      WHERE codpro = @codpro
    `;
    
    const resultSaldos = await pool.request()
      .input('codpro', codpro)
      .query(querySaldos);
    
    console.log(`📦 [DEBUG] Datos del producto:`, resultProducto.recordset);
    console.log(`📦 [DEBUG] Saldos del producto:`, resultSaldos.recordset);
    
    res.json({
      success: true,
      data: {
        producto: resultProducto.recordset[0] || null,
        saldos: resultSaldos.recordset,
        totalSaldos: resultSaldos.recordset.length
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error verificando producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar producto',
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
    
    const query = `
      SELECT TOP 10
          s.codpro,
          p.nombre AS nombre_producto,
          p.PventaMa as Pventa,
          p.ComisionH AS Desc1,
          p.comisionV AS Desc2,
          p.comisionR AS Desc3,
          CAST(p.afecto AS INT) AS afecto,
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
          p.comisionR,
          CAST(p.afecto AS INT)
      ORDER BY
          saldo_total DESC
    `;
    
    const result = await pool.request().query(query);
    
    
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

// Endpoint para obtener descuentos específicos del cliente usando sp_Desclie_Buscar1
router.get('/descuentos-cliente/:ruc/:codpro', async (req, res) => {
  try {
    const { ruc, codpro } = req.params;
    const pool = await getConnection();
    
    console.log(`🔍 [DESCUENTOS-CLIENTE] Obteniendo descuentos específicos para RUC: ${ruc}, Producto: ${codpro}`);
    
    const request = pool.request();
    request.input('RuClie', ruc);
    request.input('codpro', codpro);
    
    const result = await request.execute('sp_Desclie_Buscar1');
    
    if (result.recordset && result.recordset.length > 0) {
      const descuentoCliente = result.recordset[0];
      const descuentosEspecificos = {
        ruc: descuentoCliente.Ruclie,
        razon: descuentoCliente.Razon,
        producto: descuentoCliente.Producto,
        nombre: descuentoCliente.Nombre,
        Descuento1: descuentoCliente.Descuento1 || 0,
        Descuento2: descuentoCliente.Descuento2 || 0,
        Descuento3: descuentoCliente.Descuento3 || 0,
        Reemplazo: descuentoCliente.Reemplazo
      };
      
      console.log(`✅ [DESCUENTOS-CLIENTE] Descuentos específicos obtenidos:`, descuentosEspecificos);
      
      res.json({
        success: true,
        data: descuentosEspecificos
      });
    } else {
      console.log(`⚠️ [DESCUENTOS-CLIENTE] No se encontraron descuentos específicos para RUC: ${ruc}, Producto: ${codpro}`);
      res.json({
        success: false,
        message: 'No se encontraron descuentos específicos para este cliente y producto'
      });
    }

  } catch (error) {
    console.error('❌ [DESCUENTOS-CLIENTE] Error obteniendo descuentos específicos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener descuentos específicos del cliente',
      details: error.message
    });
  }
});

// Endpoint para obtener descuentos básicos del producto usando sp_Productos_buscaxcuenta
router.get('/producto-descuentos-basicos/:codpro', async (req, res) => {
  try {
    const { codpro } = req.params;
    const pool = await getConnection();
    
    console.log(`🔍 [DESCUENTOS-BASICOS] Obteniendo descuentos básicos para producto: ${codpro}`);
    
    const request = pool.request();
    request.input('producto', codpro);
    
    const result = await request.execute('sp_Productos_buscaxcuenta');
    
    if (result.recordset && result.recordset.length > 0) {
      const producto = result.recordset[0];
      const descuentosBasicos = {
        codpro: producto.codpro,
        nombre: producto.nombre,
        ComisionH: producto.ComisionH || 0,
        ComisionV: producto.ComisionV || 0,
        ComisionR: producto.ComisionR || 0,
        PventaMa: producto.PventaMa,
        afecto: producto.Afecto
      };
      
      console.log(`✅ [DESCUENTOS-BASICOS] Descuentos básicos obtenidos:`, descuentosBasicos);
      
      res.json({
        success: true,
        data: descuentosBasicos
      });
    } else {
      console.log(`⚠️ [DESCUENTOS-BASICOS] No se encontró producto: ${codpro}`);
      res.json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

  } catch (error) {
    console.error('❌ [DESCUENTOS-BASICOS] Error obteniendo descuentos básicos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener descuentos básicos del producto',
      details: error.message
    });
  }
});

// =====================================================
// ENDPOINT UNIFICADO: CÁLCULOS COMPLETOS AL AGREGAR PRODUCTO
// =====================================================
// POST /api/pedido_app/producto-calculos
// body: { ruc, codpro, cantidad }
router.post('/producto-calculos', async (req, res) => {
  try {
    const { ruc, codpro, cantidad } = req.body || {};
    if (!ruc || !codpro) {
      return res.status(400).json({ success: false, error: 'Parámetros inválidos' });
    }

    const pool = await getConnection();

    // 1) Usar SP Jhon_ProductoCalculos para descuentos finales (SIN bonificaciones)
    try {
      const spCalculos = await pool.request()
        .input('ruc', ruc)
        .input('codpro', codpro)
        .input('cantidad', cantidad || 1)
        .execute('Jhon_ProductoCalculos');

      const rowCalculos = spCalculos.recordset?.[0];
      if (rowCalculos) {
        // 2) Obtener bonificaciones por separado usando Jhon_Producto_BasicoOptimizado
        let bonificaciones = null;
        let boni = null;
        
        try {
          const spBasico = await pool.request()
            .execute('Jhon_Producto_BasicoOptimizado');
          
          const productosBasicos = spBasico.recordset || [];
          const productoBasico = productosBasicos.find(p => p.codpro === codpro);
          
          if (productoBasico && productoBasico.Bonificaciones) {
            try {
              bonificaciones = JSON.parse(productoBasico.Bonificaciones);
              console.log(`✅ [BONIFICACION] Bonificaciones del SP básico: ${bonificaciones.length} opciones`);
              
              // Para compatibilidad con el frontend, usar la primera bonificación aplicable
              if (bonificaciones && bonificaciones.length > 0) {
                const bonificacionAplicable = bonificaciones.find(b => b.Aplicable === true);
                if (bonificacionAplicable) {
                  boni = {
                    Codproducto: bonificacionAplicable.CodBoni,
                    Factor: bonificacionAplicable.Factor,
                    CodBoni: bonificacionAplicable.CodBoni,
                    Cantidad: bonificacionAplicable.Cantidad
                  };
                  console.log(`✅ [BONIFICACION] Bonificación aplicable encontrada: Factor ${bonificacionAplicable.Factor}`);
                }
              }
            } catch (e) {
              console.error('❌ [BONIFICACION] Error parseando bonificaciones del SP básico:', e);
            }
          }
        } catch (e) {
          console.error('❌ [BONIFICACION] Error obteniendo bonificaciones del SP básico:', e);
        }

        // Log requerido por el usuario: indicar la fuente del cálculo
        console.error('[CALC-SOURCE] sp_calculos_separado', { ruc, codpro, cantidad });
        res.setHeader('X-Calc-Source', 'sp_calculos_separado');
        return res.json({
          success: true,
          data: {
            basicos: {
              codpro: rowCalculos.codpro,
              nombre: rowCalculos.nombre,
              PventaMa: rowCalculos.Pventa,
              ComisionH: rowCalculos.Desc1, // valores finales calculados
              ComisionV: rowCalculos.Desc2,
              ComisionR: rowCalculos.Desc3,
              afecto: rowCalculos.afecto,
            },
            descuentosCliente: null, // opcional; no necesario con SP unificado
            tipificacion: rowCalculos.tipificacion ?? null,
            rangosTipificacion: rowCalculos.tipifRangos ? JSON.parse(rowCalculos.tipifRangos) : null,
            escalas: {
              Rango1: rowCalculos.R1, Rango2: rowCalculos.R2, Rango3: rowCalculos.R3, Rango4: rowCalculos.R4, Rango5: rowCalculos.R5,
              rangoUsado: rowCalculos.escalaRango,
              rangosCompletos: rowCalculos.escalasRangos ? JSON.parse(rowCalculos.escalasRangos) : null,
            },
            bonificacion: boni,
            bonificaciones: bonificaciones, // Todas las bonificaciones disponibles
            resultado: {
              Desc1: rowCalculos.Desc1,
              Desc2: rowCalculos.Desc2,
              Desc3: rowCalculos.Desc3,
              afecto: rowCalculos.afecto,
              Pventa: rowCalculos.Pventa,
            },
            meta: { source: 'sp_calculos_separado' }
          },
        });
      }
    } catch (e) {
      console.error('⚠️ [CALCULOS] SP Jhon_ProductoCalculos falló, usando flujo anterior:', e.message);
      // continua al flujo existente (fallback)
    }

    // Helpers de cache
    const keyBasicos = `basicos_${codpro}`;
    const keyDescClie = `desclie_${ruc}_${codpro}`;
    const labo = (codpro || '').toString().trim().substring(0, 2);
    const keyTipif = `tipif_${labo}_${ruc}`;
    const keyRangos = `rangos_${ruc}_${codpro}`;
    const keyEscalas = `escalas_${codpro}`;
    const keyBoni = `boni_${codpro}`;

    const readBasicos = (async () => {
      const cached = getFromCache(descuentoCache, keyBasicos, 3600000);
      if (cached) return cached;
      const r = await pool.request().input('producto', codpro).execute('sp_Productos_buscaxcuenta');
      const data = r.recordset?.[0] || null;
      if (data) {
        const bas = {
          codpro: data.codpro,
          nombre: data.nombre,
          ComisionH: data.ComisionH || 0,
          ComisionV: data.ComisionV || 0,
          ComisionR: data.ComisionR || 0,
          PventaMa: data.PventaMa,
          afecto: data.Afecto
        };
        setCache(descuentoCache, keyBasicos, bas, 3600000);
        return bas;
      }
      return null;
    })();

    const readDescuentosCliente = (async () => {
      const cached = getFromCache(descuentoCache, keyDescClie, 900000);
      if (cached !== null) return cached;
      const r = await pool.request().input('RuClie', ruc).input('codpro', codpro).execute('sp_Desclie_Buscar1');
      const data = r.recordset?.[0] || null;
      const resp = data ? {
        Descuento1: data.Descuento1 || 0,
        Descuento2: data.Descuento2 || 0,
        Descuento3: data.Descuento3 || 0
      } : null;
      setCache(descuentoCache, keyDescClie, resp, 900000);
      return resp;
    })();

    const readTipificacion = (async () => {
      const cached = getFromCache(tipificacionCache, keyTipif, 900000);
      if (cached) return cached;
      const r = await pool.request().input('labo', labo).input('ruc', ruc).execute('sp_cliente_tipificacion');
      const tip = r.recordset?.[0]?.tipificacion ?? null;
      const data = { tipificacion: tip };
      setCache(tipificacionCache, keyTipif, data, 900000);
      return data;
    })();

    const readRangosTipif = (async () => {
      // depende de tipificación; resolvemos luego si existe tipif
      return null;
    })();

    const readEscalas = (async () => {
      const cached = getFromCache(escalasCache, keyEscalas, 600000);
      if (cached !== null) return cached;
      const r = await pool.request().input('Codpro', codpro).execute('sp_Escalas_Buscar1');
      const data = r.recordset?.[0] || null;
      setCache(escalasCache, keyEscalas, data, 600000);
      return data;
    })();

    const readBonificacion = (async () => {
      const cached = getFromCache(descuentoCache, keyBoni, 86400000);
      if (cached !== null) return cached;
      const r = await pool.request()
        .input('codpro', codpro.trim())
        .query(`SELECT Codproducto, Factor, CodBoni, Cantidad FROM Bonificaciones WHERE Codproducto = @codpro`);
      const data = r.recordset?.[0] || null;
      setCache(descuentoCache, keyBoni, data, 86400000);
      return data;
    })();

    // Ejecutar en paralelo lo que no depende
    const [basicos, descClie, tipifData, escalas, boni] = await Promise.all([
      readBasicos, readDescuentosCliente, readTipificacion, readEscalas, readBonificacion
    ]);

    // Si hay tipificación, obtener rangos (y calcular porcentaje por cantidad)
    let tipifRangos = null;
    let descTipif = 0;
    if (tipifData && tipifData.tipificacion != null) {
      const key = keyRangos;
      const cached = getFromCache(descuentoCache, key, 600000);
      if (cached !== null) {
        tipifRangos = cached;
      } else {
        const rr = await pool.request().input('tipifica', parseInt(tipifData.tipificacion)).input('cod', codpro).execute('sp_Descuento_labo_buscaY');
        tipifRangos = rr.recordset || [];
        setCache(descuentoCache, key, tipifRangos, 600000);
      }
      // cálculo local: mayor "Desde" <= cantidad
      const cant = parseFloat(cantidad || 1);
      const orden = [...tipifRangos].sort((a,b)=> parseFloat(b.Desde)-parseFloat(a.Desde));
      const match = orden.find(e => cant >= parseFloat(e.Desde));
      descTipif = match ? parseFloat(match.Porcentaje || 0) : 0;
    }

    // Aplicar reglas de reemplazo (>0 aplica; 0/-9 mantiene anterior)
    // Base
    let Desc1 = basicos?.ComisionH || 0;
    let Desc2 = basicos?.ComisionV || 0;
    let Desc3 = basicos?.ComisionR || 0;

    // Cliente (3 campos)
    if (descClie) {
      if (parseFloat(descClie.Descuento1) > 0) Desc1 = parseFloat(descClie.Descuento1);
      if (parseFloat(descClie.Descuento2) > 0) Desc2 = parseFloat(descClie.Descuento2);
      if (parseFloat(descClie.Descuento3) > 0) Desc3 = parseFloat(descClie.Descuento3);
    }

    // Tipificación (solo Desc1)
    if (parseFloat(descTipif) > 0) {
      Desc1 = parseFloat(descTipif);
    }

    // Escalas (tres campos, respetando -9 como no aplica)
    if (escalas) {
      const cant = parseFloat(cantidad || 1);
      // elegir rango
      const r1 = parseFloat(escalas.Rango1 || 0), r2 = parseFloat(escalas.Rango2 || 0), r3 = parseFloat(escalas.Rango3 || 0), r4 = parseFloat(escalas.Rango4 || 0), r5 = parseFloat(escalas.Rango5 || 0);
      let rangoUsado = 1;
      if (cant >= r5 && r5 > 0) rangoUsado = 5;
      else if (cant >= r4 && r4 > 0) rangoUsado = 4;
      else if (cant >= r3 && r3 > 0) rangoUsado = 3;
      else if (cant >= r2 && r2 > 0) rangoUsado = 2;
      else if (cant >= r1 && r1 > 0) rangoUsado = 1;

      const take = (v) => v == null ? -9 : parseFloat(v);
      const map = {
        1: { d1: take(escalas.Des11), d2: take(escalas.des12), d3: take(escalas.des13) },
        2: { d1: take(escalas.des21), d2: take(escalas.des22), d3: take(escalas.des23) },
        3: { d1: take(escalas.des31), d2: take(escalas.des32), d3: take(escalas.des33) },
        4: { d1: take(escalas.des41), d2: take(escalas.des42), d3: take(escalas.des43) },
        5: { d1: take(escalas.des51), d2: take(escalas.des52), d3: take(escalas.des53) }
      };
      const vals = map[rangoUsado] || { d1:-9, d2:-9, d3:-9 };
      if (vals.d1 > 0) Desc1 = vals.d1;
      if (vals.d2 > 0) Desc2 = vals.d2;
      if (vals.d3 > 0) Desc3 = vals.d3;
    }

    // Construir respuesta
    const respuesta = {
      success: true,
      data: {
        basicos,
        descuentosCliente: descClie,
        tipificacion: tipifData?.tipificacion ?? null,
        rangosTipificacion: tipifRangos,
        escalas: escalas,
        bonificacion: boni,
        resultado: {
          Desc1, Desc2, Desc3,
          afecto: basicos?.afecto ?? null,
          Pventa: basicos?.PventaMa ?? null
        },
        meta: { source: 'fallback' }
      }
    };

    // Log requerido por el usuario: indicar la fuente del cálculo
    console.error('[CALC-SOURCE] fallback', { ruc, codpro, cantidad });
    res.setHeader('X-Calc-Source', 'fallback');
    return res.json(respuesta);
  } catch (error) {
    console.error('❌ [UNIFICADO] Error en producto-calculos:', error);
    return res.status(500).json({ success: false, error: 'Error en cálculos unificados', details: error.message });
  }
});

// =====================================================
// CONDICIONES ESPECIALES DE CLIENTES
// =====================================================

/**
 * GET /api/pedido_app/cliente-condicion/:ruc
 * Obtiene las condiciones especiales de un cliente usando sp_tablas_BuscaDescribe
 * Busca en la tabla tablas con n_codtabla=6 y c_describe=RUC
 */
router.get('/cliente-condicion/:ruc', async (req, res) => {
  try {
    const { ruc } = req.params;
    const pool = await getConnection();
    
    console.log(`🔍 [CLIENTE-CONDICION] Obteniendo condiciones especiales para RUC: ${ruc}`);
    
    // Ejecutar sp_tablas_BuscaDescribe con tabla=6 y describe=RUC
    const result = await pool.request()
      .input('tabla', 6)
      .input('describe', ruc)
      .execute('sp_tablas_BuscaDescribe');
    
    if (result.recordset && result.recordset.length > 0) {
      const condiciones = result.recordset;
      console.log(`✅ [CLIENTE-CONDICION] Condiciones encontradas: ${condiciones.length} para RUC: ${ruc}`);
      
      // Obtener todas las condiciones normales para hacer el mapeo
      const pool2 = await getConnection();
      const resultCondiciones = await pool2.request()
        .input('codigo', 22)
        .execute('sp_tablas_Listar');
      
      const condicionesNormales = resultCondiciones.recordset;
      
      // Formatear las condiciones especiales mapeándolas a condiciones normales
      const condicionesFormateadas = condiciones.map(condicion => {
        const conversionCliente = parseFloat(condicion.conversion) || 0;
        
        // Buscar la condición normal que tenga n_numero igual a la conversión del cliente
        const condicionMapeada = condicionesNormales.find(c => 
          parseInt(c.n_numero) === conversionCliente
        );
        
        if (condicionMapeada) {
          // Si encuentra coincidencia, usar esa condición normal
          return {
            n_codtabla: 6,
            c_descripcion: `Condición Especial Cliente - ${condicionMapeada.c_describe}`,
            n_numero: condicionMapeada.n_numero, // Usar el n_numero de la condición normal
            c_describe: `Condición Especial Cliente - ${condicionMapeada.c_describe}`, // Usar c_describe también
            conversion: condicionMapeada.conversion, // Usar la conversión de la condición normal
            Afecto: 0
          };
        } else {
          // Si no encuentra coincidencia, crear una condición especial
          return {
            n_codtabla: 6,
            c_descripcion: `Condición Especial (${condicion.numero}) - Conversión: ${condicion.conversion}%`,
            n_numero: condicion.numero,
            c_describe: `Condición Especial (${condicion.numero}) - Conversión: ${condicion.conversion}%`,
            conversion: conversionCliente,
            Afecto: 0
          };
        }
      });
      
      res.json({
        success: true,
        data: condicionesFormateadas,
        total: condicionesFormateadas.length,
        ruc: ruc,
        message: 'Condiciones especiales obtenidas exitosamente'
      });
    } else {
      console.log(`⚠️ [CLIENTE-CONDICION] No se encontraron condiciones especiales para RUC: ${ruc}`);
      res.json({
        success: true,
        data: [],
        total: 0,
        ruc: ruc,
        message: 'No se encontraron condiciones especiales para este cliente'
      });
    }
    
  } catch (error) {
    console.error('❌ [CLIENTE-CONDICION] Error obteniendo condiciones especiales:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener condiciones especiales del cliente',
      details: error.message
    });
  }
});

// =====================================================
// GESTIÓN DE NÚMEROS CORRELATIVOS DE PEDIDOS
// =====================================================

/**
 * POST /api/pedido_app/obtener-correlativo-pedido
 * Obtiene el siguiente número correlativo de pedido de forma segura
 * Maneja múltiples vendedores simultáneos sin conflictos
 */
router.post('/obtener-correlativo-pedido', async (req, res) => {
  const pool = await getConnection();
  const transaction = pool.transaction();
  
  try {
    await transaction.begin();
    
    console.log('🔢 [CORRELATIVO] Iniciando obtención de número correlativo...');
    
    // 1. Obtener el número base de la tabla tablas (Fdn-0000000)
    const queryTablas = `
      SELECT n_numero, c_describe 
      FROM tablas 
      WHERE n_codtabla = 330 AND n_numero = 16
    `;
    
    const resultTablas = await transaction.request().query(queryTablas);
    
    if (resultTablas.recordset.length === 0) {
      throw new Error('No se encontró la configuración de correlativo Fdn en tablas');
    }
    
    const configCorrelativo = resultTablas.recordset[0];
    const numeroBase = configCorrelativo.c_describe; // "Fdn-0000000"
    
    console.log(`📋 [CORRELATIVO] Configuración base encontrada: ${numeroBase}`);
    
    // 2. Extraer el número actual del formato "Fdn-0000000"
    const match = numeroBase.match(/Fdn-(\d+)/);
    if (!match) {
      throw new Error('Formato de correlativo inválido en tablas');
    }
    
    let numeroActual = parseInt(match[1]);
    console.log(`🔢 [CORRELATIVO] Número base extraído: ${numeroActual}`);
    
    // 3. Buscar el último número usado en doccabped
    const queryUltimoPedido = `
      SELECT TOP 1 numero 
      FROM doccabped 
      WHERE LEFT(numero, 3) = 'Fdn' 
      ORDER BY CAST(SUBSTRING(numero, 5, 10) AS INT) DESC
    `;
    
    const resultUltimo = await transaction.request().query(queryUltimoPedido);
    
    if (resultUltimo.recordset.length > 0) {
      const ultimoNumero = resultUltimo.recordset[0].numero;
      const matchUltimo = ultimoNumero.match(/Fdn-(\d+)/);
      
      if (matchUltimo) {
        const numeroEnBD = parseInt(matchUltimo[1]);
        console.log(`📊 [CORRELATIVO] Último número en doccabped: ${numeroEnBD}`);
        
        // Usar el mayor entre el configurado y el existente
        if (numeroEnBD >= numeroActual) {
          numeroActual = numeroEnBD + 1;
        } else {
          numeroActual = numeroActual + 1;
        }
      }
    } else {
      numeroActual = numeroActual + 1;
    }
    
    console.log(`✅ [CORRELATIVO] Número asignado: ${numeroActual}`);
    
    // 4. Verificar que el número no esté en uso (por si hay pedidos de prueba)
    let numeroFinal = numeroActual;
    let intentos = 0;
    const maxIntentos = 100; // Evitar bucle infinito
    
    while (intentos < maxIntentos) {
      const numeroFormateado = `Fdn-${numeroFinal.toString().padStart(7, '0')}`;
      
      const queryVerificar = `
        SELECT COUNT(*) as existe 
        FROM doccabped 
        WHERE numero = @numero
      `;
      
      const resultVerificar = await transaction.request()
        .input('numero', numeroFormateado)
        .query(queryVerificar);
      
      const existe = resultVerificar.recordset[0].existe > 0;
      
      if (!existe) {
        console.log(`✅ [CORRELATIVO] Número disponible: ${numeroFormateado}`);
        break;
      } else {
        console.log(`⚠️ [CORRELATIVO] Número en uso: ${numeroFormateado}, probando siguiente...`);
        numeroFinal++;
        intentos++;
      }
    }
    
    if (intentos >= maxIntentos) {
      throw new Error('No se pudo encontrar un número correlativo disponible');
    }
    
    const numeroCorrelativoFinal = `Fdn-${numeroFinal.toString().padStart(7, '0')}`;
    
    // 5. Actualizar la tabla tablas con el siguiente número
    const nuevoNumeroBase = `Fdn-${numeroFinal.toString().padStart(7, '0')}`;
    const queryActualizar = `
      UPDATE tablas 
      SET c_describe = @nuevoNumero 
      WHERE n_codtabla = 330 AND n_numero = 16
    `;
    
    await transaction.request()
      .input('nuevoNumero', nuevoNumeroBase)
      .query(queryActualizar);
    
    console.log(`🔄 [CORRELATIVO] Tabla tablas actualizada a: ${nuevoNumeroBase}`);
    
    // 6. Confirmar transacción
    await transaction.commit();
    
    console.log(`✅ [CORRELATIVO] Correlativo asignado exitosamente: ${numeroCorrelativoFinal}`);
    
    // Crear timestamp en hora local de Perú (UTC-5)
    const now = new Date();
    // Perú está en UTC-5, así que restamos 5 horas del UTC actual
    const peruTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    
    // Debug: mostrar las horas para verificar
    console.log(`🕐 [CORRELATIVO] Hora UTC del servidor: ${now.toISOString()}`);
    console.log(`🕐 [CORRELATIVO] Hora calculada para Perú: ${peruTime.toISOString()}`);
    // Usar métodos UTC para obtener la hora correcta
    const peruHour = peruTime.getUTCHours();
    const peruMinute = peruTime.getUTCMinutes();
    const peruSecond = peruTime.getUTCSeconds();
    const peruDay = peruTime.getUTCDate();
    const peruMonth = peruTime.getUTCMonth() + 1;
    const peruYear = peruTime.getUTCFullYear();
    
    console.log(`🕐 [CORRELATIVO] Hora local formateada: ${peruHour}:${peruMinute}:${peruSecond}`);
    
    res.json({
      success: true,
      data: {
        numeroCorrelativo: numeroCorrelativoFinal,
        numeroBase: numeroBase,
        numeroAsignado: numeroFinal,
        timestamp: peruTime.toISOString(),
        timestampLocal: `${peruDay.toString().padStart(2, '0')}/${peruMonth.toString().padStart(2, '0')}/${peruYear}, ${peruHour.toString().padStart(2, '0')}:${peruMinute.toString().padStart(2, '0')}:${peruSecond.toString().padStart(2, '0')}`,
        message: `Número de pedido asignado: ${numeroCorrelativoFinal}`
      },
      message: 'Correlativo obtenido exitosamente'
    });
    
  } catch (error) {
    // Rollback en caso de error
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('❌ [CORRELATIVO] Error en rollback:', rollbackError);
      }
    }
    
    console.error('❌ [CORRELATIVO] Error obteniendo correlativo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener número correlativo',
      details: error.message
    });
  }
});

/**
 * GET /api/pedido_app/estado-correlativos
 * Endpoint de información para verificar el estado actual de los correlativos
 */
router.get('/estado-correlativos', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Obtener configuración actual
    const queryConfig = `
      SELECT n_numero, c_describe 
      FROM tablas 
      WHERE n_codtabla = 330 AND n_numero = 16
    `;
    
    const resultConfig = await pool.request().query(queryConfig);
    const config = resultConfig.recordset[0] || null;
    
    // Obtener últimos 10 pedidos Fdn
    const queryUltimos = `
      SELECT TOP 10 numero, fecha, estado, codclie 
      FROM doccabped 
      WHERE LEFT(numero, 3) = 'Fdn' 
      ORDER BY CAST(SUBSTRING(numero, 5, 10) AS INT) DESC
    `;
    
    const resultUltimos = await pool.request().query(queryUltimos);
    
    // Estadísticas
    const queryStats = `
      SELECT 
        COUNT(*) as total_pedidos,
        MIN(CAST(SUBSTRING(numero, 5, 10) AS INT)) as numero_minimo,
        MAX(CAST(SUBSTRING(numero, 5, 10) AS INT)) as numero_maximo
      FROM doccabped 
      WHERE LEFT(numero, 3) = 'Fdn'
    `;
    
    const resultStats = await pool.request().query(queryStats);
    const stats = resultStats.recordset[0];
    
    res.json({
      success: true,
      data: {
        configuracion: config,
        ultimosPedidos: resultUltimos.recordset,
        estadisticas: {
          totalPedidos: stats.total_pedidos,
          numeroMinimo: stats.numero_minimo,
          numeroMaximo: stats.numero_maximo
        }
      },
      message: 'Estado de correlativos obtenido exitosamente'
    });
    
  } catch (error) {
    console.error('❌ [ESTADO-CORRELATIVOS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de correlativos',
      details: error.message
    });
  }
});

// =====================================================
// CREAR PEDIDO COMPLETO CON CORRELATIVO
// =====================================================

/**
 * POST /api/pedido_app/crear-pedido
 * Crea un pedido completo usando el stored procedure sp_PedidosVentas_Insertar
 * body: { numeroCorrelativo, clienteData, productos, configuracion }
 */
router.post('/crear-pedido', async (req, res) => {
  const pool = await getConnection();
  const transaction = pool.transaction();
  
  try {
    await transaction.begin();
    
    const { 
      numeroCorrelativo, 
      clienteData, 
      productos, 
      configuracion 
    } = req.body;
    
    console.log('🛒 [CREAR-PEDIDO] Iniciando creación de pedido...');
    console.log('📋 [CREAR-PEDIDO] Número correlativo:', numeroCorrelativo);
    console.log('👤 [CREAR-PEDIDO] Cliente:', clienteData?.Razon);
    console.log('📦 [CREAR-PEDIDO] Productos:', productos?.length || 0);
    console.log('🔧 [CREAR-PEDIDO] Configuración recibida:', JSON.stringify(configuracion, null, 2));
    console.log('📦 [CREAR-PEDIDO] Primer producto:', productos?.[0] ? JSON.stringify(productos[0], null, 2) : 'No hay productos');
    console.log('🔢 [CREAR-PEDIDO] Número correlativo original:', numeroCorrelativo);
    console.log('🔢 [CREAR-PEDIDO] Cliente CodClie original:', clienteData.Codclie);
    
    // Validar datos requeridos
    if (!numeroCorrelativo || !clienteData || !productos || productos.length === 0) {
      throw new Error('Datos del pedido incompletos');
    }
    
    // Usar los totales reales calculados en el frontend (redondeados a 2 decimales)
    const subtotal = Math.round((parseFloat(configuracion?.subtotal) || 0) * 100) / 100;
    const igvMonto = Math.round((parseFloat(configuracion?.igv) || 0) * 100) / 100;
    const total = Math.round((parseFloat(configuracion?.total) || 0) * 100) / 100;
    
    
    // Obtener datos del vendedor desde el token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Token de autorización requerido');
    }
    
    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'tu_secret_key';
    const decoded = jwt.verify(token, jwtSecret);
    
    
    const vendedorId = decoded.CodigoInterno;
    const vendedorNombres = decoded.nombres || decoded.Nombre || decoded.nombre || 'Usuario';
    const vendedorCodint = decoded.CodigoInterno || vendedorId;
    
    // Separar nombre y apellido del campo 'nombres'
    const partesNombre = vendedorNombres.split(' ');
    const vendedorNombre = partesNombre[0] || 'Usuario';
    const vendedorApellido = partesNombre.slice(1).join(' ') || '';
    
    if (!vendedorId) {
      throw new Error('Vendedor no encontrado en el token');
    }
    
    
    // Preparar parámetros para el stored procedure
    // @nume debe ser char (string), no int
    const numeConvertido = numeroCorrelativo.toString(); // Mantener como string
    const codConvertido = parseInt(clienteData.Codclie) || 0;
    const venConvertido = parseInt(vendedorId) || 0; // Convertir vendedor a int
    
    console.log('🔢 [CREAR-PEDIDO] Número correlativo convertido:', numeConvertido);
    console.log('🔢 [CREAR-PEDIDO] Cliente CodClie convertido:', codConvertido);
    console.log('🔢 [CREAR-PEDIDO] Vendedor convertido:', venConvertido);
    
    const params = {
      nume: numeConvertido, // Mantener como string (char)
      tipo: parseInt(configuracion?.tipoDocumento) || 1, // 1=Factura, 2=Boleta
      cod: codConvertido, // Asegurar que sea un entero válido
      dire: clienteData.Direccion || '',
      // fecha: new Date().toISOString().slice(0, 19).replace('T', ' '), // El SP usa getdate() en lugar del parámetro @fecha
      subtotal: subtotal, // Ya redondeado a 2 decimales
      igv: igvMonto, // Ya redondeado a 2 decimales
      total: total, // Ya redondeado a 2 decimales
      moneda: 1, // Soles
      cambio: 3.01, // Siempre 3.01 como en el ejemplo
      ven: venConvertido, // Usar el vendedor convertido a int
      dias: parseInt(configuracion?.diasCredito) || 0, // Días según la condición seleccionada
      condicion: parseInt(configuracion?.condicion) || 1, // Usar la condición del frontend
      estado: parseInt(configuracion?.estado) || 2, // 2=Comercial por defecto
      observa: configuracion?.observacion || '',
      conletra: false, // No usar con letras por defecto
      urgente: configuracion?.urgente || false,
      representa: configuracion?.representante ? parseInt(configuracion.representante) : 0 // 0 si no tiene valor
    };
    
    
    // Ejecutar el stored procedure
    let result;
    const fechaActual = new Date(); // Usar objeto Date de JavaScript
    console.log('📅 [CREAR-PEDIDO] Usando fecha actual:', fechaActual.toISOString());
    
    // 1) Forzar interpretación DMY en la sesión (SOLUCIÓN CLAVE)
    console.log('🔧 [CREAR-PEDIDO] Configurando DATEFORMAT dmy para la sesión...');
    await transaction.request().batch("SET DATEFORMAT dmy;");
    
    // 2) Ejecutar el SP en la misma transacción/sesión
    result = await transaction.request()
      .input('nume', sql.VarChar(20), params.nume)
      .input('tipo', sql.Int, params.tipo)
      .input('cod', sql.Int, params.cod)
      .input('dire', sql.VarChar(60), params.dire)
      .input('fecha', sql.SmallDateTime, fechaActual) // Usar sql.SmallDateTime con objeto Date nativo
      .input('subtotal', sql.Money, params.subtotal)
      .input('igv', sql.Money, params.igv)
      .input('total', sql.Money, params.total)
      .input('moneda', sql.Int, params.moneda)
      .input('cambio', sql.Decimal(9, 2), params.cambio)
      .input('ven', sql.Int, params.ven)
      .input('dias', sql.Int, params.dias)
      .input('condicion', sql.Int, params.condicion)
      .input('estado', sql.Int, params.estado)
      .input('observa', sql.VarChar(150), params.observa)
      .input('conletra', sql.Bit, params.conletra)
      .input('urgente', sql.Bit, params.urgente)
      .input('representa', sql.Int, params.representa)
      .execute('sp_PedidosVentas_Insertar');
    
    
    // Ahora crear los detalles del pedido
    await _crearDetallesPedido(transaction, numeroCorrelativo, productos);
    
    
    // Registrar auditoría
    await _registrarAuditoria(transaction, numeroCorrelativo, clienteData, {
      codint: vendedorCodint,
      nombre: vendedorNombre,
      apellido: vendedorApellido
    });
    
    // Confirmar transacción
    await transaction.commit();
    
    
    res.json({
      success: true,
      data: {
        numeroPedido: numeroCorrelativo,
        cliente: clienteData.Razon,
        totalProductos: productos.length,
        subtotal: subtotal,
        igv: igvMonto,
        total: total,
        estado: params.estado,
        fecha: new Date().toISOString()
      },
      message: 'Pedido creado exitosamente'
    });
    
  } catch (error) {
    // Rollback en caso de error
    if (transaction) {
      try {
        await transaction.rollback();
        console.log('🔄 [CREAR-PEDIDO] Rollback ejecutado correctamente');
        
        // Revertir el correlativo si el pedido falló
        await _revertirCorrelativo(numeroCorrelativo);
        
      } catch (rollbackError) {
        console.error('❌ [CREAR-PEDIDO] Error en rollback:', rollbackError);
      }
    }
    
    console.error('❌ [CREAR-PEDIDO] Error creando pedido:', error);
    console.error('❌ [CREAR-PEDIDO] Stack trace:', error.stack);
    console.error('❌ [CREAR-PEDIDO] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      number: error.number,
      state: error.state,
      class: error.class,
      serverName: error.serverName,
      procName: error.procName,
      lineNumber: error.lineNumber
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al crear el pedido',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Función auxiliar para crear los detalles del pedido usando sp_DetaPedidoVenta_Insertar
 * Incluye TODOS los productos: principales, packs y bonificaciones
 * Los nbonif ya vienen asignados desde el frontend
 */
async function _crearDetallesPedido(transaction, numeroPedido, productos) {
  
  // Procesar todos los productos tal como vienen del frontend
  for (let i = 0; i < productos.length; i++) {
    const producto = productos[i];
    const esBonificacion = producto.esBonificacion || false;
    const nbonif = producto.nbonif || 0; // Ya viene como int desde el frontend
    
    
    await _procesarProductoDetalle(transaction, numeroPedido, producto, nbonif, esBonificacion);
  }
  
}

/**
 * Función auxiliar para procesar un producto individual en el detalle del pedido
 */
async function _procesarProductoDetalle(transaction, numeroPedido, producto, indiceBonificacion, esBonificacion) {
  
  const precioOriginal = parseFloat(producto.Pventa) || 0;
  const cantidad = parseFloat(producto.cantidad) || 0;
  let subtotalProducto = parseFloat(producto.subtotal) || 0;
  
  // Manejar bonificaciones: 100% de descuento y subtotal = 0
  let desc1, desc2, desc3;
  
  if (esBonificacion) {
    // BONIFICACIÓN: 100% de descuento en Desc1, otros descuentos en 0
    // PERO mantiene el precio original
    desc1 = 100.00;
    desc2 = 0.00;
    desc3 = 0.00;
    subtotalProducto = 0.00; // Las bonificaciones siempre tienen subtotal 0
  } else {
    // PRODUCTO PRINCIPAL: usar descuentos reales del frontend
    desc1 = parseFloat(producto.Desc1) || 0;
    desc2 = parseFloat(producto.Desc2) || 0;
    desc3 = parseFloat(producto.Desc3) || 0;
  }
  
  
  // Preparar parámetros para el stored procedure sp_DetaPedidoVenta_Insertar
  const params = {
    num: numeroPedido,
    idpro: String(producto.codpro),
    unimed: parseInt(producto.unimed) || 1, // Unidad de medida (1 por defecto)
    cantidad: cantidad,
    adicional: parseFloat(producto.adicional) || 0, // Adicional (0 por defecto)
    precio: precioOriginal, // Usar precio original para bonificaciones
    unidad: parseInt(producto.unidad) || 1, // Unidades (1 por defecto)
    des1: desc1,
    des2: desc2,
    des3: desc3,
    paquete: parseInt(producto.paquete) || 0, // Paquete (0 por defecto)
    subtotal: subtotalProducto,
    autoriza: producto.autoriza || false, // Autorización (false por defecto)
    nbonif: indiceBonificacion, // Usar el nbonif que viene del frontend
    codprom: '', // Siempre vacío
    descab: '', // Siempre vacío
    codofer: '', // Siempre vacío
    codaut: '' // Siempre vacío
  };
  
  
  // Ejecutar el stored procedure sp_DetaPedidoVenta_Insertar
  await transaction.request()
    .input('num', params.num)
    .input('idpro', params.idpro)
    .input('unimed', params.unimed)
    .input('cantidad', params.cantidad)
    .input('adicional', params.adicional)
    .input('precio', params.precio)
    .input('unidad', params.unidad)
    .input('des1', params.des1)
    .input('des2', params.des2)
    .input('des3', params.des3)
    .input('paquete', params.paquete)
    .input('subtotal', params.subtotal)
    .input('autoriza', params.autoriza)
    .input('nbonif', params.nbonif)
    .input('codprom', params.codprom)
    .input('descab', params.descab)
    .input('codofer', params.codofer)
    .input('codaut', params.codaut)
    .execute('sp_DetaPedidoVenta_Insertar');
  
}

/**
 * Registra la auditoría del pedido usando sp_Accountig_inserta
 */
async function _registrarAuditoria(transaction, numeroPedido, clienteData, vendedorInfo) {
  try {
    
    // Construir operador: codint + "-" + primer nombre
    const primerNombre = vendedorInfo.nombre.split(' ')[0];
    const operador = `${vendedorInfo.codint}-${primerNombre}`;
    
    // Construir máquina: primer nombre + iniciales del resto
    const nombreCompleto = `${vendedorInfo.nombre} ${vendedorInfo.apellido}`.trim();
    const maquina = _construirNombreMaquina(nombreCompleto);
    
    // Construir detalle: numeroPedido->Cliente:codCliente
    const codCliente = clienteData.Codclie || clienteData.codclie || 'N/A';
    const detalle = `${numeroPedido}->Cliente:${codCliente}`;
    
    // Usar la misma fecha que se usó para el correlativo
    const fechaPedido = new Date();
    
    
    // Ejecutar sp_Accountig_inserta
    await transaction.request()
      .input('fecha', fechaPedido)
      .input('operador', operador)
      .input('usuarioSO', 'X')
      .input('maquina', maquina)
      .input('opcion', 'Ventas-Pedido de Ventas')
      .input('accion', 'Registrar Pedido de ventas')
      .input('formulario', 'Fdn-App')
      .input('detalle', detalle)
      .execute('sp_Accountig_inserta');
    
    
  } catch (error) {
    console.error('❌ [AUDITORIA] Error registrando auditoría:', error);
    // No lanzar error para no afectar la creación del pedido
  }
}


/**
 * Construye el nombre de máquina: primer nombre + iniciales del resto
 * Ejemplo: "Fernando Saavedra Llanos" -> "Fernando F.S.L"
 */
function _construirNombreMaquina(nombreCompleto) {
  const partes = nombreCompleto.split(' ');
  if (partes.length === 0) return 'Usuario';
  
  const primerNombre = partes[0];
  const iniciales = partes.slice(1).map(parte => parte.charAt(0).toUpperCase()).join('.');
  
  if (iniciales) {
    return `${primerNombre} ${iniciales}`;
  } else {
    return primerNombre;
  }
}

/**
 * Revierte el correlativo cuando un pedido falla
 * Esto evita que el correlativo quede "perdido" cuando hay errores
 */
async function _revertirCorrelativo(numeroCorrelativo) {
  try {
    const pool = await getConnection();
    
    // Extraer el número del correlativo (ej: "Fdn-0000011" -> "11")
    const match = numeroCorrelativo.match(/Fdn-(\d+)/);
    if (!match) {
      console.log('⚠️ [REVERTIR-CORRELATIVO] Formato de correlativo inválido:', numeroCorrelativo);
      return;
    }
    
    const numeroActual = parseInt(match[1]);
    const numeroAnterior = numeroActual - 1;
    const numeroAnteriorFormateado = `Fdn-${numeroAnterior.toString().padStart(7, '0')}`;
    
    console.log(`🔄 [REVERTIR-CORRELATIVO] Revirtiendo correlativo de ${numeroCorrelativo} a ${numeroAnteriorFormateado}`);
    
    // Actualizar la tabla tablas con el número anterior
    const queryRevertir = `
      UPDATE tablas 
      SET c_describe = @numeroAnterior 
      WHERE n_codtabla = 330 AND n_numero = 16
    `;
    
    await pool.request()
      .input('numeroAnterior', numeroAnteriorFormateado)
      .query(queryRevertir);
    
    console.log(`✅ [REVERTIR-CORRELATIVO] Correlativo revertido exitosamente a: ${numeroAnteriorFormateado}`);
    
  } catch (error) {
    console.error('❌ [REVERTIR-CORRELATIVO] Error revirtiendo correlativo:', error);
    // No lanzar error para no afectar el flujo principal
  }
}


module.exports = router;
