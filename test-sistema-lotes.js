const axios = require('axios');

// Script para probar el sistema de lotes
async function testSistemaLotes() {
  const ngrokUrl = 'https://fcac8fe8faf0.ngrok-free.app';
  
  console.log('🚀 Probando sistema de lotes...\n');
  
  try {
    // Generar datos de prueba - 45 productos (3 lotes de 20, 15, 10)
    const productos = [];
    const timestamp = Date.now();
    
    for (let i = 1; i <= 45; i++) {
      productos.push({
        idpro: `009${String(i).padStart(2, '0')}`,
        lote: `LOTE${String(i).padStart(3, '0')}`,
        vence: '2025-12-31T00:00:00.000Z',
        cantidad: Math.floor(Math.random() * 10) + 1,
        guia: 'SIN REF',
        referencia: 'SIN REF',
        tipodoc: 'NN'
      });
    }
    
    console.log(`📋 Generados ${productos.length} productos de prueba`);
    console.log(`📦 Se dividirán en ${Math.ceil(productos.length / 20)} lotes`);
    
    const datosLote = {
      num: `FF01-LOTE-${String(timestamp).slice(-6)}`,
      productos: productos,
      delayEntreProductos: 2000, // 2 segundos
      delayEntreLotes: 5000      // 5 segundos
    };
    
    console.log(`📋 Datos del lote:`, {
      num: datosLote.num,
      totalProductos: datosLote.productos.length,
      delayEntreProductos: datosLote.delayEntreProductos,
      delayEntreLotes: datosLote.delayEntreLotes
    });
    
    console.log('\n🚀 Iniciando procesamiento por lotes...');
    console.log('⏱️ Tiempo estimado:', calcularTiempoEstimado(productos.length, 2000, 5000));
    
    const inicio = Date.now();
    
    const response = await axios.post(`${ngrokUrl}/api/guias-canje/insertar-detalles-lote`, datosLote, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });
    
    const fin = Date.now();
    const tiempoTranscurrido = (fin - inicio) / 1000;
    
    console.log('\n🎉 ¡Procesamiento completado!');
    console.log(`⏱️ Tiempo real: ${tiempoTranscurrido.toFixed(2)} segundos`);
    console.log(`📊 Resultados:`, response.data.resultados);
    
    // Mostrar resumen detallado
    const resultados = response.data.resultados;
    console.log('\n📊 RESUMEN DETALLADO:');
    console.log(`✅ Total productos procesados: ${resultados.productosProcesados}/${resultados.totalProductos}`);
    console.log(`✅ Productos exitosos: ${resultados.productosExitosos}`);
    console.log(`❌ Productos con error: ${resultados.productosConError}`);
    console.log(`📦 Total lotes procesados: ${resultados.totalLotes}`);
    
    console.log('\n📋 DETALLE POR LOTES:');
    resultados.lotes.forEach((lote, index) => {
      console.log(`📦 Lote ${lote.numeroLote}: ${lote.productosExitosos}/${lote.productosEnLote} exitosos`);
      if (lote.errores.length > 0) {
        console.log(`   ❌ Errores: ${lote.errores.length}`);
        lote.errores.forEach(error => {
          console.log(`      - Producto ${error.producto} (${error.idpro}): ${error.error}`);
        });
      }
    });
    
    if (resultados.errores.length > 0) {
      console.log('\n❌ ERRORES GLOBALES:');
      resultados.errores.forEach(error => {
        console.log(`   - Lote ${error.lote}, Producto ${error.producto} (${error.idpro}): ${error.error}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba de lotes:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    if (error.response?.data) {
      console.log('📋 Detalles del error del servidor:');
      console.log('   - Mensaje:', error.response.data.message);
      console.log('   - Error:', error.response.data.error);
    }
  }
}

// Función para calcular tiempo estimado
function calcularTiempoEstimado(totalProductos, delayEntreProductos, delayEntreLotes) {
  const tamanoLote = 20;
  const totalLotes = Math.ceil(totalProductos / tamanoLote);
  
  // Tiempo de procesamiento de productos
  const tiempoProductos = (totalProductos - totalLotes) * (delayEntreProductos / 1000);
  
  // Tiempo de delay entre lotes
  const tiempoEntreLotes = (totalLotes - 1) * (delayEntreLotes / 1000);
  
  const tiempoTotal = tiempoProductos + tiempoEntreLotes;
  
  return `${tiempoTotal.toFixed(1)} segundos (${(tiempoTotal / 60).toFixed(1)} minutos)`;
}

// Función para probar con diferentes tamaños
async function testDiferentesTamanos() {
  console.log('\n🧪 Probando diferentes tamaños de lotes...\n');
  
  const tamanos = [5, 25, 50, 100];
  
  for (const tamano of tamanos) {
    console.log(`\n📋 Probando con ${tamano} productos...`);
    
    const productos = [];
    for (let i = 1; i <= tamano; i++) {
      productos.push({
        idpro: `TEST${String(i).padStart(3, '0')}`,
        lote: `LOTE${String(i).padStart(3, '0')}`,
        vence: '2025-12-31T00:00:00.000Z',
        cantidad: 1,
        guia: 'SIN REF',
        referencia: 'SIN REF',
        tipodoc: 'NN'
      });
    }
    
    const datosLote = {
      num: `FF01-TEST-${tamano}-${Date.now()}`,
      productos: productos,
      delayEntreProductos: 1000, // 1 segundo para pruebas rápidas
      delayEntreLotes: 2000      // 2 segundos para pruebas rápidas
    };
    
    try {
      const response = await axios.post('https://fcac8fe8faf0.ngrok-free.app/api/guias-canje/insertar-detalles-lote', datosLote, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log(`✅ ${tamano} productos: ${response.data.resultados.productosExitosos}/${response.data.resultados.productosProcesados} exitosos`);
      
    } catch (error) {
      console.log(`❌ ${tamano} productos: Error - ${error.response?.data?.message || error.message}`);
    }
  }
}

// Función principal
async function runTests() {
  await testSistemaLotes();
  // await testDiferentesTamanos(); // Descomenta si quieres probar diferentes tamaños
}

// Ejecutar las pruebas
runTests();
