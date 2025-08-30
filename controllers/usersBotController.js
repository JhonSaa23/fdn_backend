const sql = require('mssql');
const dbService = require('../services/dbService.js');

// Obtener todos los usuarios del bot
const getAllUsers = async (req, res) => {
    try {
        const query = `
            SELECT 
                CodUserBot,
                Nombre,
                Numero,
                Rol,
                Laboratorio,
                Activo,
                FechaCreacion,
                FechaModificacion,
                CreadoPor,
                ModificadoPor,
                CASE 
                    WHEN Rol = 'ADMIN' THEN 'Administrador'
                    WHEN Rol = 'USER' THEN 'Usuario'
                    ELSE Rol
                END AS RolDescripcion,
                CASE 
                    WHEN Activo = 1 THEN 'Activo'
                    ELSE 'Inactivo'
                END AS EstadoDescripcion
            FROM UsersBot 
            ORDER BY Nombre
        `;

        const result = await dbService.executeQuery(query);
        
        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener usuarios del bot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios del bot',
            error: error.message
        });
    }
};

// Obtener usuarios activos
const getActiveUsers = async (req, res) => {
    try {
        const query = `
            SELECT 
                CodUserBot,
                Nombre,
                Numero,
                Rol,
                Laboratorio,
                Activo,
                FechaCreacion
            FROM UsersBot 
            WHERE Activo = 1
            ORDER BY Nombre
        `;

        const result = await dbService.executeQuery(query);
        
        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener usuarios activos del bot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios activos del bot',
            error: error.message
        });
    }
};

