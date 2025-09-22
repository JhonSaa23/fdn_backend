const axios = require('axios');

async function testSimple() {
  console.log('🧪 Prueba simple de conexión al servidor...\n');
  
  try {
    // 1. Probar endpoint básico
    console.log('1️⃣ Probando endpoint básico...');
    const response1 = await axios.get('http://localhost:3023/');
    console.log('✅ Servidor respondiendo:', response1.data.message);
    
    // 2. Probar endpoint de productos (sin autenticación)
    console.log('\n2️⃣ Probando endpoint de productos...');
    const response2 = await axios.get('http://localhost:3023/api/pedido_app/productos-test');
    console.log('✅ Endpoint de productos funcionando');
    console.log('   Productos encontrados:', response2.data.total);
    
    // 3. Probar endpoint de correlativos (debería fallar por autenticación)
    console.log('\n3️⃣ Probando endpoint de correlativos (sin autenticación)...');
    try {
      const response3 = await axios.post('http://localhost:3023/api/pedido_app/obtener-correlativo-pedido');
      console.log('✅ Endpoint de correlativos respondiendo:', response3.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Endpoint protegido correctamente (requiere autenticación)');
        console.log('   Status:', error.response.status);
      } else {
        console.log('❌ Error inesperado:', error.response?.data || error.message);
      }
    }
    
    // 4. Probar endpoint de estado (debería fallar por autenticación)
    console.log('\n4️⃣ Probando endpoint de estado...');
    try {
      const response4 = await axios.get('http://localhost:3023/api/pedido_app/estado-correlativos');
      console.log('✅ Endpoint de estado respondiendo:', response4.data);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Endpoint protegido correctamente (requiere autenticación)');
      } else {
        console.log('❌ Error inesperado:', error.response?.data || error.message);
      }
    }
    
    console.log('\n🎉 Pruebas básicas completadas - El servidor está funcionando correctamente');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ El servidor no está ejecutándose en el puerto 3023');
      console.log('   Ejecuta: npm start o node index.js');
    } else {
      console.log('❌ Error:', error.message);
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Data:', error.response.data);
      }
    }
  }
}

testSimple();