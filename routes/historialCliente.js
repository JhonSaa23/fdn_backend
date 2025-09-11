const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const sql = require('mssql');

// Endpoint para obtener lista de clientes para el select
router.get('/clientes-lista', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Query para obtener clientes únicos por documento, eliminando duplicados
    const query = `
      SELECT DISTINCT
        Documento,
        Razon,
        CONCAT(Documento, ' - ', Razon) as DisplayText
      FROM Clientes 
      WHERE Activo = 1
      ORDER BY Razon
    `;
    
    const result = await pool.request().query(query);
    
    res.json({
      success: true,
      data: result.recordset,
      message: `Se encontraron ${result.recordset.length} clientes únicos`
    });
    
  } catch (error) {
    console.error('Error obteniendo lista de clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener lista de clientes'
    });
  }
});

// Endpoint para consultar historial de cliente
router.post('/', async (req, res) => {
  try {
    const { codigoCliente, fecha, mes, año } = req.body;

    if (!codigoCliente) {
      return res.status(400).json({
        success: false,
        message: 'El código de cliente es requerido'
      });
    }

    const pool = await getConnection();
    
    let fechaConsulta = '';
    let query = '';
    
    // Determinar la fecha de consulta y construir la query
    if (mes && año) {
      // Filtrar por mes y año específicos
      const fechaInicio = `${año}-${mes}-01 00:00:00`;
      // Obtener el último día del mes
      const ultimoDia = new Date(año, mes, 0).getDate();
      const fechaFin = `${año}-${mes}-${ultimoDia} 23:59:59`;

        query = `
        SELECT
    ctc.NroDeuda,
    ctc.Documento,
    (SELECT rtrim(c_describe) FROM tablas WHERE n_codtabla = 3 AND n_numero = ctc.Tipo) +
    CASE WHEN ctc.Tipo = 7 THEN
        CASE WHEN (SELECT count(*) FROM protestadas WHERE Numero = ctc.Documento) > 0 THEN
            ' Protestada'
        ELSE
            ''
        END
    ELSE
        ''
    END AS Tipo,
    ctc.Importe,
    ctc.Saldo,
    ctc.FechaF,
    ctc.FechaV,
    ctc.Utilidades,
    ctc.FechaP
FROM
    dbo.CtaCliente ctc
INNER JOIN
    dbo.Clientes cli ON ctc.Codclie = cli.Codclie
WHERE
    cli.documento = @ruc -- Aquí se filtra por RUC
    AND ctc.FechaF >= @fechaInicio
    AND ctc.FechaF <= @fechaFin
ORDER BY
    ctc.FechaF
      `;

      const result = await pool.request()
        .input('ruc', sql.VarChar, codigoCliente.toString())
        .input('fechaInicio', sql.SmallDateTime, fechaInicio)
        .input('fechaFin', sql.SmallDateTime, fechaFin)
        .query(query);
        
      res.json({
        success: true,
        data: result.recordset,
        message: `Se encontraron ${result.recordset.length} registros para ${mes}/${año}`
      });
      
    } else if (fecha) {
      // Usar fecha específica
      fechaConsulta = fecha;
      
      const query = `
        SELECT
    ctc.NroDeuda,
    ctc.Documento,
    (SELECT rtrim(c_describe) FROM tablas WHERE n_codtabla = 3 AND n_numero = ctc.Tipo) +
    CASE WHEN ctc.Tipo = 7 THEN
        CASE WHEN (SELECT count(*) FROM protestadas WHERE Numero = ctc.Documento) > 0 THEN
            ' Protestada'
        ELSE
            ''
        END
    ELSE
        ''
    END AS Tipo,
    ctc.Importe,
    ctc.Saldo,
    ctc.FechaF,
    ctc.FechaV,
    ctc.Utilidades,
    ctc.FechaP
FROM
    dbo.CtaCliente ctc
INNER JOIN
    dbo.Clientes cli ON ctc.Codclie = cli.Codclie
WHERE
    cli.documento = @ruc
    AND ctc.FechaF <= @fecha
ORDER BY
    ctc.FechaF
      `;
      
      const result = await pool.request()
        .input('ruc', sql.VarChar, codigoCliente.toString())
        .input('fecha', sql.SmallDateTime, fechaConsulta)
        .query(query);
        
      res.json({
        success: true,
        data: result.recordset,
        message: `Se encontraron ${result.recordset.length} registros hasta ${fecha}`
      });
      
    } else {
      // Usar fecha actual
      fechaConsulta = new Date();
      
      const query = `
        SELECT
    ctc.NroDeuda,
    ctc.Documento,
    (SELECT rtrim(c_describe) FROM tablas WHERE n_codtabla = 3 AND n_numero = ctc.Tipo) +
    CASE WHEN ctc.Tipo = 7 THEN
        CASE WHEN (SELECT count(*) FROM protestadas WHERE Numero = ctc.Documento) > 0 THEN
            ' Protestada'
        ELSE
            ''
        END
    ELSE
        ''
    END AS Tipo,
    ctc.Importe,
    ctc.Saldo,
    ctc.FechaF,
    ctc.FechaV,
    ctc.Utilidades,
    ctc.FechaP
FROM
    dbo.CtaCliente ctc
INNER JOIN
    dbo.Clientes cli ON ctc.Codclie = cli.Codclie
WHERE
    cli.documento = @ruc
    AND ctc.FechaF <= @fecha
ORDER BY
    ctc.FechaF
      `;
      
      const result = await pool.request()
        .input('ruc', sql.VarChar, codigoCliente.toString())
        .input('fecha', sql.SmallDateTime, fechaConsulta)
        .query(query);
        
      res.json({
        success: true,
        data: result.recordset,
        message: `Se encontraron ${result.recordset.length} registros hasta la fecha actual`
      });
    }

  } catch (error) {
    console.error('Error consultando historial de cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar historial de cliente'
    });
  }
});

module.exports = router;
