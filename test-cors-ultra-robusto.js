const axios = require('axios');

// Script para probar la configuración CORS ultra-robusta
async function testCorsUltraRobusto() {
  const ngrokUrl = 'https://fcac8fe8faf0.ngrok-free.app';
  
  console.log('🚀 Probando configuración CORS ULTRA-ROBUSTA...\n');
  
  const testCases = [
    {
      name: 'Preflight OPTIONS Request',
      method: 'OPTIONS',
      url: '/api/guias-canje/insertar-detalle',
      headers: {
        'Origin': 'https://fdn.onrender.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    },
    {
      name: 'POST Request con datos reales',
      method: 'POST',
      url: '/api/guias-canje/insertar-detalle',
      data: {
        num: 'FF01-TEST-CORS',
        idpro: '00858',
        lote: '2112403',
        vence: '2025-11-30T11:16:00.000Z',
        cantidad: '11',
        guia: 'SIN REF',
        referencia: 'SIN REF',
        tipodoc: 'NN'
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'Origin': 'https://fdn.onrender.com'
      }
    },
    {
      name: 'GET Request básico',
      method: 'GET',
      url: '/api/guias-canje/next-number',
      headers: {
        'Authorization': 'Bearer test-token',
        'Origin': 'https://fdn.onrender.com'
      }
    },
    {
      name: 'Request desde localhost',
      method: 'GET',
      url: '/api/guias-canje/next-number',
      headers: {
        'Authorization': 'Bearer test-token',
        'Origin': 'http://localhost:3000'
      }
    },
    {
      name: 'Request sin Origin header',
      method: 'GET',
      url: '/api/guias-canje/next-number',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`\n🧪 Probando: ${testCase.name}`);
      console.log(`📋 Método: ${testCase.method} ${testCase.url}`);
      console.log(`📋 Headers:`, testCase.headers);
      
      const response = await axios({
        method: testCase.method,
        url: `${ngrokUrl}${testCase.url}`,
        data: testCase.data,
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...testCase.headers
        }
      });
      
      console.log(`✅ ÉXITO: Status ${response.status}`);
      console.log(`📋 CORS Headers recibidos:`);
      console.log(`   - Access-Control-Allow-Origin: ${response.headers['access-control-allow-origin']}`);
      console.log(`   - Access-Control-Allow-Methods: ${response.headers['access-control-allow-methods']}`);
      console.log(`   - Access-Control-Allow-Headers: ${response.headers['access-control-allow-headers']}`);
      console.log(`   - Access-Control-Allow-Credentials: ${response.headers['access-control-allow-credentials']}`);
      
      if (response.data) {
        console.log(`📋 Respuesta:`, response.data);
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.response?.status || 'Network Error'}`);
      console.log(`📋 Mensaje: ${error.response?.data?.message || error.message}`);
      
      if (error.response?.headers) {
        console.log(`📋 CORS Headers en error:`);
        console.log(`   - Access-Control-Allow-Origin: ${error.response.headers['access-control-allow-origin']}`);
        console.log(`   - Access-Control-Allow-Methods: ${error.response.headers['access-control-allow-methods']}`);
        console.log(`   - Access-Control-Allow-Headers: ${error.response.headers['access-control-allow-headers']}`);
      }
    }
  }
  
  console.log('\n🎯 Prueba específica de insertar-detalle...');
  
  try {
    const timestamp = Date.now();
    const guiaNumber = `FF01-CORS-${String(timestamp).slice(-6)}`;
    
    const detalleData = {
      num: guiaNumber,
      idpro: '00858',
      lote: '2112403',
      vence: '2025-11-30T11:16:00.000Z',
      cantidad: '11',
      guia: 'SIN REF',
      referencia: 'SIN REF',
      tipodoc: 'NN'
    };
    
    console.log(`📋 Datos:`, detalleData);
    
    const response = await axios.post(`${ngrokUrl}/api/guias-canje/insertar-detalle`, detalleData, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'Origin': 'https://fdn.onrender.com'
      }
    });
    
    console.log(`✅ INSERTAR-DETALLE ÉXITO: Status ${response.status}`);
    console.log(`📋 Respuesta:`, response.data);
    
  } catch (error) {
    console.log(`❌ INSERTAR-DETALLE ERROR: ${error.response?.status || 'Network Error'}`);
    console.log(`📋 Mensaje: ${error.response?.data?.message || error.message}`);
    
    if (error.response?.headers) {
      console.log(`📋 Headers CORS en error:`);
      Object.keys(error.response.headers).forEach(key => {
        if (key.toLowerCase().includes('access-control')) {
          console.log(`   - ${key}: ${error.response.headers[key]}`);
        }
      });
    }
  }
  
  console.log('\n🎉 Pruebas CORS ULTRA-ROBUSTAS completadas!');
}

// Ejecutar las pruebas
testCorsUltraRobusto();
