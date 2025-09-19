const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3000/api/pedido_app';
const RUC_TEST = '20123456789';
const PRODUCTO_TEST = '35034';
const CANTIDAD_TEST = 1;

async function testBonificacionesFix() {
  console.log('🧪 Probando el fix de bonificaciones...\n');

  try {
    // 1. Obtener producto con bonificaciones
    console.log('1️⃣ Obteniendo producto con bonificaciones...');
    const response = await axios.get(
      `${BASE_URL}/productos/${PRODUCTO_TEST}`,
      {
        params: {
          ruc: RUC_TEST,
          cantidad: CANTIDAD_TEST
        }
      }
    );

    console.log('✅ Respuesta del producto:');
    console.log('Success:', response.data.success);
    console.log('Found:', response.data.found);
    console.log('Source:', response.data.source);
    
    if (response.data.data) {
      const producto = response.data.data;
      console.log('\n📦 Datos del producto:');
      console.log('Código:', producto.codpro);
      console.log('Nombre:', producto.nombre_producto);
      console.log('Precio:', producto.Pventa);
      
      if (producto.bonificaciones) {
        console.log('\n🎉 Bonificaciones encontradas:');
        console.log('Cantidad:', producto.bonificaciones.length);
        producto.bonificaciones.forEach((boni, index) => {
          console.log(`  ${index + 1}. ${boni.NombreBonificacion}`);
          console.log(`     Factor: ${boni.Factor}`);
          console.log(`     Cantidad: ${boni.Cantidad}`);
          console.log(`     Aplicable: ${boni.Aplicable}`);
          console.log(`     Stock: ${boni.StockBonificacion}`);
        });
        
        // Verificar si hay bonificaciones aplicables
        const aplicables = producto.bonificaciones.filter(b => b.Aplicable === true);
        const noAplicables = producto.bonificaciones.filter(b => b.Aplicable === false);
        
        console.log(`\n📊 Resumen:`);
        console.log(`   Aplicables: ${aplicables.length}`);
        console.log(`   No aplicables: ${noAplicables.length}`);
        
        if (aplicables.length > 0) {
          console.log('✅ Hay bonificaciones aplicables - Modal debería aparecer');
        } else if (noAplicables.length > 0) {
          console.log('⚠️ Solo hay bonificaciones no aplicables - Modal debería aparecer pero sin botones de selección');
        }
      } else {
        console.log('\n❌ No hay bonificaciones en el campo bonificaciones');
      }
    }

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.response?.data || error.message);
  }
}

// Ejecutar pruebas
testBonificacionesFix();
