const express = require('express');
const router = express.Router();
const guiasVentaController = require('../controllers/guiasVentaController');

// Verificar configuración de Tablas
router.get('/verificar-configuracion', guiasVentaController.verificarConfiguracionTablas);

// Obtener siguiente número de guía
router.get('/siguiente-numero', guiasVentaController.getSiguienteNumero);

// Buscar guía de venta por número
router.get('/buscar/:numero', guiasVentaController.buscarGuiaVenta);

// Insertar nueva guía de venta
router.post('/insertar', guiasVentaController.insertarGuiaVenta);

// Preparar datos para impresión
router.post('/preparar-impresion', guiasVentaController.prepararImpresion);

// Actualizar contador de guías
router.post('/actualizar-contador', guiasVentaController.actualizarContador);

// Actualizar contador de Guía de Venta
router.post('/actualizar-contador-guia-venta', guiasVentaController.actualizarContadorGuiaVenta);

module.exports = router; 