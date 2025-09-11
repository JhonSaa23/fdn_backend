// =====================================================
// SCRIPT PARA PROBAR INTEGRACIÓN CON BOT DE WHATSAPP
// =====================================================

const axios = require('axios');

const API_BASE = 'http://localhost:3023/api/auth';

async function testBotStatus() {
  console.log('🔍 Verificando estado del bot de WhatsApp...');
  
  try {
    const response = await axios.get(`${API_BASE}/bot-status`);
    console.log('✅ Estado del bot:', response.data);
    return response.data.success;
  } catch (error) {
    console.error('❌ Error verificando bot:', error.message);
    return false;
  }
}

async function testValidarDocumento() {
  console.log('\n📋 Probando validación de documento...');
  
  try {
    const response = await axios.post(`${API_BASE}/validar-documento`, {
      documento: '12345678',
      tipoUsuario: 'Admin'
    });
    
    console.log('✅ Validación exitosa:', response.data);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error en validación:', error.response?.data || error.message);
    return null;
  }
}

async function testEnviarCodigo(usuarioData) {
  console.log('\n📱 Probando envío de código...');
  
  try {
    const response = await axios.post(`${API_BASE}/enviar-codigo`, {
      idus: usuarioData.idus,
      numeroCelular: usuarioData.numeroCelular
    });
    
    console.log('✅ Código enviado:', response.data);
    return response.data.data;
  } catch (error) {
    console.error('❌ Error enviando código:', error.response?.data || error.message);
    return null;
  }
}

async function testVerificarCodigo(usuarioData, codigo) {
  console.log('\n🔐 Probando verificación de código...');
  
  try {
    const response = await axios.post(`${API_BASE}/verificar-codigo`, {
      idus: usuarioData.idus,
      codigo: codigo,
      mantenerSesion: false,
      ipAcceso: '127.0.0.1',
      dispositivo: 'Test Script'
    });
    
    console.log('✅ Código verificado:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error verificando código:', error.response?.data || error.message);
    return null;
  }
}

async function testVerificarNumero(numero) {
  console.log('\n📞 Probando verificación de número...');
  
  try {
    const response = await axios.post(`${API_BASE}/verificar-numero`, {
      numeroCelular: numero
    });
    
    console.log('✅ Verificación de número:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error verificando número:', error.response?.data || error.message);
    return null;
  }
}

async function testAgregarNumero(numero, nombre) {
  console.log('\n➕ Probando agregar número...');
  
  try {
    const response = await axios.post(`${API_BASE}/agregar-numero`, {
      numeroCelular: numero,
      nombreUsuario: nombre
    });
    
    console.log('✅ Número agregado:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error agregando número:', error.response?.data || error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Iniciando pruebas de integración con WhatsApp...\n');
  
  // 1. Verificar estado del bot
  const botOnline = await testBotStatus();
  
  // 2. Validar documento
  const usuarioData = await testValidarDocumento();
  if (!usuarioData) {
    console.log('❌ No se pudo validar documento. Asegúrate de ejecutar el SQL primero.');
    return;
  }
  
  // 3. Verificar número
  await testVerificarNumero(usuarioData.numeroCelular);
  
  // 4. Agregar número si no está autorizado
  await testAgregarNumero(usuarioData.numeroCelular, usuarioData.nombres);
  
  // 5. Enviar código
  const codigoData = await testEnviarCodigo(usuarioData);
  if (!codigoData) {
    console.log('❌ No se pudo enviar código.');
    return;
  }
  
  // 6. Verificar código
  await testVerificarCodigo(usuarioData, codigoData.codigo);
  
  console.log('\n✅ Pruebas completadas!');
  console.log('\n📋 Resumen:');
  console.log(`- Bot online: ${botOnline ? '✅' : '❌'}`);
  console.log(`- Usuario validado: ${usuarioData ? '✅' : '❌'}`);
  console.log(`- Código enviado: ${codigoData ? '✅' : '❌'}`);
  
  if (codigoData && codigoData.whatsapp) {
    console.log(`- WhatsApp: ${codigoData.whatsapp.success ? '✅' : '❌'}`);
    if (codigoData.whatsapp.simulacion) {
      console.log('  (Simulación - bot no disponible)');
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testBotStatus,
  testValidarDocumento,
  testEnviarCodigo,
  testVerificarCodigo,
  testVerificarNumero,
  testAgregarNumero
};
