require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const medifarmaRoutes = require('./routes/medifarma');
const bcpRoutes = require('./routes/bcp');
const exportRoutes = require('./routes/export');
const movimientosRoutes = require('./routes/movimientos');
const reportesRoutes = require('./routes/reportes');
const promocionesRoutes = require('./routes/promociones');
const multiAccionRoutes = require('./routes/multiAccion');
const escalasRoutes = require('./routes/escalas');
const { getConnection } = require('./database');

const app = express();

// Configuración CORS
app.use(cors());

// Aumentar límites para uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

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
app.use('/api/export', exportRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/promociones', promocionesRoutes);
app.use('/api/multi-accion', multiAccionRoutes);
app.use('/api/escalas', escalasRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
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

// Iniciar servidor
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
}); 