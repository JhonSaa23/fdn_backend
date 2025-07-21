require('dotenv').config();
const dbService = require('./services/dbService');
const sql = require('mssql');

async function testQueryStepByStep() {
    try {
        console.log('🔍 Probando consulta paso a paso...');
        
        const codLab = '89'; // Laboratorio Abbott
        
        // Paso 1: Obtener proveedores del laboratorio
        console.log('📋 Paso 1: Obtener proveedores del laboratorio', codLab);
        const proveedoresResult = await dbService.executeQuery(
            `SELECT * FROM provlab WHERE Laboratorio = @codLab`,
            [{ name: 'codLab', type: sql.NVarChar, value: codLab }]
        );
        
        console.log('✅ Proveedores encontrados:', proveedoresResult.recordset.length);
        console.log('📋 Proveedores:', proveedoresResult.recordset);
        
        if (proveedoresResult.recordset.length === 0) {
            console.log('⚠️ No hay proveedores para este laboratorio');
            return;
        }
        
        // Paso 2: Obtener productos de esos proveedores
        const proveedores = proveedoresResult.recordset.map(p => p.Proveedor.trim());
        console.log('📋 Paso 2: Obtener productos de proveedores:', proveedores);
        
        const productosResult = await dbService.executeQuery(
            `SELECT TOP 5 Codpro, Nombre, CodProv FROM Productos WHERE CodProv IN (${proveedores.map((_, i) => `@prov${i}`).join(',')})`,
            proveedores.map((prov, i) => ({ name: `prov${i}`, type: sql.NVarChar, value: prov }))
        );
        
        console.log('✅ Productos encontrados:', productosResult.recordset.length);
        console.log('📋 Productos:', productosResult.recordset);
        
        if (productosResult.recordset.length === 0) {
            console.log('⚠️ No hay productos para estos proveedores');
            return;
        }
        
        // Paso 3: Obtener guías de devolución
        const productos = productosResult.recordset.map(p => p.Codpro);
        console.log('📋 Paso 3: Obtener guías de devolución para productos:', productos);
        
        const guiasResult = await dbService.executeQuery(
            `SELECT TOP 5 * FROM DetaGuiaDevo WHERE Codpro IN (${productos.map((_, i) => `@prod${i}`).join(',')}) AND Procesado = 0`,
            productos.map((prod, i) => ({ name: `prod${i}`, type: sql.NVarChar, value: prod }))
        );
        
        console.log('✅ Guías de devolución encontradas:', guiasResult.recordset.length);
        console.log('📋 Guías:', guiasResult.recordset);
        
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

testQueryStepByStep(); 