require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function verificarCampos() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    const pool = await sql.connect(config);
    console.log('✅ Conexión exitosa');

    // Verificar campos de Docdet
    console.log('\n📋 Campos de la tabla Docdet:');
    const docdetResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Docdet' 
      ORDER BY ORDINAL_POSITION
    `);
    
    docdetResult.recordset.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // Verificar campos de DocdetPed
    console.log('\n📋 Campos de la tabla DocdetPed:');
    const docdetPedResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'DocdetPed' 
      ORDER BY ORDINAL_POSITION
    `);
    
    docdetPedResult.recordset.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // Verificar si hay algún campo similar a "lote"
    console.log('\n🔍 Buscando campos que contengan "lote" o "lot":');
    const loteResult = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE COLUMN_NAME LIKE '%lote%' OR COLUMN_NAME LIKE '%lot%'
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);
    
    if (loteResult.recordset.length > 0) {
      loteResult.recordset.forEach(col => {
        console.log(`  - ${col.TABLE_NAME}.${col.COLUMN_NAME} (${col.DATA_TYPE})`);
      });
    } else {
      console.log('  No se encontraron campos con "lote" o "lot"');
    }

    await pool.close();
    console.log('\n🔌 Conexión cerrada');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verificarCampos();
