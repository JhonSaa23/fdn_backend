const axios = require('axios');

// Script para probar el endpoint con múltiples facturas
async function testMultipleInvoices() {
    try {
        console.log('🧪 Probando endpoint con producto 64033 que tiene 3 facturas...');
        
        // Simular los parámetros que se envían desde el frontend
        const codpro = '64033';
        const lote = '2109254';
        const vencimiento = '2027-10-31T10:15:00.000Z'; // Formato ISO
        
        console.log(`📋 Parámetros de prueba:`);
        console.log(`   - Código: ${codpro}`);
        console.log(`   - Lote: ${lote}`);
        console.log(`   - Vencimiento: ${vencimiento}`);
        
        // Hacer la petición al endpoint
        const response = await axios.get(
            `http://localhost:3000/productos/saldo-detalle/${codpro}/${lote}/${vencimiento}`
        );
        
        console.log('\n✅ Respuesta del endpoint:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Verificar que se obtuvieron múltiples facturas
        if (response.data.success && response.data.data.facturas) {
            const facturas = response.data.data.facturas;
            console.log(`\n📊 Resumen:`);
            console.log(`   - Total de facturas encontradas: ${facturas.length}`);
            
            facturas.forEach((factura, index) => {
                console.log(`\n   Factura ${index + 1}:`);
                console.log(`     - Número: ${factura.numero}`);
                console.log(`     - Cantidad: ${factura.cantidad}`);
                console.log(`     - Precio: S/ ${factura.precio}`);
                console.log(`     - Subtotal: S/ ${factura.subtotal}`);
                console.log(`     - F. Ingreso: ${factura.fechaIngreso}`);
            });
        } else {
            console.log('❌ No se encontraron facturas o hubo un error');
        }
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.response?.data || error.message);
    }
}

// Ejecutar la prueba
testMultipleInvoices();
