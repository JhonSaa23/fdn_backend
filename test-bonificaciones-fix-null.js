const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3000/api/pedido_app';
const RUC_TEST = '20123456789';
const PRODUCTO_TEST = '35034';
const CANTIDAD_TEST = 1;

async function testBonificacionesFixNull() {
  console.log('🧪 Probando el fix del error null...\n');

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
    
    if (response.data.data) {
      const producto = response.data.data;
      console.log('\n📦 Datos del producto:');
      console.log('Código:', producto.codpro);
      console.log('Nombre:', producto.nombre_producto);
      
      if (producto.bonificaciones) {
        console.log('\n🎉 Bonificaciones encontradas:');
        console.log('Cantidad:', producto.bonificaciones.length);
        
        producto.bonificaciones.forEach((boni, index) => {
          console.log(`\n  ${index + 1}. ${boni.NombreBonificacion}`);
          console.log(`     Factor: ${boni.Factor} (tipo: ${typeof boni.Factor})`);
          console.log(`     Cantidad: ${boni.Cantidad} (tipo: ${typeof boni.Cantidad})`);
          console.log(`     Aplicable: ${boni.Aplicable} (tipo: ${typeof boni.Aplicable})`);
          console.log(`     Stock: ${boni.StockBonificacion} (tipo: ${typeof boni.StockBonificacion})`);
          
          // Verificar tipos de datos
          if (boni.Factor === null) {
            console.log('     ⚠️ Factor es NULL');
          } else if (typeof boni.Factor === 'number') {
            console.log('     ✅ Factor es número');
          } else {
            console.log('     ⚠️ Factor es de tipo inesperado');
          }
        });
        
        console.log('\n📊 Resumen de tipos:');
        const factores = producto.bonificaciones.map(b => b.Factor);
        console.log('Factores:', factores);
        console.log('Tipos de factores:', factores.map(f => typeof f));
      } else {
        console.log('\n❌ No hay bonificaciones en el campo bonificaciones');
      }
    }

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.response?.data || error.message);
  }
}

// Ejecutar pruebas
testBonificacionesFixNull();
