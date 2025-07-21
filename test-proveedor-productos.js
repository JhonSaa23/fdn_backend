require('dotenv').config();
const dbService = require('./services/dbService');
const sql = require('mssql');

async function testProveedorProductos() {
    try {
        console.log('🔍 Verificando productos del proveedor 0151...');
        
        // Verificar productos del proveedor 0151
        const productosResult = await dbService.executeQuery(
            `SELECT TOP 10 Codpro, Nombre, CodProv FROM Productos WHERE CodProv = @proveedor`,
            [{ name: 'proveedor', type: sql.NVarChar, value: '0151' }]
        );
        
        console.log('✅ Productos del proveedor 0151:', productosResult.recordset.length);
        console.log('📋 Productos:', productosResult.recordset);
        
        // Verificar todos los proveedores en provlab
        console.log('🔍 Verificando todos los proveedores en provlab...');
        const allProveedoresResult = await dbService.executeQuery(
            `SELECT * FROM provlab ORDER BY Laboratorio`
        );
        
        console.log('✅ Todos los proveedores:', allProveedoresResult.recordset.length);
        console.log('📋 Primeros 10 proveedores:', allProveedoresResult.recordset.slice(0, 10));
        
        // Verificar laboratorios que tienen productos
        console.log('🔍 Verificando laboratorios con productos...');
        const laboratoriosConProductos = await dbService.executeQuery(
            `SELECT DISTINCT pl.Laboratorio, COUNT(p.Codpro) as ProductosCount
             FROM provlab pl
             INNER JOIN Productos p ON pl.Proveedor = p.CodProv
             GROUP BY pl.Laboratorio
             HAVING COUNT(p.Codpro) > 0
             ORDER BY ProductosCount DESC`
        );
        
        console.log('✅ Laboratorios con productos:', laboratoriosConProductos.recordset.length);
        console.log('📋 Top 10 laboratorios con más productos:', laboratoriosConProductos.recordset.slice(0, 10));
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error);
        console.error('❌ Stack trace:', error.stack);
    } finally {
        try {
            await dbService.closePool();
            console.log('🔒 Conexión cerrada');
        } catch (error) {
            console.log('⚠️ Error al cerrar conexión:', error.message);
        }
    }
}

testProveedorProductos(); 