const axios = require('axios');

async function testEndpoint() {
    try {
        console.log('🔍 Probando endpoint /api/guias-canje/next-number...');
        
        const response = await axios.get('http://localhost:3023/api/guias-canje/next-number');
        
        console.log('✅ Respuesta exitosa:');
        console.log('Status:', response.status);
        console.log('Data:', response.data);
        
        if (response.data.success) {
            console.log('🎯 Número siguiente:', response.data.nextNumber);
        } else {
            console.log('❌ Error en la respuesta:', response.data.message);
        }
        
    } catch (error) {
        console.error('❌ Error al probar endpoint:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testEndpoint(); 