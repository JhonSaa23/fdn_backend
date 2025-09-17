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

// Buscar clientes con optimizaciones
router.get('/clientes', async (req, res) => {
  try {
    const pool = await getConnection();
    const { q: query, limit = 20 } = req.query;
    
    // Permitir límites más altos para carga completa - SIN LÍMITE MÁXIMO
    const maxLimit = parseInt(limit) || 20; // Sin límite máximo para traer TODOS los datos
    
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
        return res.json({
          success: true,
          data: cached.data,
          total: cached.data.length,
          cached: true
        });
      }
    }
    
    
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
    const query = `EXEC sp_tablas_Listar @codigoTabla`;
    
    const result = await pool.request()
      .input('codigoTabla', parseInt(codigoTabla))
      .query(query);
    
    
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
 * Busca productos con saldos disponibles
 * Query params: search (opcional), limit (opcional, default 50)
 */
router.get('/productos', async (req, res) => {
  try {
    const pool = await getConnection();
    const { search = '', limit = 50 } = req.query;
    
    console.log(`🔍 [PRODUCTOS] Búsqueda de productos - Término: "${search}" (SIN LÍMITE - TODOS)`);
    
    // Construir la consulta base - SIN LÍMITE TOP para traer TODOS los datos
    let query = `
      SELECT
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
          p.comisionR,
          CAST(p.afecto AS INT)
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
    console.log(`📦 [PRODUCTOS] Primeros 3 productos:`, result.recordset.slice(0, 3));
    console.log(`✅ [PRODUCTOS] TODOS los productos encontrados: ${result.recordset.length} (SIN LÍMITE)`);
    
    res.json({
      success: true,
      data: result.recordset,
      total: result.recordset.length,
      search: search,
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('❌ [PRODUCTOS] Error al buscar productos:', error);
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
    
    console.log('🧪 Probando consulta base de productos...');
    
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

module.exports = router;
