require('dotenv').config();
const dbService = require('./services/dbService');

async function testDetaGuiaCanje() {
    try {
        console.log('🔍 Analizando tabla DetaGuiaCanje...');
        
        // 1. Obtener estructura de la tabla
        console.log('\n📋 1. Estructura de la tabla DetaGuiaCanje:');
        const estructura = await dbService.executeQuery(
            `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_NAME = 'DetaGuiaCanje' 
             ORDER BY ORDINAL_POSITION`
        );
        
        console.log('Columnas encontradas:');
        estructura.recordset.forEach(col => {
            console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''} - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        
        // 2. Obtener los últimos 10 registros
        console.log('\n📊 2. Últimos 10 registros de DetaGuiaCanje:');
        const ultimosRegistros = await dbService.executeQuery(
            `SELECT TOP 10 * FROM DetaGuiaCanje 
             ORDER BY NroGuia DESC, codpro DESC`
        );
        
        if (ultimosRegistros.recordset.length > 0) {
            console.log(`\nEncontrados ${ultimosRegistros.recordset.length} registros:`);
            ultimosRegistros.recordset.forEach((registro, index) => {
                console.log(`\n--- Registro ${index + 1} ---`);
                Object.keys(registro).forEach(key => {
                    const value = registro[key];
                    console.log(`${key}: ${value !== null ? value : 'NULL'}`);
                });
            });
        } else {
            console.log('No se encontraron registros en la tabla');
        }
        
        // 3. Verificar campos que se están insertando en el sistema
        console.log('\n🔍 3. Verificando campos que inserta el sistema:');
        console.log('Campos que el sistema actual inserta:');
        console.log('- num (NroGuia)');
        console.log('- idpro (codpro)');
        console.log('- lote');
        console.log('- vence (Vencimiento)');
        console.log('- cantidad');
        console.log('- guia (GuiaDevo)');
        console.log('- referencia');
        console.log('- tipodoc');
        
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

testDetaGuiaCanje();
