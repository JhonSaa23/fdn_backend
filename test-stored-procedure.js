require('dotenv').config();
const dbService = require('./services/dbService');
const sql = require('mssql');

async function testStoredProcedure() {
    try {
        console.log('🔍 Probando stored procedure sp_GuiasDevo_xDevolver...');
        
        const codLab = '89  '; // Laboratorio Abbott con espacios
        
        // Ejecutar el stored procedure
        const result = await dbService.executeQuery(
            `EXEC sp_GuiasDevo_xDevolver @codLab`,
            [{ name: 'codLab', type: sql.NVarChar, value: codLab }]
        );
        
        console.log('✅ Resultado del stored procedure:');
        console.log('📋 Número de registros:', result.recordset.length);
        console.log('📋 Primeros 5 registros:', result.recordset.slice(0, 5));
        
        // Mostrar la estructura de los datos
        if (result.recordset.length > 0) {
            console.log('📋 Estructura de los datos:');
            console.log('Columnas:', Object.keys(result.recordset[0]));
        }
        
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

testStoredProcedure(); 