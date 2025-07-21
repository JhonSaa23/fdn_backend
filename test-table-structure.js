require('dotenv').config();
const dbService = require('./services/dbService');

async function testTableStructure() {
    try {
        console.log('🔍 Verificando estructura de tablas...');
        
        // 1. Verificar estructura de la tabla Productos
        console.log('📋 Verificando tabla Productos...');
        const productosStructure = await dbService.executeQuery('SELECT TOP 1 * FROM Productos');
        console.log('✅ Columnas de Productos:', Object.keys(productosStructure.recordset[0] || {}));
        
        // 2. Verificar estructura de la tabla provlab
        console.log('📋 Verificando tabla provlab...');
        const provlabStructure = await dbService.executeQuery('SELECT TOP 1 * FROM provlab');
        console.log('✅ Columnas de provlab:', Object.keys(provlabStructure.recordset[0] || {}));
        
        // 3. Verificar estructura de la tabla DetaGuiaDevo
        console.log('📋 Verificando tabla DetaGuiaDevo...');
        const detaGuiaDevoStructure = await dbService.executeQuery('SELECT TOP 1 * FROM DetaGuiaDevo');
        console.log('✅ Columnas de DetaGuiaDevo:', Object.keys(detaGuiaDevoStructure.recordset[0] || {}));
        
        // 4. Verificar algunos registros de ejemplo
        console.log('📋 Ejemplo de registro de Productos:');
        console.log(productosStructure.recordset[0]);
        
        console.log('📋 Ejemplo de registro de provlab:');
        console.log(provlabStructure.recordset[0]);
        
        console.log('📋 Ejemplo de registro de DetaGuiaDevo:');
        console.log(detaGuiaDevoStructure.recordset[0]);
        
    } catch (error) {
        console.error('❌ Error en la verificación:', error);
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

testTableStructure(); 