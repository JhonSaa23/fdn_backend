require('dotenv').config();
const dbService = require('./services/dbService');

async function restoreStoredProcedureDeta() {
    try {
        console.log('🔄 Restaurando stored procedure sp_DetaGuiaCanje_insertar a su estado original...');
        
        // Restaurar el stored procedure original
        const originalStoredProcedure = `
CREATE OR ALTER PROCEDURE sp_DetaGuiaCanje_insertar
@num char(20),@idpro char(10),@lote char(15),@vence smalldatetime,@cantidad decimal(9,2),@guia char(20),@referencia char(20),@tipodoc char(2)
as
INSERT INTO DetaGuiaCanje (NroGuia,codpro,lote,vencimiento,cantidad,guiaDevo,Referencia,TipoDoc)
VALUES(@num,@idpro,@lote,@vence,@cantidad,@guia,@referencia,@tipodoc)
        `;
        
        console.log('📝 Ejecutando restauración del stored procedure...');
        await dbService.executeQuery(originalStoredProcedure);
        
        console.log('✅ Stored procedure restaurado a su estado original');
        console.log('📋 Estado original:');
        console.log('- Sin campo Atendido en el INSERT');
        console.log('- Solo los campos que estaban originalmente');
        
    } catch (error) {
        console.error('❌ Error al restaurar stored procedure:', error);
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

restoreStoredProcedureDeta();