// Obtener usuario por ID
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                CodUserBot,
                Nombre,
                Numero,
                Rol,
                Laboratorio,
                Activo,
                FechaCreacion,
                FechaModificacion,
                CreadoPor,
                ModificadoPor
            FROM UsersBot 
            WHERE CodUserBot = @id
        `;

        const result = await dbService.executeQuery(query, [
            { name: 'id', type: sql.NVarChar, value: id }
        ]);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {
        console.error('Error al obtener usuario del bot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuario del bot',
            error: error.message
        });
    }
};

// Crear nuevo usuario
const createUser = async (req, res) => {
    try {
        const { codUserBot, nombre, numero, rol = 'USER', laboratorio, creadoPor } = req.body;

        // Validaciones
        if (!codUserBot || !nombre || !numero) {
            return res.status(400).json({
                success: false,
                message: 'Código de usuario, nombre y número son obligatorios'
            });
        }

        // Verificar si el código de usuario ya existe
        const checkCodQuery = `
            SELECT CodUserBot FROM UsersBot WHERE CodUserBot = @codUserBot
        `;

        const checkCodResult = await dbService.executeQuery(checkCodQuery, [
            { name: 'codUserBot', type: sql.NVarChar, value: codUserBot }
        ]);

        if (checkCodResult.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El código de usuario ya está registrado'
            });
        }

        // Verificar si el número ya existe
        const checkNumQuery = `
            SELECT CodUserBot FROM UsersBot WHERE Numero = @numero
        `;

        const checkNumResult = await dbService.executeQuery(checkNumQuery, [
            { name: 'numero', type: sql.VarChar, value: numero }
        ]);

        if (checkNumResult.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El número ya está registrado'
            });
        }

        const query = `
            INSERT INTO UsersBot (CodUserBot, Nombre, Numero, Rol, Laboratorio, CreadoPor)
            VALUES (@codUserBot, @nombre, @numero, @rol, @laboratorio, @creadoPor);
        `;

        const result = await dbService.executeQuery(query, [
            { name: 'codUserBot', type: sql.NVarChar, value: codUserBot },
            { name: 'nombre', type: sql.NVarChar, value: nombre },
            { name: 'numero', type: sql.VarChar, value: numero },
            { name: 'rol', type: sql.NVarChar, value: rol },
            { name: 'laboratorio', type: sql.NVarChar, value: laboratorio || null },
            { name: 'creadoPor', type: sql.NVarChar, value: creadoPor || null }
        ]);

        res.status(201).json({
            success: true,
            message: 'Usuario creado exitosamente',
            data: { CodUserBot: codUserBot }
        });

    } catch (error) {
        console.error('Error al crear usuario del bot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear usuario del bot',
            error: error.message
        });
    }
};

// Actualizar usuario
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { codUserBot, nombre, numero, rol, laboratorio, activo, modificadoPor } = req.body;

        // Validaciones
        if (!codUserBot || !nombre || !numero || !rol) {
            return res.status(400).json({
                success: false,
                message: 'Código de usuario, nombre, número y rol son obligatorios'
            });
        }

        // Verificar si el código de usuario ya existe en otro usuario
        const checkCodQuery = `
            SELECT CodUserBot FROM UsersBot 
            WHERE CodUserBot = @codUserBot AND CodUserBot != @id
        `;

        const checkCodResult = await dbService.executeQuery(checkCodQuery, [
            { name: 'codUserBot', type: sql.NVarChar, value: codUserBot },
            { name: 'id', type: sql.NVarChar, value: id }
        ]);

        if (checkCodResult.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El código de usuario ya está registrado por otro usuario'
            });
        }

        // Verificar si el número ya existe en otro usuario
        const checkNumQuery = `
            SELECT CodUserBot FROM UsersBot 
            WHERE Numero = @numero AND CodUserBot != @id
        `;

        const checkNumResult = await dbService.executeQuery(checkNumQuery, [
            { name: 'numero', type: sql.VarChar, value: numero },
            { name: 'id', type: sql.NVarChar, value: id }
        ]);

        if (checkNumResult.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El número ya está registrado por otro usuario'
            });
        }

        const query = `
            UPDATE UsersBot 
            SET 
                CodUserBot = @codUserBot,
                Nombre = @nombre,
                Numero = @numero,
                Rol = @rol,
                Laboratorio = @laboratorio,
                Activo = @activo,
                FechaModificacion = GETDATE(),
                ModificadoPor = @modificadoPor
            WHERE CodUserBot = @id
        `;

        const result = await dbService.executeQuery(query, [
            { name: 'codUserBot', type: sql.NVarChar, value: codUserBot },
            { name: 'nombre', type: sql.NVarChar, value: nombre },
            { name: 'numero', type: sql.VarChar, value: numero },
            { name: 'rol', type: sql.NVarChar, value: rol },
            { name: 'laboratorio', type: sql.NVarChar, value: laboratorio || null },
            { name: 'activo', type: sql.Bit, value: activo !== undefined ? activo : 1 },
            { name: 'modificadoPor', type: sql.NVarChar, value: modificadoPor || null },
            { name: 'id', type: sql.NVarChar, value: id }
        ]);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Usuario actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar usuario del bot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar usuario del bot',
            error: error.message
        });
    }
};

// Eliminar usuario (desactivar)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { modificadoPor } = req.body;

        const query = `
            UPDATE UsersBot 
            SET 
                Activo = 0,
                FechaModificacion = GETDATE(),
                ModificadoPor = @modificadoPor
            WHERE CodUserBot = @id
        `;

        const result = await dbService.executeQuery(query, [
            { name: 'modificadoPor', type: sql.NVarChar, value: modificadoPor || null },
            { name: 'id', type: sql.NVarChar, value: id }
        ]);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Usuario desactivado exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar usuario del bot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar usuario del bot',
            error: error.message
        });
    }
};

// Obtener laboratorios disponibles
const getLaboratorios = async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT Laboratorio 
            FROM UsersBot 
            WHERE Laboratorio IS NOT NULL AND Laboratorio != ''
            ORDER BY Laboratorio
        `;

        const result = await dbService.executeQuery(query);
        
        res.json({
            success: true,
            data: result.recordset.map(row => row.Laboratorio)
        });

    } catch (error) {
        console.error('Error al obtener laboratorios:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener laboratorios',
            error: error.message
        });
    }
};

// Obtener auditoría de cambios
const getAuditLog = async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const query = `
            SELECT TOP ${parseInt(limit)}
                ua.Id,
                ua.CodUserBot,
                u.Nombre,
                u.Numero,
                ua.Accion,
                ua.ValoresAnteriores,
                ua.ValoresNuevos,
                ua.FechaAccion,
                ua.UsuarioAccion
            FROM UsersBotAudit ua
            LEFT JOIN UsersBot u ON ua.CodUserBot = u.CodUserBot
            ORDER BY ua.FechaAccion DESC
        `;

        const result = await dbService.executeQuery(query);
        
        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('Error al obtener auditoría:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener auditoría',
            error: error.message
        });
    }
};

module.exports = {
    getAllUsers,
    getActiveUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    getLaboratorios,
    getAuditLog
};
