const axios = require('axios');

// Script para obtener un token real del sistema
async function obtenerTokenReal() {
  const ngrokUrl = 'https://fcac8fe8faf0.ngrok-free.app';
  
  console.log('🔑 Obteniendo token real del sistema...\n');
  
  try {
    // Intentar diferentes credenciales de prueba
    const credenciales = [
      { documento: '12345678', tipoUsuario: 'administrador' },
      { documento: '87654321', tipoUsuario: 'administrador' },
      { documento: '11111111', tipoUsuario: 'administrador' },
      { documento: '00000000', tipoUsuario: 'administrador' }
    ];
    
    for (const cred of credenciales) {
      try {
        console.log(`📋 Probando con documento: ${cred.documento}`);
        
        const authResponse = await axios.post(`${ngrokUrl}/api/auth/validar-documento`, {
          documento: cred.documento,
          tipoUsuario: cred.tipoUsuario
        }, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Content-Type': 'application/json'
          }
        });
        
        if (authResponse.data.success) {
          console.log('✅ Documento válido encontrado!');
          console.log('📋 Datos del usuario:', authResponse.data.usuario);
          
          // Ahora enviar código de verificación
          if (authResponse.data.requiereCodigo) {
            console.log('\n📱 Enviando código de verificación...');
            
            const codigoResponse = await axios.post(`${ngrokUrl}/api/auth/enviar-codigo`, {
              idus: authResponse.data.usuario.idus,
              numeroCelular: authResponse.data.usuario.numeroCelular || '999999999'
            }, {
              headers: {
                'ngrok-skip-browser-warning': 'true',
                'Content-Type': 'application/json'
              }
            });
            
            if (codigoResponse.data.success) {
              console.log('✅ Código enviado exitosamente');
              console.log('📋 Código generado:', codigoResponse.data.codigo);
              
              // Verificar código
              console.log('\n🔐 Verificando código...');
              const verifyResponse = await axios.post(`${ngrokUrl}/api/auth/verificar-codigo`, {
                idus: authResponse.data.usuario.idus,
                codigo: codigoResponse.data.codigo,
                mantenerSesion: true,
                ipAcceso: '127.0.0.1',
                dispositivo: 'Script de prueba'
              }, {
                headers: {
                  'ngrok-skip-browser-warning': 'true',
                  'Content-Type': 'application/json'
                }
              });
              
              if (verifyResponse.data.success && verifyResponse.data.token) {
                console.log('\n🎉 ¡TOKEN OBTENIDO EXITOSAMENTE!');
                console.log('🔑 Token:', verifyResponse.data.token);
                console.log('\n📋 Copia este token y úsalo en el script de pruebas');
                console.log('💡 También puedes copiarlo directamente desde tus logs del navegador');
                return verifyResponse.data.token;
              }
            }
          } else {
            console.log('⚠️ Este usuario no requiere código de verificación');
          }
        }
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('❌ Documento no encontrado');
        } else {
          console.log('❌ Error:', error.response?.data?.message || error.message);
        }
      }
    }
    
    console.log('\n⚠️ No se pudo obtener token automáticamente');
    console.log('📋 Instrucciones manuales:');
    console.log('1. Ve a tu aplicación web');
    console.log('2. Inicia sesión normalmente');
    console.log('3. Abre las herramientas de desarrollador (F12)');
    console.log('4. Ve a la pestaña Console');
    console.log('5. Busca el log que dice: "🔍 [AXIOS] Authorization header set: Bearer..."');
    console.log('6. Copia el token que aparece después de "Bearer "');
    console.log('7. Reemplaza el token en el archivo test-insertar-cabecera.js');
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

// Ejecutar
obtenerTokenReal();
