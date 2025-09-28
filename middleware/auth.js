const jwt = require('jsonwebtoken');
const { getConnection } = require('../database');
const sql = require('mssql');

// Clave secreta para JWT (debería estar en variables de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura_aqui';

// Middleware de autenticación
const authenticateToken = async (req, res, next) => {
  try {
    console.log(`🔐 [AUTH-MIDDLEWARE] Verificando autenticación para: ${req.method} ${req.path}`);
    console.log(`🔐 [AUTH-MIDDLEWARE] Headers recibidos:`, {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    });
    
    // Obtener el token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log(`🔐 [AUTH-MIDDLEWARE] Token extraído: ${token ? 'Present' : 'Missing'}`);

    if (!token) {
      console.log(`❌ [AUTH-MIDDLEWARE] Token no encontrado en headers`);
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    // Verificar el token
    console.log(`🔐 [AUTH-MIDDLEWARE] Verificando token JWT...`);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(`🔐 [AUTH-MIDDLEWARE] Token decodificado exitosamente. IDUS: ${decoded.idus}`);
    
    // Verificar que el usuario existe y está activo
    console.log(`🔐 [AUTH-MIDDLEWARE] Verificando usuario en base de datos...`);
    const pool = await getConnection();
    const result = await pool.request()
      .input('idus', sql.Int, decoded.idus)
      .query(`
        SELECT IDUS, CodigoInterno, Nombres, TipoUsuario, Activo, Bloqueado
        FROM UsersSystems 
        WHERE IDUS = @idus AND Activo = 1 AND Bloqueado = 0
      `);

    console.log(`🔐 [AUTH-MIDDLEWARE] Resultado de consulta: ${result.recordset.length} registros encontrados`);

    if (result.recordset.length === 0) {
      console.log(`❌ [AUTH-MIDDLEWARE] Usuario no encontrado o inactivo`);
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado o inactivo'
      });
    }

    // Agregar información del usuario a la request
    req.user = {
      idus: decoded.idus,
      nombres: result.recordset[0].Nombres,
      tipoUsuario: result.recordset[0].TipoUsuario,
      CodigoInterno: result.recordset[0].CodigoInterno
    };

    console.log(`✅ [AUTH-MIDDLEWARE] Autenticación exitosa para usuario: ${req.user.nombres} (IDUS: ${req.user.idus})`);
    next();
  } catch (error) {
    console.error(`❌ [AUTH-MIDDLEWARE] Error en autenticación:`, error);
    
    if (error.name === 'JsonWebTokenError') {
      console.log(`❌ [AUTH-MIDDLEWARE] Token JWT inválido`);
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      console.log(`❌ [AUTH-MIDDLEWARE] Token JWT expirado`);
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    console.error('❌ [AUTH-MIDDLEWARE] Error interno en middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Middleware para verificar si es administrador
const requireAdmin = (req, res, next) => {
  if (req.user.tipoUsuario !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren permisos de administrador'
    });
  }
  next();
};

// Middleware opcional (no requiere autenticación pero la usa si está presente)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const pool = await getConnection();
      const result = await pool.request()
        .input('idus', sql.Int, decoded.idus)
        .query(`
          SELECT IDUS, Nombres, TipoUsuario, Activo, Bloqueado
          FROM UsersSystems 
          WHERE IDUS = @idus AND Activo = 1 AND Bloqueado = 0
        `);

      if (result.recordset.length > 0) {
        req.user = {
          idus: decoded.idus,
          nombres: result.recordset[0].Nombres,
          tipoUsuario: result.recordset[0].TipoUsuario
        };
      }
    }
    
    next();
  } catch (error) {
    // Si hay error con el token, continuar sin autenticación
    next();
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
  JWT_SECRET
};
