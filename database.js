const sql = require('mssql');
const config = require('./config');

// Función para conectar a la base de datos
async function connectDB() {
  try {
    const pool = await sql.connect(config.dbConfig);
    console.log('Conexión a SQL Server establecida');
    return pool;
  } catch (error) {
    console.error('Error al conectar a SQL Server:', error);
    throw error;
  }
}

// Función para ejecutar consultas
async function executeQuery(query, params = []) {
  try {
    const pool = await connectDB();
    const result = await pool.request()
      .query(query);
    return result;
  } catch (error) {
    console.error('Error al ejecutar la consulta:', error);
    throw error;
  }
}

module.exports = {
  connectDB,
  executeQuery
}; 