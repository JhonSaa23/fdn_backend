const axios = require('axios');

async function testEndpoint() {
    try {
        console.log('🔍 Probando endpoint de productos a devolver...');
        
        // Probar con el laboratorio 89 (Abbott)
        const response = await axios.get('http://localhost:3023/api/guias-devolucion/89/productos-a-devolver');
        
        console.log('✅ Respuesta exitosa:');
        console.log('Status:', response.status);
        console.log('Productos encontrados:', response.data.data.length);
        console.log('Primeros 3 productos:', response.data.data.slice(0, 3));
        
    } catch (error) {
        console.error('❌ Error al probar endpoint:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testEndpoint(); 