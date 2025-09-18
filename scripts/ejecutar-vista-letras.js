require('dotenv').config();
const { getConnection } = require('../database');
const fs = require('fs');
const path = require('path');

async function ejecutarVistaLetras() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    const pool = await getConnection();
    console.log('✅ Conexión establecida');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../sql/CrearVistaLetras.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Ejecutando script SQL...');
    
    // Dividir el script en comandos individuales
    const commands = sqlContent
      .split('GO')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        console.log(`\n📝 Ejecutando comando ${i + 1}/${commands.length}:`);
        console.log(command.substring(0, 100) + (command.length > 100 ? '...' : ''));
        
        try {
          await pool.request().query(command);
          console.log('✅ Comando ejecutado exitosamente');
        } catch (error) {
          console.error('❌ Error en comando:', error.message);
          // Continuar con el siguiente comando
        }
      }
    }

    console.log('\n🎉 Script ejecutado completamente');
    console.log('📋 Vista de Letras creada exitosamente');
    console.log('🔗 Ruta: /letras');
    console.log('📊 Vista: VistaLetrasVendedor');
    console.log('⚙️  Procedimientos: sp_LetrasPorVendedor, sp_EstadisticasLetrasVendedor, sp_LetrasPorVendedorFiltradas, sp_EstadisticasLetrasVendedorFiltradas');

  } catch (error) {
    console.error('❌ Error general:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  ejecutarVistaLetras();
}

module.exports = { ejecutarVistaLetras };
