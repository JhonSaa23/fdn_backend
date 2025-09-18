const { executeQuery } = require('./database');

async function testProcedureBonificaciones() {
    try {
        console.log('🧪 Probando el procedimiento Jhon_ProductoCalculos con bonificaciones...\n');

        // Parámetros de prueba (usando el producto del ejemplo: 19075)
        const ruc = '12345678901'; // RUC de prueba
        const codpro = '19075';   // Producto del ejemplo
        const cantidad = 100;     // Cantidad de prueba

        console.log(`📋 Parámetros de prueba:`);
        console.log(`   RUC: ${ruc}`);
        console.log(`   Producto: ${codpro}`);
        console.log(`   Cantidad: ${cantidad}\n`);

        // Ejecutar el procedimiento
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
            console.log(`   Afecto: ${data.afecto}`);
            console.log(`   Descuentos: ${data.Desc1}%, ${data.Desc2}%, ${data.Desc3}%`);
            console.log(`   Tipificación: ${data.tipificacion}`);
            console.log(`   Rango de escala usado: ${data.escalaRango}\n`);

            // Mostrar bonificaciones si existen
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
                } catch (error) {
                    console.log('⚠️ Error parseando bonificaciones:', error.message);
                    console.log('Raw bonificaciones:', data.bonificaciones);
                }
            } else {
                console.log('ℹ️ No hay bonificaciones disponibles para este producto');
            }

            // Mostrar rangos de tipificación si existen
            if (data.tipifRangos) {
                try {
                    const tipifRangos = JSON.parse(data.tipifRangos);
                    console.log('📊 Rangos de tipificación:');
                    tipifRangos.forEach((rango, index) => {
                        console.log(`   ${index + 1}. Desde: ${rango.Desde}, Porcentaje: ${rango.Porcentaje}%`);
                    });
                    console.log('');
                } catch (error) {
                    console.log('⚠️ Error parseando rangos de tipificación:', error.message);
                }
            }

            // Mostrar escalas si existen
            if (data.escalasRangos) {
                try {
                    const escalas = JSON.parse(data.escalasRangos);
                    console.log('📈 Escalas disponibles:');
                    console.log(`   Rango 1: ${escalas.Rango1} (descuentos: ${escalas.des11}%, ${escalas.des12}%, ${escalas.des13}%)`);
                    console.log(`   Rango 2: ${escalas.Rango2} (descuentos: ${escalas.des21}%, ${escalas.des22}%, ${escalas.des23}%)`);
                    console.log(`   Rango 3: ${escalas.Rango3} (descuentos: ${escalas.des31}%, ${escalas.des32}%, ${escalas.des33}%)`);
                    console.log(`   Rango 4: ${escalas.Rango4} (descuentos: ${escalas.des41}%, ${escalas.des42}%, ${escalas.des43}%)`);
                    console.log(`   Rango 5: ${escalas.Rango5} (descuentos: ${escalas.des51}%, ${escalas.des52}%, ${escalas.des53}%)`);
                } catch (error) {
                    console.log('⚠️ Error parseando escalas:', error.message);
                }
            }

        } else {
            console.log('❌ No se encontraron datos para el producto especificado');
        }

    } catch (error) {
        console.error('❌ Error ejecutando el procedimiento:', error);
    }
}

// Ejecutar la prueba
testProcedureBonificaciones();
