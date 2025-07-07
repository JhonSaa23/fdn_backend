const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database'); // Asumiendo que esto maneja tu conexión y ejecución de DB
const sql = require('mssql');

/**
 * GET /tabla
 * Retorna todos los registros de la tabla Kardex ordenados por fecha descendente.
 */
router.get('/tabla', async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM Kardex WITH(NOLOCK)
      ORDER BY Fecha DESC
    `;
    const result = await executeQuery(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener datos del kardex:', error);
    res.status(500).json({ error: 'Error al obtener datos del kardex', details: error.message });
  }
});

/**
 * POST /ejecutar-procedimiento
 * Ejecuta el stored procedure sp_kardex con parámetros:
 * - codigo: string (obligatorio, código de producto)
 * - lote: string opcional
 * - fechaInicio, fechaFin: string en formato YYYY-MM-DD
 */
router.post('/ejecutar-procedimiento', async (req, res) => {
  const { codigo, lote = '', fechaInicio, fechaFin } = req.body;

  // 1) Validaciones de presencia
  if (!codigo || !fechaInicio || !fechaFin) {
    return res.status(400).json({ error: 'Los campos código, fecha inicio y fecha fin son obligatorios' });
  }

  // 2) Formato de fechas YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(fechaInicio) || !dateRegex.test(fechaFin)) {
    return res.status(400).json({ error: 'Las fechas deben estar en formato YYYY-MM-DD' });
  }

  // 3) Convertir a Date y validar rango SQL Server
  const d1 = new Date(fechaInicio);
  const d2 = new Date(fechaFin);
  const minDate = new Date('1753-01-01'); // Fecha mínima para smalldatetime en SQL Server
  const maxDate = new Date('9999-12-31'); // Fecha máxima para datetime en SQL Server

  if (isNaN(d1) || isNaN(d2) || d1 < minDate || d2 > maxDate) {
    return res.status(400).json({ error: 'Fechas inválidas o fuera de rango SQL Server' });
  }
  if (d1 > d2) {
    return res.status(400).json({ error: 'fechaInicio debe ser anterior o igual a fechaFin' });
  }

  // Formatear las fechas a 'YYYY-MM-DD' para incrustarlas directamente en la consulta SQL
  const formattedFechaInicio = d1.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const formattedFechaFin = d2.toISOString().slice(0, 10);   // "YYYY-MM-DD"

  // 4) Preparar valores al ancho fijo del SP
  const codFixed  = codigo.toString().trim().padEnd(10, ' ');
  const loteFixed = lote.toString().trim().padEnd(15, ' ');

  try {
    console.log('Ejecutando sp_kardex con:', { codFixed, loteFixed, formattedFechaInicio, formattedFechaFin });

    // **** CAMBIO CLAVE AQUÍ: Construir la consulta SQL con las fechas como literales ****
    // Esto evita que el driver mssql intente inferir el tipo o formato para los parámetros de fecha,
    // y en su lugar, SQL Server los interpretará directamente como cadenas de fecha válidas.
    const spExecutionQuery = `
      EXEC dbo.sp_kardex
        @c = '${codFixed}',
        @lote = '${loteFixed}',
        @fec1 = '${formattedFechaInicio}',
        @fec2 = '${formattedFechaFin}';
    `;

    // 5) Ejecutar el SP. Nota: No pasamos el segundo objeto de parámetros para las fechas,
    // ya que están incrustadas directamente en la cadena de consulta.
    // Solo pasamos los parámetros de cadena que no son fechas.
    await executeQuery(spExecutionQuery);

    // 6) Leer y devolver resultados de Kardex
    const result = await executeQuery(
      `
        SELECT numero,
               documento,
               CONVERT(varchar, fecha, 103) AS fecha,
               Tipo,
               clase,
               CantEnt,
               CantSal,
               costo,
               venta,
               stock,
               CostoP
        FROM Kardex
        ORDER BY fecha ASC;
      `
    );

    return res.json({ success: true, totalRows: result.recordset.length, data: result.recordset });
  } catch (error) {
    console.error('Error al ejecutar sp_kardex:', error);
    let errorMessage = 'Error interno al ejecutar sp_kardex';
    if (error.originalError && error.originalError.info && error.originalError.info.message) {
      errorMessage = `Error de la base de datos: ${error.originalError.info.message}`;
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`;
    }
    return res.status(500).json({ error: errorMessage, details: error.message });
  }
});

/**
 * GET /observaciones/:documento
 * Obtiene observaciones en Movimientos_cab para un documento dado.
 */
router.get('/observaciones/:documento', async (req, res) => {
  try {
    const { documento } = req.params;
    const query = `
      SELECT Documento, Fecha, Observaciones, Anulado
      FROM Movimientos_cab WITH(NOLOCK)
      WHERE LTRIM(RTRIM(Documento)) = @documento
    `;
    const result = await executeQuery(query, { documento: documento.trim() });
    if (result.recordset.length === 0) {
      return res.json({ success: true, data: null, message: 'No se encontraron observaciones para este documento' });
    }
    return res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('Error al obtener observaciones:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor al obtener observaciones' });
  }
});

module.exports = router;