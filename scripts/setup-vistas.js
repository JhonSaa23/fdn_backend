const { getConnection } = require('../database');
const fs = require('fs');
const path = require('path');

async function setupVistas() {
  try {
    console.log('🔄 Iniciando configuración de vistas del sistema...');
    
    const pool = await getConnection();
    console.log('✅ Conexión a la base de datos establecida');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../database/VistasSistema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Dividir el contenido en statements individuales
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Ejecutando ${statements.length} statements SQL...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⏳ Ejecutando statement ${i + 1}/${statements.length}...`);
          await pool.request().query(statement);
          console.log(`✅ Statement ${i + 1} ejecutado correctamente`);
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('ya existe')) {
            console.log(`⚠️  Statement ${i + 1} ya existe, continuando...`);
          } else {
            console.error(`❌ Error en statement ${i + 1}:`, error.message);
          }
        }
      }
    }

    console.log('🎉 Configuración de vistas completada exitosamente!');
    
    // Verificar que las tablas se crearon
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('VistasSistema', 'UsuarioVistas')
    `);
    
    console.log('📊 Tablas creadas:', tablesResult.recordset.map(r => r.TABLE_NAME));
    
    // Verificar vistas insertadas
    const vistasResult = await pool.request().query('SELECT COUNT(*) as count FROM VistasSistema');
    console.log(`📋 Vistas del sistema: ${vistasResult.recordset[0].count} registros`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error configurando vistas:', error);
    process.exit(1);
  }
}

setupVistas();
