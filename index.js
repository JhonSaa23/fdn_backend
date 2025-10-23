require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const medifarmaRoutes = require('./routes/medifarma');
const bcpRoutes = require('./routes/bcp');
const exportRoutes = require('./routes/export');
const movimientosRoutes = require('./routes/movimientos');
const reportesRoutes = require('./routes/reportes');
const promocionesRoutes = require('./routes/promociones');
const clientesRoutes = require('./routes/clientes');
const conteosRoutes = require('./routes/conteos');
const multiAccionRoutes = require('./routes/multiAccion');
const escalasRoutes = require('./routes/escalas');
const kardexRoutes = require('./routes/kardex');
const guiasRoutes = require('./routes/guias');
const bonificacionesRoutes = require('./routes/bonificaciones');
const pedidosRoutes = require('./routes/pedidos');
const saldosRoutes = require('./routes/saldos');
const { getConnection } = require('./database');
const productosRoutes = require('./routes/productos');
const canjeRoutes = require('./routes/canjeRoutes');
const guiasVentaRoutes = require('./routes/guiasVentaRoutes');
const botRoutes = require('./routes/botRoutes');
const juegoRoutes = require('./routes/juegoRoutes');
const vendedoresRoutes = require('./routes/vendedores');
const usersBotRoutes = require('./routes/usersBot');
const authRoutes = require('./routes/auth');
const authPasswordRoutes = require('./routes/auth-password');
const vistasRoutes = require('./routes/vistas');
const historialClienteRoutes = require('./routes/historialCliente');
const infocorpRoutes = require('./routes/infocorp');
const { router: pedidoAppRoutes } = require('./routes/pedido_app');
const seguimientoAppRoutes = require('./routes/seguimiento_app');
const productosAppRoutes = require('./routes/productos_app');
const clientesDetalleRoutes = require('./routes/clientes_detalle');
const letrasRoutes = require('./routes/letras');
const ventasAcFarmaRoutes = require('./routes/ventasAcFarma');
const ruperoRoutes = require('./routes/rupero');
const { authenticateToken, requireAdmin, optionalAuth } = require('./middleware/auth');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'Accept']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Configuración CORS ULTRA-ROBUSTA - ACEPTA TODO
app.use(cors({
  origin: true, // Permitir TODOS los orígenes
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'ngrok-skip-browser-warning', 
    'Accept',
    'X-Requested-With',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'Access-Control-Allow-Methods',
    'Access-Control-Allow-Headers',
    'Cache-Control',
    'Pragma',
    'User-Agent',
    'Referer'
  ],
  exposedHeaders: [
    'Content-Length', 
    'X-Foo', 
    'X-Bar',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'Access-Control-Allow-Methods',
    'Access-Control-Allow-Headers'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Middleware ULTRA-ROBUSTO para CORS y ngrok
app.use((req, res, next) => {
  
  // Headers CORS ULTRA-ROBUSTOS - SIEMPRE presentes
  res.header('Access-Control-Allow-Origin', '*'); // Permitir TODOS los orígenes
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', '*'); // Permitir TODOS los headers
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', '*');
  res.header('Access-Control-Max-Age', '86400'); // Cache por 24 horas
  
  // Headers específicos para ngrok
  res.header('ngrok-skip-browser-warning', 'true');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('X-Content-Type-Options', 'nosniff');
  
  // Manejar preflight requests de forma robusta
  if (req.method === 'OPTIONS') {
    
  }
  
  next();
});

// Aumentar límites para uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Middleware de debugging ULTRA-ROBUSTO para ngrok y CORS
app.use((req, res, next) => {
  // Debug para TODAS las peticiones CORS críticas
  if (req.method === 'OPTIONS' || 
      req.path.includes('/guias-canje/') || 
      req.path.includes('/api/')) {
    
  }
  
  // Debug específico para insertar-detalle
  if (req.path.includes('/guias-canje/insertar-detalle')) {
    console.log('🎯 [INSERTAR-DETALLE DEBUG]:', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      body: req.body,
      headers: {
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        ngrokSkip: req.headers['ngrok-skip-browser-warning'],
        contentType: req.headers['content-type']
      }
    });
  }
  
  // Debug para autorizar
  if (req.path.includes('/multi-accion/autorizar')) {
    console.log('🔍 REQUEST DEBUG:', {
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body,
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    });
  }
  next();
});

// Ruta para archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Asegurarse de que existe el directorio uploads
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Rutas de autenticación (públicas) - DEBEN IR PRIMERO
app.use('/api/auth', authRoutes);
app.use('/api/auth-password', authPasswordRoutes);

// Ruta pública para el bot (sin autenticación)
app.get('/api/bot/users/active', async (req, res) => {
  try {
    const usersBotController = require('./controllers/usersBotController.js');
    await usersBotController.getActiveUsers(req, res);
  } catch (error) {
    console.error('Error en endpoint público del bot:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Rutas del bot (protegidas)
app.use('/api/bot', authenticateToken, botRoutes);

// Rutas de usuarios del bot (protegidas)
app.use('/api/usersbot', authenticateToken, usersBotRoutes);

// Rutas del juego (públicas)
app.use('/api/juego', juegoRoutes);


// Rutas protegidas (requieren autenticación)
app.use('/api/medifarma', authenticateToken, medifarmaRoutes);
app.use('/api/bcp', authenticateToken, bcpRoutes);
app.use('/api/export', authenticateToken, exportRoutes);
app.use('/api/movimientos', authenticateToken, movimientosRoutes);
app.use('/api/reportes', authenticateToken, reportesRoutes);
app.use('/api/promociones', authenticateToken, promocionesRoutes);
app.use('/api/clientes', authenticateToken, clientesRoutes);
app.use('/api/conteos', authenticateToken, conteosRoutes);
app.use('/api/multi-accion', authenticateToken, multiAccionRoutes);
app.use('/api/escalas', authenticateToken, escalasRoutes);
app.use('/api/kardex', authenticateToken, kardexRoutes);
app.use('/api/guias', authenticateToken, guiasRoutes);
app.use('/api/bonificaciones', authenticateToken, bonificacionesRoutes);
app.use('/api/pedidos', authenticateToken, pedidosRoutes);
app.use('/api/saldos', authenticateToken, saldosRoutes);
app.use('/api/productos', authenticateToken, productosRoutes);
app.use('/api/guias-venta', authenticateToken, guiasVentaRoutes);
app.use('/api/vendedores', authenticateToken, vendedoresRoutes);

// Rutas de vistas - solo algunas requieren admin
app.use('/api/vistas', authenticateToken, vistasRoutes);
app.use('/api/historial-cliente', authenticateToken, historialClienteRoutes);

// Ruta protegida para Infocorp
app.use('/api/infocorp', authenticateToken, infocorpRoutes);

// Ruta para la app móvil de pedidos
app.use('/api/pedido_app', authenticateToken, pedidoAppRoutes);
app.use('/api/clientes', authenticateToken, clientesDetalleRoutes);

// Ruta para seguimiento de pedidos
app.use('/api/seguimiento_app', authenticateToken, seguimientoAppRoutes);

// Ruta para productos en tiempo real
app.use('/api/productos_app', authenticateToken, productosAppRoutes);

// Ruta para letras de cambio
app.use('/api/letras', authenticateToken, letrasRoutes);

// Ruta para Ventas AC Farma
app.use('/api/ventas-ac-farma', authenticateToken, ventasAcFarmaRoutes);

// Ruta para Rupero
app.use('/api/rupero', authenticateToken, ruperoRoutes);

// Ruta general de canje (DEBE IR AL FINAL)
app.use('/api', authenticateToken, canjeRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'API funcionando correctamente',
    endpoints: {
      api: '/api/*',
      bot: '/api/bot/*',
      uploads: '/uploads/*',
      juego: '/api/juego/*'
    },
    socketio: 'Disponible en /socket.io/'
  });
});

// Ruta de debug para productos (SIN AUTENTICACIÓN)
app.get('/debug/productos/:codpro', async (req, res) => {
  try {
    const { getConnection } = require('./database');
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
        CAST(afecto AS INT) AS afecto
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

// Ruta de prueba para socket.io
app.get('/socket-test', (req, res) => {
  res.json({
    message: 'Socket.io está configurado',
    connectedClients: io.engine.clientsCount,
    transports: io.engine.transports
  });
});

// Permitir archivos grandes
app.use((req, res, next) => {
  // Aumentar el tiempo de timeout para respuestas largas
  res.setTimeout(5 * 60 * 1000); // 5 minutos
  next();
});

// Servir frontend en producción
if (process.env.NODE_ENV === 'production') {
  // Servir archivos estáticos desde la carpeta build
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  // Para cualquier otra ruta, devolver el index.html
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend/dist', 'index.html'));
  });
}

// Middleware ULTRA-ROBUSTO para manejar errores específicos de ngrok
app.use((req, res, next) => {
  // Agregar headers adicionales para ngrok SIEMPRE
  res.header('ngrok-skip-browser-warning', 'true');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Log de todas las peticiones para debugging
  console.log(`🌐 [REQUEST] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'} - IP: ${req.ip}`);
  
  next();
});

// Manejador de errores global ULTRA-ROBUSTO
app.use((err, req, res, next) => {
  console.error('❌ [ERROR] Error no controlado:', err.stack);
  
  // Asegurar headers de CORS ULTRA-ROBUSTOS incluso en errores
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('ngrok-skip-browser-warning', 'true');
  
  // Asegurar que la respuesta sea válida
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? err.message : null,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug de conexiones socket.io
io.on('connection', (socket) => {
  console.log(`🔌 Socket conectado: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket desconectado: ${socket.id}, razón: ${reason}`);
  });
  
  socket.on('error', (error) => {
    console.error(`🔌 Error en socket ${socket.id}:`, error);
  });
});

// Lógica del juego de 3 en raya
require('./services/gameService')(io);

// Función para obtener la IP local
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      // Buscar IPv4 que no sea loopback
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

// Iniciar servidor
const PORT = process.env.PORT;
const localIP = getLocalIP();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`🤖 Bot API disponible en: http://localhost:${PORT}/api/bot`);
  console.log(`📡 API disponible en: http://localhost:${PORT}/api`);
  console.log(`📱 Accesible desde dispositivos móviles en: http://${localIP}:${PORT}/api`);
  console.log(`🎮 Juego WebSocket disponible en: http://localhost:${PORT}`);
}); 