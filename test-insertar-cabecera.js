const axios = require('axios');

// Función para obtener un token válido
async function obtenerTokenValido() {
  const ngrokUrl = 'https://fcac8fe8faf0.ngrok-free.app';
  
  console.log('🔑 Obteniendo token válido...');
  
  try {
    // Intentar autenticación con credenciales de prueba
    const authResponse = await axios.post(`${ngrokUrl}/api/auth/validar-documento`, {
      documento: '12345678',
      tipoUsuario: 'administrador'
    }, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json'
      }
    });
    
    if (authResponse.data.success && authResponse.data.token) {
      console.log('✅ Token obtenido exitosamente');
      return authResponse.data.token;
    } else {
      console.log('⚠️ No se pudo obtener token, usando token hardcodeado');
      // Token hardcodeado que funciona (copia el que aparece en tus logs del navegador)
      return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwiaWR1cyI6IjEiLCJ0aXBvVXN1YXJpbyI6ImFkbWluaXN0cmFkb3IiLCJpYXQiOjE3MzcwNzQ0MDAsImV4cCI6MTczNzA3ODAwMH0.REEMPLAZA_CON_TU_TOKEN_REAL';
    }
  } catch (error) {
    console.log('⚠️ Error obteniendo token, usando token hardcodeado');
    // Token hardcodeado que funciona (copia el que aparece en tus logs del navegador)
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxIiwiaWR1cyI6IjEiLCJ0aXBvVXN1YXJpbyI6ImFkbWluaXN0cmFkb3IiLCJpYXQiOjE3MzcwNzQ0MDAsImV4cCI6MTczNzA3ODAwMH0.REEMPLAZA_CON_TU_TOKEN_REAL';
  }
}

// Script para probar el endpoint insertar-cabecera
async function testInsertarCabecera(token) {
  const ngrokUrl = 'https://fcac8fe8faf0.ngrok-free.app';
  
  console.log('🧪 Probando endpoint insertar-cabecera...');
  
  try {
    // Generar un número de guía único para evitar duplicados
    const timestamp = Date.now();
    const guiaNumber = `FF01-${String(timestamp).slice(-6)}`;
    
    // Datos de prueba para insertar cabecera
    const testData = {
      docu: guiaNumber, // Número de guía único
      feca: new Date().toISOString().split('T')[0], // Fecha actual
      Prov: '001', // Proveedor
      empresa: 'EMPRESA TEST',
      ruc: '12345678901',
      placa: 'ABC-123',
      punto: 'PUNTO LLEGADA TEST',
      destino: 'DESTINO TEST'
    };
    
    console.log('📋 Datos de prueba:', testData);
    
    // Hacer la petición POST
    const response = await axios.post(`${ngrokUrl}/api/guias-canje/insertar-cabecera`, testData, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Respuesta exitosa:', response.data);
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error('❌ Error en la prueba:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    if (error.response?.data) {
      console.log('📋 Detalles del error del servidor:');
      console.log('   - Mensaje:', error.response.data.message);
      console.log('   - Error:', error.response.data.error);
      if (error.response.data.details) {
        console.log('   - Stack trace:', error.response.data.details);
      }
      if (error.response.data.received) {
        console.log('   - Datos recibidos:', error.response.data.received);
      }
    }
    return { success: false, error: error.response?.data };
  }
}

// Función para probar validaciones
async function testValidaciones(token) {
  const ngrokUrl = 'https://fcac8fe8faf0.ngrok-free.app';
  
  console.log('\n🧪 Probando validaciones del endpoint...');
  
  const testCases = [
    {
      name: 'Sin docu',
      data: { feca: '2025-01-15', Prov: '001' }
    },
    {
      name: 'Sin feca',
      data: { docu: 'FF01-TEST', Prov: '001' }
    },
    {
      name: 'Sin Prov',
      data: { docu: 'FF01-TEST', feca: '2025-01-15' }
    },
    {
      name: 'Fecha inválida',
      data: { docu: 'FF01-TEST', feca: 'fecha-invalida', Prov: '001' }
    }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`\n📋 Probando: ${testCase.name}`);
      const response = await axios.post(`${ngrokUrl}/api/guias-canje/insertar-cabecera`, testCase.data, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('⚠️ Debería haber fallado pero no falló:', response.data);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`✅ Validación funcionó correctamente: ${error.response?.data?.message}`);
      } else {
        console.log(`❌ Error inesperado: ${error.response?.data?.message}`);
      }
    }
  }
}

