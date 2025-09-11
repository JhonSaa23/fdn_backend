// =====================================================
// SCRIPT PARA PROBAR VERIFICACIÓN DE CÓDIGO
// =====================================================

const axios = require('axios');

const API_BASE = 'http://localhost:3023/api/auth';

async function testVerificarCodigo(idus, codigo) {
  console.log(`🔐 Probando verificación de código ${codigo} para usuario ${idus}...`);
  
  try {
    const response = await axios.post(`${API_BASE}/verificar-codigo`, {
      idus: idus,
      codigo: codigo,
      mantenerSesion: false,
      ipAcceso: '127.0.0.1',
      dispositivo: 'Test Script'
    });
    
    console.log('✅ Código verificado exitosamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error verificando código:', error.response?.data || error.message);
    return null;
  }
}

async function testEnviarCodigo(idus, numeroCelular) {
  console.log(`📱 Probando envío de código para usuario ${idus}...`);
  
  try {
    const response = await axios.post(`${API_BASE}/enviar-codigo`, {
      idus: idus,
      numeroCelular: numeroCelular
    });
    
    console.log('✅ Código enviado:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error enviando código:', error.response?.data || error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Probando verificación de código...\n');
  
  // Simular datos de usuario
  const idus = 1;
  const numeroCelular = '51931161425';
  
  // 1. Enviar código
  const codigoData = await testEnviarCodigo(idus, numeroCelular);
  if (!codigoData) {
    console.log('❌ No se pudo enviar código.');
    return;
  }
  
  // 2. Verificar código
  const codigo = codigoData.codigo || '1234'; // Usar código enviado o uno de prueba
  await testVerificarCodigo(idus, codigo);
  
  console.log('\n✅ Pruebas completadas!');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testVerificarCodigo,
  testEnviarCodigo
};
