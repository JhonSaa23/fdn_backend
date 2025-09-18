const { executeQuery } = require('./database');
const fs = require('fs');
const path = require('path');

async function updateProcedureWithBonifications() {
    try {
        console.log('🔄 Actualizando procedimiento Jhon_ProductoCalculos con bonificaciones...\n');

        // Leer el archivo SQL
        const sqlFilePath = path.join(__dirname, 'sql', 'Jhon_ProductoCalculos_ConBonificaciones.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

        console.log('📄 Contenido del archivo SQL leído correctamente');
        console.log(`📏 Tamaño del archivo: ${sqlContent.length} caracteres\n`);

        // Ejecutar el script SQL
        console.log('⚡ Ejecutando script SQL...');
        const result = await executeQuery(sqlContent);

        console.log('✅ Procedimiento actualizado exitosamente!');
        console.log('🎯 El procedimiento ahora incluye:');
        console.log('   - Todos los cálculos de descuentos existentes');
        console.log('   - Todas las bonificaciones disponibles para el producto');
        console.log('   - Información de stock de productos bonificados');
        console.log('   - Cálculos de paquetes completos y bonos a comprar');
        console.log('   - Indicador de qué bonificaciones son aplicables con la cantidad actual\n');

        console.log('🧪 Para probar el procedimiento, ejecuta:');
        console.log('   node test-procedure-bonificaciones.js\n');

    } catch (error) {
        console.error('❌ Error actualizando el procedimiento:', error);
        console.error('Detalles:', error.message);
    }
}

// Ejecutar la actualización
updateProcedureWithBonifications();
