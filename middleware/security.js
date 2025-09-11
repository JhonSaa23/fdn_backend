const crypto = require('crypto');

// Configuración de seguridad
const SECURITY_CONFIG = {
  MAX_ATTEMPTS: 3,           // Máximo intentos por IP
  BLOCK_DURATION: 15 * 60 * 1000, // 15 minutos en ms
  CODE_LENGTH: 6,            // Código de 6 dígitos (más seguro)
  CODE_EXPIRY: 1 * 60 * 1000, // 1 minuto en ms
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minuto
  RATE_LIMIT_MAX: 5          // Máximo 5 intentos por minuto
};

// Almacenar intentos fallidos por IP
const failedAttempts = new Map();
const rateLimit = new Map();

// Función para limpiar intentos expirados
const cleanupExpiredAttempts = () => {
  const now = Date.now();
  for (const [ip, data] of failedAttempts.entries()) {
    if (now - data.lastAttempt > SECURITY_CONFIG.BLOCK_DURATION) {
      failedAttempts.delete(ip);
    }
  }
  for (const [ip, data] of rateLimit.entries()) {
    if (now - data.windowStart > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
      rateLimit.delete(ip);
    }
  }
};

// Limpiar cada 5 minutos
setInterval(cleanupExpiredAttempts, 5 * 60 * 1000);

// Middleware para verificar intentos fallidos
const checkFailedAttempts = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  // Verificar rate limiting
  if (rateLimit.has(ip)) {
    const data = rateLimit.get(ip);
    if (now - data.windowStart < SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
      if (data.count >= SECURITY_CONFIG.RATE_LIMIT_MAX) {
        return res.status(429).json({
          success: false,
          message: 'Demasiados intentos. Intenta nuevamente en 1 minuto.',
          retryAfter: Math.ceil((SECURITY_CONFIG.RATE_LIMIT_WINDOW - (now - data.windowStart)) / 1000)
        });
      }
    } else {
      // Reset window
      rateLimit.set(ip, { count: 0, windowStart: now });
    }
  } else {
    rateLimit.set(ip, { count: 0, windowStart: now });
  }
  
  // Verificar intentos fallidos
  if (failedAttempts.has(ip)) {
    const data = failedAttempts.get(ip);
    if (now - data.lastAttempt < SECURITY_CONFIG.BLOCK_DURATION) {
      if (data.count >= SECURITY_CONFIG.MAX_ATTEMPTS) {
        const remainingTime = Math.ceil((SECURITY_CONFIG.BLOCK_DURATION - (now - data.lastAttempt)) / 1000);
        return res.status(429).json({
          success: false,
          message: `IP bloqueada por ${remainingTime} segundos debido a intentos fallidos.`,
          retryAfter: remainingTime
        });
      }
    } else {
      // Reset attempts
      failedAttempts.delete(ip);
    }
  }
  
  next();
};

// Función para registrar intento fallido
const recordFailedAttempt = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (failedAttempts.has(ip)) {
    const data = failedAttempts.get(ip);
    data.count++;
    data.lastAttempt = now;
  } else {
    failedAttempts.set(ip, { count: 1, lastAttempt: now });
  }
  
  // Incrementar rate limit
  if (rateLimit.has(ip)) {
    const data = rateLimit.get(ip);
    data.count++;
  }
};

// Función para limpiar intentos exitosos
const clearFailedAttempts = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  failedAttempts.delete(ip);
};

// Función para generar código más seguro
const generateSecureCode = () => {
  // Usar crypto.randomInt para mayor seguridad
  return crypto.randomInt(100000, 999999).toString();
};

// Función para hashear código (opcional, para almacenamiento)
const hashCode = (code) => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

// Función para verificar código hasheado
const verifyHashedCode = (code, hashedCode) => {
  return hashCode(code) === hashedCode;
};

module.exports = {
  SECURITY_CONFIG,
  checkFailedAttempts,
  recordFailedAttempt,
  clearFailedAttempts,
  generateSecureCode,
  hashCode,
  verifyHashedCode
};
