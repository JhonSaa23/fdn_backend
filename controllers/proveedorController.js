const dbService = require('../services/dbService');
const sql = require('mssql');

// Obtener proveedores por laboratorio
exports.getProveedoresByLaboratorio = async (req, res) => {
    const { codLab } = req.params;
    try {
        const result = await dbService.executeQuery(
            'EXEC sp_proveedores_buscaXlabo @labo',
            [{ name: 'labo', type: sql.NVarChar, value: codLab.trim() }]
        );
        res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error en getProveedoresByLaboratorio:', error);
        res.status(500).json({ success: false, message: 'Error al obtener proveedores por laboratorio', error: error.message });
    }
};

// Obtener lista de transportistas
exports.getTransportistas = async (req, res) => {
    try {
        const result = await dbService.executeQuery('EXEC sp_Proveedores_listar3');
        res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error en getTransportistas:', error);
        res.status(500).json({ success: false, message: 'Error al obtener transportistas', error: error.message });
    }
};

// Obtener detalles de un proveedor/transportista por código o razón
exports.getProveedorDetalle = async (req, res) => {
    const { codProv } = req.params;
    try {
        let result;
        
        if (codProv && codProv.trim() !== '') {
            // Si hay código, usar el stored procedure original
            console.log('🔍 Buscando proveedor por código:', codProv);
            result = await dbService.executeQuery(
                'EXEC sp_Proveedores_buscaxcuenta @p',
                [{ name: 'p', type: sql.NVarChar, value: codProv.trim() }]
            );
        } else {
            // Si no hay código, buscar por razón (para transportistas sin código)
            console.log('🔍 Buscando proveedor sin código, se requiere razón');
            res.status(400).json({ 
                success: false, 
                message: 'Se requiere razón para buscar proveedor sin código',
                requiresRazon: true 
            });
            return;
        }
        
        res.status(200).json({ success: true, data: result.recordset[0] || null });
    } catch (error) {
        console.error('Error en getProveedorDetalle:', error);
        res.status(500).json({ success: false, message: 'Error al obtener detalles del proveedor', error: error.message });
    }
};

// Obtener detalles de un proveedor/transportista por razón (para casos sin código)
exports.getProveedorDetalleByRazon = async (req, res) => {
    const { razon } = req.params;
    try {
        console.log('🔍 Buscando proveedor por razón:', razon);
        
        const result = await dbService.executeQuery(
            `SELECT *, dbo.MiNombrePropio(left(razon,50)) as EnMinusculas
             FROM Proveedores 
             WHERE Razon = @razon AND Eliminado = 0`,
            [{ name: 'razon', type: sql.NVarChar, value: razon.trim() }]
        );
        
        if (result.recordset.length > 0) {
            console.log('✅ Proveedor encontrado por razón:', result.recordset[0]);
            res.status(200).json({ success: true, data: result.recordset[0] });
        } else {
            console.log('⚠️ No se encontró proveedor con razón:', razon);
            res.status(404).json({ success: false, message: 'Proveedor no encontrado' });
        }
    } catch (error) {
        console.error('Error en getProveedorDetalleByRazon:', error);
        res.status(500).json({ success: false, message: 'Error al obtener detalles del proveedor por razón', error: error.message });
    }
}; 