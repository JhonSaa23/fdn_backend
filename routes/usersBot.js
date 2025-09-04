const express = require('express');
const router = express.Router();
const usersBotController = require('../controllers/usersBotController.js');

// Obtener todos los usuarios del bot
router.get('/', usersBotController.getAllUsers);

// Obtener usuarios activos
router.get('/active', usersBotController.getActiveUsers);

// Obtener usuario por ID
router.get('/:id', usersBotController.getUserById);

// Crear nuevo usuario
router.post('/', usersBotController.createUser);

// Actualizar usuario
router.put('/:id', usersBotController.updateUser);

// Desactivar usuario (cambiar estado a inactivo)
router.patch('/:id/deactivate', usersBotController.deactivateUser);

// Reactivar usuario (cambiar estado a activo)
router.patch('/:id/activate', usersBotController.activateUser);

// Eliminar usuario completamente de la base de datos
router.delete('/:id', usersBotController.deleteUser);

// Obtener laboratorios disponibles
router.get('/laboratorios/list', usersBotController.getLaboratorios);

// Obtener auditoría de cambios
router.get('/audit/log', usersBotController.getAuditLog);

module.exports = router;
