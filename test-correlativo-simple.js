const axios = require('axios');

// Configuración del servidor
const BASE_URL = 'http://localhost:3023/api';

// Función para obtener token usando validación por documento
async function obtenerToken() {
  try {
    console.log('🔐 Obteniendo token por validación de documento...');
    
    // Usar un documento de prueba (ajusta según tu sistema)
    const response = await axios.post(`${BASE_URL}/auth/validar-documento`, {
      documento: '12345678', // DNI de prueba
      tipoUsuario: 'Admin'
    });
    
    if (response.data.success && response.data.token) {
      console.log('✅ Token obtenido exitosamente');
      console.log('   Usuario:', response.data.user?.Nombre || 'No disponible');
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
    return null;
  }
}

// Función para probar obtención de correlativo
async function probarCorrelativo(token) {
  try {
    console.log('🔢 Probando obtención de correlativo...');
    
    const response = await axios.post(`${BASE_URL}/pedido_app/obtener-correlativo-pedido`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Correlativo obtenido exitosamente:');
    console.log('   Número:', response.data.data.numeroCorrelativo);
    console.log('   Timestamp:', response.data.data.timestamp);
    
    return response.data.data.numeroCorrelativo;
    
  } catch (error) {
    console.error('❌ Error obteniendo correlativo:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else {
      console.error('  Error:', error.message);
    }
    return null;
  }
}

// Función para verificar estado
async function verificarEstado(token) {
  try {
    console.log('📊 Verificando estado de correlativos...');
    
    const response = await axios.get(`${BASE_URL}/pedido_app/estado-correlativos`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Estado actual:');
    console.log('   Configuración:', response.data.data.configuracion?.c_describe || 'No disponible');
    console.log('   Total pedidos:', response.data.data.estadisticas?.totalPedidos || 0);
    console.log('   Último número:', response.data.data.estadisticas?.numeroMaximo || 'No disponible');
    
  } catch (error) {
    console.error('❌ Error verificando estado:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else {
      console.error('  Error:', error.message);
    }
  }
}

// Función principal
async function main() {
  console.log('🧪 PRUEBA SIMPLE DE CORRELATIVOS\n');
  
  // 1. Obtener token
  const token = await obtenerToken();
  if (!token) {
    console.log('\n❌ No se puede continuar sin token');
    console.log('   Verifica que el documento 12345678 exista en tu sistema');
    return;
  }
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 2. Verificar estado inicial
  console.log('1️⃣ Estado inicial:');
  await verificarEstado(token);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 3. Obtener correlativo
  console.log('2️⃣ Obteniendo correlativo:');
  const numero = await probarCorrelativo(token);
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 4. Verificar estado final
  console.log('3️⃣ Estado final:');
  await verificarEstado(token);
  
  if (numero) {
    console.log('\n🎉 ¡PRUEBA EXITOSA!');
    console.log(`   Número de pedido asignado: ${numero}`);
  } else {
    console.log('\n❌ La prueba falló');
  }
}

// Ejecutar
main().catch(console.error);
