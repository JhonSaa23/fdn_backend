const express = require('express');
const router = express.Router();
const ventasAcFarmaController = require('../controllers/ventasAcFarmaController');

// Consultar reporte de Ventas AC Farma
router.get('/consultar', ventasAcFarmaController.consultarVentasAcFarma);

// Exportar a Excel
router.get('/exportar', ventasAcFarmaController.exportarVentasAcFarmaExcel);

// Obtener laboratorios disponibles
router.get('/laboratorios', ventasAcFarmaController.obtenerLaboratoriosAcFarma);

module.exports = router;

