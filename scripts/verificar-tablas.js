require('dotenv').config();
const { getConnection } = require('../database');

async function verificarTablas() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    const pool = await getConnection();
    console.log('✅ Conexión establecida');

    // Buscar tablas relacionadas con permisos
    const result = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%permiso%' 
         OR TABLE_NAME LIKE '%vista%' 
         OR TABLE_NAME LIKE '%usuario%'
         OR TABLE_NAME LIKE '%acceso%'
         OR TABLE_NAME LIKE '%rol%'
    `);
    
    console.log('=== TABLAS RELACIONADAS CON PERMISOS ===');
    result.recordset.forEach(table => {
      console.log('Tabla:', table.TABLE_NAME);
    });

    // Verificar si existe sp_ObtenerVistasUsuario
    try {
      const spResult = await pool.request().query(`
        SELECT name FROM sys.procedures WHERE name = 'sp_ObtenerVistasUsuario'
      `);
      console.log('\n=== PROCEDIMIENTOS ALMACENADOS ===');
      if (spResult.recordset.length > 0) {
        console.log('✅ sp_ObtenerVistasUsuario existe');
      } else {
        console.log('❌ sp_ObtenerVistasUsuario NO existe');
      }
    } catch (err) {
      console.log('❌ Error verificando procedimientos:', err.message);
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  } finally {
    process.exit(0);
  }
}

verificarTablas();
