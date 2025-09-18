const { executeQuery } = require('./database');

async function testFlutterIntegration() {
    try {
        console.log('🧪 Probando integración Flutter con procedimiento unificado...\n');

        // Parámetros de prueba (usando el producto del ejemplo: 19075)
        const ruc = '12345678901'; // RUC de prueba
        const codpro = '19075';   // Producto del ejemplo
        const cantidad = 100;     // Cantidad de prueba

        console.log(`📋 Parámetros de prueba:`);
        console.log(`   RUC: ${ruc}`);
        console.log(`   Producto: ${codpro}`);
        console.log(`   Cantidad: ${cantidad}\n`);

        // Simular la consulta que hace el endpoint /pedido_app/productos/:codpro
        const result = await executeQuery(
            'EXEC Jhon_ProductoCalculos @ruc, @codpro, @cantidad',
            { ruc, codpro, cantidad }
        );

        if (result.recordset && result.recordset.length > 0) {
            const data = result.recordset[0];
            
            console.log('✅ Resultado del procedimiento:');
            console.log(`   Código: ${data.codpro}`);
            console.log(`   Nombre: ${data.nombre}`);
            console.log(`   Precio: ${data.Pventa}`);
            console.log(`   Descuentos: ${data.Desc1}%, ${data.Desc2}%, ${data.Desc3}%\n`);

            // Verificar bonificaciones
            if (data.bonificaciones) {
                try {
                    const bonificaciones = JSON.parse(data.bonificaciones);
                    console.log('🎁 Bonificaciones disponibles:');
                    console.log(`   Total de bonificaciones: ${bonificaciones.length}\n`);
                    
                    bonificaciones.forEach((boni, index) => {
                        console.log(`   ${index + 1}. Factor: ${boni.Factor}`);
                        console.log(`      Producto bonificado: ${boni.CodBoni} - ${boni.NombreBonificacion}`);
                        console.log(`      Cantidad a bonificar: ${boni.Cantidad}`);
                        console.log(`      Stock disponible: ${boni.StockBonificacion}`);
                        console.log(`      ¿Aplicable con cantidad ${cantidad}?: ${boni.Aplicable ? 'SÍ' : 'NO'}`);
                        if (boni.Aplicable) {
                            console.log(`      Paquetes completos: ${boni.PaquetesCompletos}`);
                            console.log(`      Bonos a comprar: ${boni.BonosAComprar}`);
                        }
                        console.log('');
                    });

                    // Simular la lógica del backend
                    console.log('🔧 Simulando lógica del backend:');
                    const bonificacionAplicable = bonificaciones.find(b => b.Aplicable === true);
                    if (bonificacionAplicable) {
                        console.log(`   ✅ Bonificación aplicable encontrada: Factor ${bonificacionAplicable.Factor}`);
                        console.log(`   📦 Producto bonificado: ${bonificacionAplicable.CodBoni} - ${bonificacionAplicable.NombreBonificacion}`);
                        console.log(`   🎁 Cantidad bonificada: ${bonificacionAplicable.Cantidad}`);
                    } else {
                        console.log('   ⚠️ No hay bonificaciones aplicables con la cantidad actual');
                    }

                } catch (error) {
                    console.log('⚠️ Error parseando bonificaciones:', error.message);
                }
            } else {
                console.log('ℹ️ No hay bonificaciones disponibles para este producto');
            }

            console.log('\n✅ Integración Flutter lista!');
            console.log('🎯 Beneficios implementados:');
            console.log('   - Una sola consulta obtiene toda la información');
            console.log('   - El vendedor puede elegir entre múltiples opciones de bonificación');
            console.log('   - Información completa de stock y aplicabilidad');
            console.log('   - Mejor rendimiento y experiencia de usuario');

        } else {
            console.log('❌ No se encontraron datos para el producto especificado');
        }

    } catch (error) {
        console.error('❌ Error en la integración:', error);
    }
}

// Ejecutar la prueba
testFlutterIntegration();
