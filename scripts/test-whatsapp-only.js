// =====================================================
// SCRIPT PARA PROBAR SOLO EL ENVÍO DE WHATSAPP
// =====================================================

const axios = require('axios');

const BOT_URL = 'http://localhost:3008';

async function testEnvioWhatsApp() {
  console.log('📱 Probando envío directo por WhatsApp...');
  
  try {
    const mensaje = `🔐 *Código de Verificación - Fármacos del Norte*

Hola Jhon Saavedra,

Tu código de verificación es: *1234*

⏰ Este código expira en 1 minuto.

Si no solicitaste este código, ignora este mensaje.

---
*Sistema Interno Fármacos del Norte*`;

    const response = await axios.post(`${BOT_URL}/v1/messages`, {
      number: '51931161425', // Tu número
      message: mensaje
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Respuesta del bot:', response.data);
    console.log('✅ Status:', response.status);
    
    if (response.data === 'sended') {
      console.log('🎉 ¡Mensaje enviado exitosamente!');
    } else {
      console.log('⚠️ Respuesta inesperada:', response.data);
    }

  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.message);
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Data:', error.response.data);
    }
  }
}

async function testVerificarNumero() {
  console.log('\n📞 Probando verificación de número...');
  
  try {
    const response = await axios.post(`${BOT_URL}/v1/authorized`, {
      number: '51931161425',
      intent: 'check'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log('✅ Verificación de número:', response.data);

  } catch (error) {
    console.error('❌ Error verificando número:', error.message);
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Data:', error.response.data);
    }
  }
}

async function main() {
  console.log('🚀 Probando integración directa con bot de WhatsApp...\n');
  
  // 1. Verificar número
  await testVerificarNumero();
  
  // 2. Enviar mensaje
  await testEnvioWhatsApp();
  
  console.log('\n✅ Pruebas completadas!');
  console.log('\n💡 Si el mensaje se envió correctamente, deberías recibirlo en WhatsApp.');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testEnvioWhatsApp,
  testVerificarNumero
};
