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
const vistasRoutes = require('./routes/vistas');
const historialClienteRoutes = require('./routes/historialCliente');
const infocorpRoutes = require('./routes/infocorp');
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

// Configuración CORS mejorada para ngrok
app.use(cors({
  origin: true, // Permitir todos los orígenes en desarrollo
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'Accept']
}));

// Aumentar límites para uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Middleware de debugging para ngrok
app.use((req, res, next) => {
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
app.use('/api', authenticateToken, canjeRoutes);

// Rutas de vistas - solo algunas requieren admin
app.use('/api/vistas', authenticateToken, vistasRoutes);
app.use('/api/historial-cliente', authenticateToken, historialClienteRoutes);

// Ruta protegida para Infocorp
app.use('/api/infocorp', authenticateToken, infocorpRoutes);

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

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : null
  });
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

// Iniciar servidor
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`🤖 Bot API disponible en: http://localhost:${PORT}/api/bot`);
  console.log(`📡 API disponible en: http://localhost:${PORT}/api`);
  console.log(`🎮 Juego WebSocket disponible en: http://localhost:${PORT}`);
}); 