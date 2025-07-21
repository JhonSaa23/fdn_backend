const axios = require('axios');

async function testEndpoint() {
    try {
        console.log('🔍 Probando endpoint de productos a devolver...');
        
        const response = await axios.get('http://localhost:3023/api/guias-devolucion/89/productos-a-devolver');
        
        console.log('✅ Status:', response.status);
        console.log('✅ Data:', response.data);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.status, error.response?.data);
        console.error('❌ Message:', error.message);
    }
}

testEndpoint(); 