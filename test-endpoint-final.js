const axios = require('axios');

async function testEndpoint() {
    try {
        console.log('🔍 Probando endpoint con stored procedure...');
        
        const response = await axios.get('http://localhost:3023/api/guias-devolucion/89/productos-a-devolver');
        
        console.log('✅ Status:', response.status);
        console.log('✅ Success:', response.data.success);
        console.log('✅ Número de productos:', response.data.data.length);
        console.log('✅ Primeros 3 productos:', response.data.data.slice(0, 3));
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.response?.status, error.response?.data);
        if (error.response?.data?.details) {
            console.error('❌ Detalles del error:', error.response.data.details);
        }
    }
}

testEndpoint(); 