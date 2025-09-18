const jwt = require('jsonwebtoken');
const { getConnection } = require('../database');
const sql = require('mssql');

// Clave secreta para JWT (debería estar en variables de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura_aqui';

// Middleware de autenticación
const authenticateToken = async (req, res, next) => {
  try {
    // Obtener el token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    // Verificar el token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verificar que el usuario existe y está activo
    const pool = await getConnection();
    const result = await pool.request()
      .input('idus', sql.Int, decoded.idus)
      .query(`
        SELECT IDUS, CodigoInterno, Nombres, TipoUsuario, Activo, Bloqueado
        FROM UsersSystems 
        WHERE IDUS = @idus AND Activo = 1 AND Bloqueado = 0
      `);

    if (result.recordset.length === 0) {
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

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    console.error('Error en middleware de autenticación:', error);
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
