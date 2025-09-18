const axios = require('axios');

// Script para probar la conectividad con ngrok y CORS
async function testCorsConnection() {
  const ngrokUrl = 'https://fcac8fe8faf0.ngrok-free.app';
  
  console.log('🧪 Probando conectividad con ngrok...');
  
  try {
    // Test 1: Petición básica sin headers
    console.log('\n📡 Test 1: Petición básica');
    const basicResponse = await axios.get(`${ngrokUrl}/`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    });
    console.log('✅ Petición básica exitosa:', basicResponse.status);
    
    // Test 2: OPTIONS request (preflight)
    console.log('\n📡 Test 2: OPTIONS request (preflight)');
    const optionsResponse = await axios.options(`${ngrokUrl}/api/guias-canje/insertar-detalle`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Origin': 'https://fdn.onrender.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    console.log('✅ OPTIONS request exitosa:', optionsResponse.status);
    console.log('📋 CORS Headers:', {
      'Access-Control-Allow-Origin': optionsResponse.headers['access-control-allow-origin'],
      'Access-Control-Allow-Methods': optionsResponse.headers['access-control-allow-methods'],
      'Access-Control-Allow-Headers': optionsResponse.headers['access-control-allow-headers']
    });
    
    // Test 3: POST request simulando el frontend
    console.log('\n📡 Test 3: POST request simulando frontend');
    const postResponse = await axios.post(`${ngrokUrl}/api/guias-canje/insertar-detalle`, 
      { test: true }, 
      {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Origin': 'https://fdn.onrender.com',
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      }
    );
    console.log('✅ POST request exitosa:', postResponse.status);
    
  } catch (error) {
    console.error('❌ Error en la prueba:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      data: error.response?.data
    });
    
    if (error.code === 'ERR_NETWORK') {
      console.log('\n🔧 Posibles soluciones:');
      console.log('1. Verificar que ngrok esté corriendo');
      console.log('2. Verificar que el backend esté corriendo en el puerto correcto');
      console.log('3. Considerar usar ngrok con autenticación para evitar limitaciones');
    }
  }
}

// Ejecutar la prueba
testCorsConnection();
