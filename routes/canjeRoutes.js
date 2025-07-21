const express = require('express');
const router = express.Router();
const canjeController = require('../controllers/canjeController');
const proveedorController = require('../controllers/proveedorController');
const laboratorioController = require('../controllers/laboratorioController');
const guiaDevoController = require('../controllers/guiaDevoController');

// Rutas para guías de canje
router.get('/guias-canje', canjeController.listarGuiasCanje);
router.get('/guias-canje/next-number', canjeController.getSigNroGuiaCanje);
router.get('/guias-canje/estructura-tabla', canjeController.verificarEstructuraTabla);
router.get('/guias-canje/buscar/:numero', canjeController.buscarGuiaCanje);
router.get('/guias-canje/:nroGuia', canjeController.obtenerGuiaCanjeResumen);
router.get('/guias-canje/:nroGuia/cabecera', canjeController.obtenerCabeceraGuiaCanje);
router.get('/guias-canje/:nroGuia/detalles', canjeController.obtenerDetallesGuiaCanje);
router.post('/guias-canje', canjeController.registrarGuiaCanje);
router.post('/guias-canje/insertar-cabecera', canjeController.insertarCabeceraGuiaCanje);
router.post('/guias-canje/insertar-detalle', canjeController.insertarDetalleGuiaCanje);
router.post('/guias-canje/actualizar-contador-devolucion', canjeController.actualizarContadorDevolucion);
router.delete('/guias-canje/:nroGuia', canjeController.eliminarGuiaCanje);
router.delete('/guias-canje/:nroGuia/completa', canjeController.eliminarGuiaCanjeCompleta);

// Rutas para DoccabGuia
router.get('/cab-guias', canjeController.listarCabGuias);
router.delete('/cab-guias/:numero', canjeController.eliminarCabGuia);
router.get('/cab-guias/ultimo-numero', canjeController.obtenerUltimoNumeroCabGuia);
router.put('/cab-guias/ultimo-numero', canjeController.actualizarUltimoNumeroCabGuia);

// Rutas relacionadas con proveedores
router.get('/proveedores/laboratorio/:codLab', proveedorController.getProveedoresByLaboratorio);
router.get('/proveedores/transportistas', proveedorController.getTransportistas);
router.get('/proveedores/detalle/:codProv', proveedorController.getProveedorDetalle);
router.get('/proveedores/detalle-razon/:razon', proveedorController.getProveedorDetalleByRazon);

// Rutas relacionadas con laboratorios
router.get('/laboratorios', laboratorioController.listarLaboratorios);
router.get('/laboratorios/buscar-descripcion/:descripcion', laboratorioController.buscarLaboratorioPorDescripcion);
router.get('/laboratorios/:codLab', laboratorioController.buscarLaboratorioPorCodigo);

// Rutas relacionadas con guías de devolución
router.get('/guias-devolucion/:codLab/productos-a-devolver', guiaDevoController.listarProductosADevolver);

module.exports = router; 