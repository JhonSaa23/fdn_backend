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

async function testConsultarVentas() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    const pool = await sql.connect(config);
    console.log('✅ Conexión exitosa');

    // Simular los parámetros que vienen del frontend
    const filtros = {
      vendedor: '',
      codigo: ''
    };

    let query = `
      SELECT 
        k.documento,
        CONVERT(varchar, k.fecha, 103) AS fecha,
        k.CantSal as cantidad,
        CASE 
          WHEN dc.Vendedor IS NOT NULL AND e.Codemp IS NOT NULL 
          THEN CONCAT(dc.Vendedor, ' - ', e.Nombre)
          WHEN dc.Vendedor IS NOT NULL 
          THEN CONCAT(dc.Vendedor, ' - Sin nombre')
          ELSE ''
        END AS Vendedor,
        ISNULL(dd.codpro, dp.codpro) as codigoProducto,
        ISNULL(p.Nombre, 'Sin nombre') as nombreProducto,
        ISNULL(dd.Lote, dp.Lote) as loteProducto,
        ISNULL(c.Razon, 'Sin cliente') as nombreCliente,
        ISNULL(c.documento, 'Sin RUC') as rucCliente,
        k.costo,
        CAST(LTRIM(RTRIM(k.venta)) AS DECIMAL(10,2)) as venta
      FROM Kardex k WITH(NOLOCK)
      LEFT JOIN Doccab dc WITH(NOLOCK) ON k.documento = dc.Numero
      LEFT JOIN Empleados e WITH(NOLOCK) ON dc.Vendedor = e.Codemp
      LEFT JOIN Docdet dd WITH(NOLOCK) ON k.documento = dd.numero
      LEFT JOIN DocdetPed dp WITH(NOLOCK) ON k.documento = dp.numero
      LEFT JOIN Productos p WITH(NOLOCK) ON LTRIM(RTRIM(ISNULL(dd.codpro, dp.codpro))) = LTRIM(RTRIM(p.CodPro))
      LEFT JOIN Clientes c WITH(NOLOCK) ON dc.CodClie = c.Codclie
      WHERE k.clase = 'Ventas' AND k.CantSal > 0
    `;

    const params = [];

    if (filtros.vendedor && filtros.vendedor.trim()) {
      query += ' AND (dc.Vendedor LIKE @vendedor OR e.Nombre LIKE @vendedor)';
      params.push({ name: 'vendedor', value: `%${filtros.vendedor.trim()}%` });
    }

    if (filtros.codigo && filtros.codigo.trim()) {
      query += ' AND (dd.codpro LIKE @codigo OR dp.codpro LIKE @codigo)';
      params.push({ name: 'codigo', value: `%${filtros.codigo.trim()}%` });
    }

    query += ' ORDER BY k.fecha DESC';

    console.log('🔍 Ejecutando consulta...');
    console.log('Query:', query);
    console.log('Parámetros:', params);

    const request = pool.request();
    
    // Agregar parámetros
    params.forEach(param => {
      request.input(param.name, param.value);
    });

    const result = await request.query(query);
    
    console.log('✅ Consulta ejecutada exitosamente');
    console.log('📊 Resultados encontrados:', result.recordset.length);
    
    if (result.recordset.length > 0) {
      console.log('📋 Primer registro:', result.recordset[0]);
    }

    await pool.close();
    console.log('🔌 Conexión cerrada');

  } catch (error) {
    console.error('❌ Error en la consulta:', error);
    console.error('Detalles del error:', error.message);
    if (error.code) {
      console.error('Código de error:', error.code);
    }
  }
}

testConsultarVentas();
