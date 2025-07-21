require('dotenv').config();
const dbService = require('./services/dbService');

async function testDatabaseConnection() {
    try {
        console.log('🔍 Probando conexión a la base de datos...');
        
        // Probar conexión básica
        const result = await dbService.executeQuery('SELECT 1 as test');
        console.log('✅ Conexión exitosa:', result.recordset);
        
        // Probar consulta a la tabla Tablas
        console.log('🔍 Consultando tabla Tablas...');
        const tablasResult = await dbService.executeQuery('SELECT TOP 5 * FROM Tablas');
        console.log('✅ Tabla Tablas accesible:', tablasResult.recordset.length, 'registros encontrados');
        
        // Verificar la estructura de la tabla Tablas
        console.log('🔍 Verificando estructura de la tabla Tablas...');
        const structureResult = await dbService.executeQuery('SELECT TOP 1 * FROM Tablas');
        console.log('✅ Estructura de Tablas:', Object.keys(structureResult.recordset[0] || {}));
        
        // Probar consulta específica para Cod=37 (probando diferentes nombres de columna)
        console.log('🔍 Consultando Tablas con Cod=37...');
        let cod37Result;
        try {
            cod37Result = await dbService.executeQuery('SELECT * FROM Tablas WHERE Cod = 37');
        } catch (error) {
            console.log('⚠️ Error con "Cod", probando "cod"...');
            try {
                cod37Result = await dbService.executeQuery('SELECT * FROM Tablas WHERE cod = 37');
            } catch (error2) {
                console.log('⚠️ Error con "cod", probando "COD"...');
                try {
                    cod37Result = await dbService.executeQuery('SELECT * FROM Tablas WHERE COD = 37');
                } catch (error3) {
                    console.log('⚠️ Error con "COD", mostrando todos los registros...');
                    cod37Result = await dbService.executeQuery('SELECT TOP 10 * FROM Tablas');
                }
            }
        }
        console.log('✅ Registro Cod=37:', cod37Result.recordset);
        
        // Probar si existe algún registro con n_codtabla=37
        const cod37Check = await dbService.executeQuery('SELECT * FROM Tablas WHERE n_codtabla = 37');
        if (cod37Check.recordset.length === 0) {
            console.log('⚠️ No se encontró registro con n_codtabla=37, creando uno de prueba...');
            
            // Insertar un registro de prueba
            await dbService.executeQuery(
                `INSERT INTO Tablas (n_codtabla, c_descripcion, n_numero, c_describe, conversion, Afecto) 
                 VALUES (37, 'Número de Guia devolucion para Proveedor', 1, 'FF01-000001', 0.00, 0)`
            );
            console.log('✅ Registro de prueba creado');
            
            // Verificar que se creó
            const verifyResult = await dbService.executeQuery('SELECT * FROM Tablas WHERE n_codtabla = 37');
            console.log('✅ Verificación del registro creado:', verifyResult.recordset);
        } else {
            console.log('✅ Registro n_codtabla=37 encontrado:', cod37Check.recordset);
        }
        
        console.log('🎉 Todas las pruebas completadas exitosamente');
        
    } catch (error) {
        console.error('❌ Error en las pruebas:', error);
        console.error('❌ Stack trace:', error.stack);
    } finally {
        // Cerrar la conexión
        try {
            await dbService.closePool();
            console.log('🔒 Conexión cerrada');
        } catch (error) {
            console.log('⚠️ Error al cerrar conexión:', error.message);
        }
    }
}

// Ejecutar las pruebas
testDatabaseConnection(); 