// Función para probar otros endpoints relacionados
async function testEndpointsRelacionados(token) {
  const ngrokUrl = 'https://fcac8fe8faf0.ngrok-free.app';
  
  console.log('\n🧪 Probando endpoints relacionados...');
  
  const endpoints = [
    { name: 'Listar guías de canje', url: '/api/guias-canje', method: 'GET' },
    { name: 'Obtener siguiente número', url: '/api/guias-canje/next-number', method: 'GET' },
    { name: 'Buscar guía específica', url: '/api/guias-canje/buscar/FF01-000839', method: 'GET' },
    { name: 'Verificar estructura tabla', url: '/api/guias-canje/estructura-tabla', method: 'GET' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📋 Probando: ${endpoint.name}`);
      const response = await axios({
        method: endpoint.method,
        url: `${ngrokUrl}${endpoint.url}`,
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log(`✅ ${endpoint.name}: OK (${response.status})`);
      if (response.data.success) {
        console.log(`   - Datos: ${Array.isArray(response.data.data) ? response.data.data.length + ' registros' : '1 registro'}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ${error.response?.status} - ${error.response?.data?.message}`);
    }
  }
}

// Función para probar el flujo completo
async function testFlujoCompleto(token) {
  const ngrokUrl = 'https://fcac8fe8faf0.ngrok-free.app';
  
  console.log('\n🧪 Probando flujo completo (cabecera + detalle)...');
  
  try {
    // 1. Insertar cabecera
    console.log('\n📋 Paso 1: Insertando cabecera...');
    const timestamp = Date.now();
    const guiaNumber = `FF01-${String(timestamp).slice(-6)}`;
    
    const cabeceraData = {
      docu: guiaNumber,
      feca: new Date().toISOString().split('T')[0],
      Prov: '001',
      empresa: 'EMPRESA TEST COMPLETA',
      ruc: '12345678901',
      placa: 'ABC-123',
      punto: 'PUNTO LLEGADA TEST',
      destino: 'DESTINO TEST'
    };
    
    const cabeceraResponse = await axios.post(`${ngrokUrl}/api/guias-canje/insertar-cabecera`, cabeceraData, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Cabecera insertada:', cabeceraResponse.data);
    
    // 2. Insertar detalle
    console.log('\n📋 Paso 2: Insertando detalle...');
    const detalleData = {
      num: guiaNumber,
      idpro: 'PROD001',
      lote: 'LOTE001',
      vence: '2025-12-31',
      cantidad: 10,
      guia: guiaNumber,
      referencia: 'REF001',
      tipodoc: 'GUIA'
    };
    
    const detalleResponse = await axios.post(`${ngrokUrl}/api/guias-canje/insertar-detalle`, detalleData, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Detalle insertado:', detalleResponse.data);
    
    // 3. Verificar que se creó correctamente
    console.log('\n📋 Paso 3: Verificando creación...');
    const verifyResponse = await axios.get(`${ngrokUrl}/api/guias-canje/buscar/${guiaNumber}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Verificación exitosa:', verifyResponse.data);
    
    console.log('\n🎉 ¡Flujo completo exitoso!');
    
  } catch (error) {
    console.error('❌ Error en flujo completo:', error.response?.data || error.message);
  }
}

// Función principal que ejecuta todas las pruebas
async function runTests() {
  console.log('🚀 Iniciando pruebas completas del sistema...\n');
  
  try {
    // 1. Obtener token válido
    const token = await obtenerTokenValido();
    
    if (!token || token.includes('REEMPLAZA_CON_TU_TOKEN_REAL')) {
      console.log('\n⚠️ IMPORTANTE: Necesitas reemplazar el token hardcodeado');
      console.log('📋 Copia el token real de tus logs del navegador y reemplaza la línea 27 y 32');
      console.log('🔗 Token que aparece en el navegador: Bearer eyJhbGciOiJIUzI1NiIs...');
      return;
    }
    
    // 2. Probar inserción de cabecera
    await testInsertarCabecera(token);
    
    // 3. Probar validaciones
    await testValidaciones(token);
    
    // 4. Probar endpoints relacionados
    await testEndpointsRelacionados(token);
    
    // 5. Probar flujo completo
    await testFlujoCompleto(token);
    
    console.log('\n🎉 ¡Todas las pruebas completadas!');
    
  } catch (error) {
    console.error('❌ Error general en las pruebas:', error.message);
  }
}

// Ejecutar todas las pruebas
runTests();
