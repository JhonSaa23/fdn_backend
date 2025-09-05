require('dotenv').config();
const dbService = require('./services/dbService');

async function testStoredProcedureDeta() {
    try {
        console.log('🔍 Verificando stored procedure sp_DetaGuiaCanje_insertar...');
        
        // Verificar si el stored procedure existe
        const spExists = await dbService.executeQuery(
            `SELECT name FROM sys.procedures WHERE name = 'sp_DetaGuiaCanje_insertar'`
        );
        
        if (spExists.recordset.length === 0) {
            console.log('❌ El stored procedure sp_DetaGuiaCanje_insertar NO existe');
            return;
        }
        
        console.log('✅ El stored procedure sp_DetaGuiaCanje_insertar existe');
        
        // Obtener la definición del stored procedure
        const spDefinition = await dbService.executeQuery(
            `SELECT OBJECT_DEFINITION(OBJECT_ID('sp_DetaGuiaCanje_insertar')) as definition`
        );
        
        if (spDefinition.recordset.length > 0) {
            console.log('\n📋 Definición del stored procedure:');
            console.log(spDefinition.recordset[0].definition);
        }
        
        // Verificar parámetros del stored procedure
        const spParams = await dbService.executeQuery(
            `SELECT 
                p.name as parameter_name,
                t.name as data_type,
                p.max_length,
                p.precision,
                p.scale,
                p.is_output
             FROM sys.parameters p
             INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
             WHERE p.object_id = OBJECT_ID('sp_DetaGuiaCanje_insertar')
             ORDER BY p.parameter_id`
        );
        
        console.log('\n📋 Parámetros del stored procedure:');
        spParams.recordset.forEach(param => {
            console.log(`- ${param.parameter_name}: ${param.data_type} (${param.is_output ? 'OUTPUT' : 'INPUT'})`);
        });
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error);
        console.error('❌ Stack trace:', error.stack);
    } finally {
        try {
            await dbService.closePool();
            console.log('\n🔒 Conexión cerrada');
        } catch (error) {
            console.log('⚠️ Error al cerrar conexión:', error.message);
        }
    }
}

testStoredProcedureDeta();

