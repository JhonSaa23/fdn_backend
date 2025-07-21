require('dotenv').config();
const dbService = require('./services/dbService');

async function testProductosADevolver() {
    try {
        console.log('🔍 Probando consulta de productos a devolver...');
        
        const codLab = '89'; // Laboratorio Abbott
        console.log('🏥 Laboratorio a probar:', codLab);
        
        // Probar la consulta paso a paso
        console.log('🔍 Paso 1: Verificar tabla provlab...');
        const provlabResult = await dbService.executeQuery(
            `SELECT * FROM provlab WHERE laboratorio = @codLab`,
            [{ name: 'codLab', type: 'NVarChar', value: codLab }]
        );
        console.log('✅ Proveedores del laboratorio:', provlabResult.recordset);
        
        if (provlabResult.recordset.length === 0) {
            console.log('⚠️ No se encontraron proveedores para el laboratorio', codLab);
            return;
        }
        
        console.log('🔍 Paso 2: Verificar productos de los proveedores...');
        const proveedores = provlabResult.recordset.map(p => p.proveedor);
        console.log('📋 Proveedores encontrados:', proveedores);
        
        const productosResult = await dbService.executeQuery(
            `SELECT TOP 5 p.Codpro, p.Nombre, p.Proveedor 
             FROM Productos p 
             WHERE p.Proveedor IN (${proveedores.map((_, i) => `@prov${i}`).join(',')})`,
            proveedores.map((prov, i) => ({ name: `prov${i}`, type: 'NVarChar', value: prov }))
        );
        console.log('✅ Productos encontrados:', productosResult.recordset);
        
        console.log('🔍 Paso 3: Verificar guías de devolución...');
        const guiasResult = await dbService.executeQuery(
            `SELECT TOP 5 * FROM DetaGuiaDevo WHERE Codpro IN (${productosResult.recordset.map((_, i) => `@prod${i}`).join(',')})`,
            productosResult.recordset.map((prod, i) => ({ name: `prod${i}`, type: 'NVarChar', value: prod.Codpro }))
        );
        console.log('✅ Guías de devolución encontradas:', guiasResult.recordset);
        
        console.log('🔍 Paso 4: Probar consulta completa...');
        const result = await dbService.executeQuery(
            `SELECT DISTINCT 
                d.Codpro, 
                p.Nombre, 
                d.Lote, 
                d.Vencimiento, 
                d.Cantidad, 
                d.NroGuia, 
                d.Referencia, 
                d.tipodoc,
                d.Procesado
            FROM DetaGuiaDevo d
            INNER JOIN Productos p ON d.Codpro = p.Codpro
            INNER JOIN provlab pl ON p.Proveedor = pl.proveedor
            WHERE pl.laboratorio = @codLab 
            AND d.Procesado = 0
            ORDER BY p.Nombre, d.Lote`,
            [{ name: 'codLab', type: 'NVarChar', value: codLab }]
        );
        console.log('✅ Resultado final:', result.recordset.length, 'productos encontrados');
        console.log('📋 Primeros 3 productos:', result.recordset.slice(0, 3));
        
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

testProductosADevolver(); 