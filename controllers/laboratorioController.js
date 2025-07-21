const dbService = require('../services/dbService');
const sql = require('mssql');

// BOTON NUEVO (Listar Laboratorios)
exports.listarLaboratorios = async (req, res) => {
    try {
        const result = await dbService.executeQuery(
            "SELECT codlab, LEFT(Descripcion,50) as Descripcion, Mantiene FROM Laboratorios WHERE Mantiene=1 ORDER BY Descripcion"
        );
        res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error en listarLaboratorios:', error);
        res.status(500).json({ success: false, message: 'Error al listar laboratorios', error: error.message });
    }
};

// SELECCIONA EL LAB (Buscar por Descripción)
exports.buscarLaboratorioPorDescripcion = async (req, res) => {
    const { descripcion } = req.params;
    try {
        const result = await dbService.executeQuery(
            `SELECT * FROM Laboratorios WHERE Descripcion LIKE @descripcion + '%'`,
            [{ name: 'descripcion', type: sql.NVarChar, value: descripcion.trim() }]
        );
        res.status(200).json({ success: true, data: result.recordset[0] || null });
    } catch (error) {
        console.error('Error en buscarLaboratorioPorDescripcion:', error);
        res.status(500).json({ success: false, message: 'Error al buscar laboratorio por descripción', error: error.message });
    }
};

// SELECCIONA EL LAB (Buscar por Código)
exports.buscarLaboratorioPorCodigo = async (req, res) => {
    const { codLab } = req.params;
    try {
        const result = await dbService.executeQuery(
            `SELECT * FROM Laboratorios WHERE CodLab=@codLab`,
            [{ name: 'codLab', type: sql.NVarChar, value: codLab.trim() }]
        );
        res.status(200).json({ success: true, data: result.recordset[0] || null });
    } catch (error) {
        console.error('Error en buscarLaboratorioPorCodigo:', error);
        res.status(500).json({ success: false, message: 'Error al buscar laboratorio por código', error: error.message });
    }
}; 