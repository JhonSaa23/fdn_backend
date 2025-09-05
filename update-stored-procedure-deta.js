require('dotenv').config();
const dbService = require('./services/dbService');

async function updateStoredProcedureDeta() {
    try {
        console.log('🔧 Actualizando stored procedure sp_DetaGuiaCanje_insertar...');
        
        // Crear el nuevo stored procedure con el campo Atendido
        const newStoredProcedure = `
CREATE OR ALTER PROCEDURE sp_DetaGuiaCanje_insertar
@num char(20),
@idpro char(10),
@lote char(15),
@vence smalldatetime,
@cantidad decimal(9,2),
@guia char(20),
@referencia char(20),
@tipodoc char(2)
as
INSERT INTO DetaGuiaCanje (NroGuia,codpro,lote,vencimiento,cantidad,guiaDevo,Atendido,Referencia,TipoDoc)
VALUES(@num,@idpro,@lote,@vence,@cantidad,@guia,0,@referencia,@tipodoc)
        `;
        
        console.log('📝 Ejecutando actualización del stored procedure...');
        await dbService.executeQuery(newStoredProcedure);
        
        console.log('✅ Stored procedure actualizado correctamente');
        console.log('📋 Cambios realizados:');
        console.log('- Agregado campo Atendido con valor por defecto 0');
        console.log('- Mantenidos todos los campos existentes');
        
    } catch (error) {
        console.error('❌ Error al actualizar stored procedure:', error);
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

updateStoredProcedureDeta();
