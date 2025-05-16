// Configuración de la base de datos y servidor
module.exports = {
  dbConfig: {
    server: '172.27.131.227', // Cambia esto según la configuración
    database: 'SIFANO',
    user: 'Farmacos6',
    password: '2011',
    options: {
      encrypt: false,
      enableArithAbort: true,
      trustServerCertificate: true
    }
  },
  port: 3001
} 