const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const medifarmaRoutes = require('./routes/medifarma');
const bcpRoutes = require('./routes/bcp');
const bbvaRoutes = require('./routes/bbva');
const desclienteRoutes = require('./routes/descliente');
const exportRoutes = require('./routes/export');
const letrasRoutes = require('./routes/letras');
const tipificacionesRoutes = require('./routes/tipificaciones');
const movimientosRoutes = require('./routes/movimientos');
const reportesRoutes = require('./routes/reportes');

const app = express();

// Configuración CORS
app.use(cors({
  origin: '*', // Permitir cualquier origen en desarrollo
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Aumentar límites para uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ruta para archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Asegurarse de que existe el directorio uploads
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Rutas
app.use('/api/medifarma', medifarmaRoutes);
app.use('/api/bcp', bcpRoutes);
app.use('/api/bbva', bbvaRoutes);
app.use('/api/descliente', desclienteRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/letras', letrasRoutes);
app.use('/api/tipificaciones', tipificacionesRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/reportes', reportesRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del servidor' 
  });
});

// Iniciar servidor
const PORT = config.port || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
}); 