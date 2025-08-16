const express = require('express');
const router = express.Router();

// Obtener información de una sala específica
router.get('/sala/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Esta información la manejamos desde el servicio de WebSockets
    // pero podemos proporcionar endpoints básicos
    
    res.json({
      success: true,
      message: 'Información de sala disponible via WebSocket',
      roomId: roomId
    });
  } catch (error) {
    console.error('Error obteniendo información de sala:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Verificar si una sala existe (sin conectarse)
router.get('/verificar-sala/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Validar formato del ID de sala (5 dígitos)
    if (!/^\d{5}$/.test(roomId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de sala debe ser de 5 dígitos'
      });
    }
    
    res.json({
      success: true,
      valid: true,
      roomId: roomId
    });
  } catch (error) {
    console.error('Error verificando sala:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Generar un nuevo ID de sala
router.post('/generar-sala', async (req, res) => {
  try {
    // Generar ID de 5 dígitos
    const roomId = Math.floor(10000 + Math.random() * 90000).toString();
    
    res.json({
      success: true,
      roomId: roomId
    });
  } catch (error) {
    console.error('Error generando sala:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Estadísticas básicas del juego
router.get('/estadisticas', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Juego de 3 en raya funcionando',
      version: '1.0.0',
      features: [
        'Salas de 5 dígitos',
        'Juego en tiempo real',
        'Chat integrado',
        'Hasta 2 jugadores por sala'
      ]
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;
