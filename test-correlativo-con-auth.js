const axios = require('axios');

// Configuración del servidor
const BASE_URL = 'http://localhost:3023/api';

// Función para obtener token de autenticación
async function obtenerToken() {
  try {
    console.log('🔐 Obteniendo token de autenticación...');
    
    // Usar credenciales de prueba (ajusta según tu sistema)
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'admin', // Ajusta según tu sistema
      password: 'admin'  // Ajusta según tu sistema
    });
    
    if (response.data.success && response.data.token) {
      console.log('✅ Token obtenido exitosamente');
      return response.data.token;
    } else {
      throw new Error('No se pudo obtener token');
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo token:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else {
      console.error('  Error:', error.message);
    }
    
    // Intentar con credenciales alternativas
    console.log('🔄 Intentando con credenciales alternativas...');
    try {
      const response2 = await axios.post(`${BASE_URL}/auth/login`, {
        username: 'vendedor1',
        password: '123456'
      });
      
      if (response2.data.success && response2.data.token) {
        console.log('✅ Token obtenido con credenciales alternativas');
        return response2.data.token;
      }
    } catch (error2) {
      console.error('❌ También falló con credenciales alternativas');
    }
    
    return null;
  }
}

// Función para probar obtención de correlativo con autenticación
async function probarCorrelativo(token) {
  try {
    console.log('🔢 Probando obtención de correlativo...');
    
    const response = await axios.post(`${BASE_URL}/pedido_app/obtener-correlativo-pedido`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Respuesta del servidor:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data.data.numeroCorrelativo;
    
  } catch (error) {
    console.error('❌ Error detallado:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else {
      console.error('  Error:', error.message);
    }
    return null;
  }
}

// Función para verificar estado de correlativos con autenticación
async function verificarEstado(token) {
  try {
    console.log('📊 Verificando estado de correlativos...');
    
    const response = await axios.get(`${BASE_URL}/pedido_app/estado-correlativos`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Estado actual:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error detallado:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else {
      console.error('  Error:', error.message);
    }
  }
}

// Función para probar múltiples solicitudes simultáneas
async function probarConcurrencia(token) {
  console.log('🚀 Probando concurrencia (5 solicitudes simultáneas)...');
  
  const promesas = [];
  for (let i = 0; i < 5; i++) {
    promesas.push(
      probarCorrelativo(token).then(numero => {
        console.log(`📝 Solicitud ${i + 1}: ${numero}`);
        return numero;
      })
    );
  }
  
  try {
    const resultados = await Promise.all(promesas);
    
    console.log('\n📋 Resultados:');
    resultados.forEach((numero, index) => {
      console.log(`  ${index + 1}. ${numero}`);
    });
    
    // Verificar que todos los números son únicos
    const numerosUnicos = [...new Set(resultados)];
    if (numerosUnicos.length === resultados.length && numerosUnicos[0] !== null) {
      console.log('✅ Todos los números son únicos - Sistema funciona correctamente');
    } else {
      console.log('❌ Se encontraron números duplicados o nulos - Hay un problema');
    }
    
  } catch (error) {
    console.error('❌ Error en prueba de concurrencia:', error);
  }
}

// Función principal
async function main() {
  console.log('🧪 INICIANDO PRUEBAS DE CORRELATIVOS CON AUTENTICACIÓN\n');
  
  // 1. Obtener token
  const token = await obtenerToken();
  if (!token) {
    console.log('\n❌ No se puede continuar sin token de autenticación');
    console.log('   Verifica las credenciales en el script');
    return;
  }
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 2. Verificar estado inicial
  console.log('1️⃣ Estado inicial:');
  await verificarEstado(token);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 3. Obtener un correlativo
  console.log('2️⃣ Obteniendo un correlativo:');
  const numero1 = await probarCorrelativo(token);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 4. Verificar estado después del primer correlativo
  console.log('3️⃣ Estado después del primer correlativo:');
  await verificarEstado(token);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 5. Probar concurrencia
  console.log('4️⃣ Prueba de concurrencia:');
  await probarConcurrencia(token);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 6. Estado final
  console.log('5️⃣ Estado final:');
  await verificarEstado(token);
  
  console.log('\n🎉 Pruebas completadas');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  obtenerToken,
  probarCorrelativo,
  verificarEstado,
  probarConcurrencia
};
