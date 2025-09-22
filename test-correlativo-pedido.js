const axios = require('axios');

// Configuración del servidor
const BASE_URL = 'http://localhost:3023/api/pedido_app';

// Función para verificar si el servidor está funcionando
async function verificarServidor() {
  try {
    console.log('🔍 Verificando si el servidor está funcionando...');
    
    // Intentar hacer una petición simple al endpoint de productos
    const response = await axios.get(`${BASE_URL}/productos-test`);
    
    console.log('✅ Servidor funcionando correctamente');
    console.log('  Status:', response.status);
    return true;
    
  } catch (error) {
    console.error('❌ Servidor no está funcionando:');
    if (error.code === 'ECONNREFUSED') {
      console.error('  El servidor no está ejecutándose en el puerto 3023');
      console.error('  Asegúrate de ejecutar: npm start o node index.js');
    } else if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  El servidor responde pero hay un error en el endpoint');
    } else {
      console.error('  Error:', error.message);
    }
    return false;
  }
}

// Función para probar obtención de correlativo
async function probarCorrelativo() {
  try {
    console.log('🔢 Probando obtención de correlativo...');
    
    const response = await axios.post(`${BASE_URL}/obtener-correlativo-pedido`);
    
    console.log('✅ Respuesta del servidor:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data.data.numeroCorrelativo;
    
  } catch (error) {
    console.error('❌ Error detallado:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
      console.error('  Headers:', error.response.headers);
    } else if (error.request) {
      console.error('  No se recibió respuesta del servidor');
      console.error('  Request:', error.request);
    } else {
      console.error('  Error:', error.message);
    }
    return null;
  }
}

// Función para verificar estado de correlativos
async function verificarEstado() {
  try {
    console.log('📊 Verificando estado de correlativos...');
    
    const response = await axios.get(`${BASE_URL}/estado-correlativos`);
    
    console.log('✅ Estado actual:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error detallado:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else if (error.request) {
      console.error('  No se recibió respuesta del servidor');
    } else {
      console.error('  Error:', error.message);
    }
  }
}

// Función para probar múltiples solicitudes simultáneas
async function probarConcurrencia() {
  console.log('🚀 Probando concurrencia (5 solicitudes simultáneas)...');
  
  const promesas = [];
  for (let i = 0; i < 5; i++) {
    promesas.push(
      probarCorrelativo().then(numero => {
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
    if (numerosUnicos.length === resultados.length) {
      console.log('✅ Todos los números son únicos - Sistema funciona correctamente');
    } else {
      console.log('❌ Se encontraron números duplicados - Hay un problema');
    }
    
  } catch (error) {
    console.error('❌ Error en prueba de concurrencia:', error);
  }
}

// Función principal
async function main() {
  console.log('🧪 INICIANDO PRUEBAS DE CORRELATIVOS\n');
  
  // 0. Verificar si el servidor está funcionando
  console.log('0️⃣ Verificando servidor:');
  const servidorOk = await verificarServidor();
  if (!servidorOk) {
    console.log('\n❌ No se pueden continuar las pruebas. El servidor no está funcionando.');
    return;
  }
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 1. Verificar estado inicial
  console.log('1️⃣ Estado inicial:');
  await verificarEstado();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 2. Obtener un correlativo
  console.log('2️⃣ Obteniendo un correlativo:');
  const numero1 = await probarCorrelativo();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 3. Verificar estado después del primer correlativo
  console.log('3️⃣ Estado después del primer correlativo:');
  await verificarEstado();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 4. Probar concurrencia
  console.log('4️⃣ Prueba de concurrencia:');
  await probarConcurrencia();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 5. Estado final
  console.log('5️⃣ Estado final:');
  await verificarEstado();
  
  console.log('\n🎉 Pruebas completadas');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  probarCorrelativo,
  verificarEstado,
  probarConcurrencia
};
