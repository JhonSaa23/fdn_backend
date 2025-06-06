// routes/escalas.js
const express = require('express');
const router = express.Router();
const { executeQuery, sql } = require('../database');

// Función auxiliar para asegurar que un valor sea string y aplicar trim
const ensureString = (value) => {
  return value != null ? String(value).trim() : '';
};
// ===== GET: obtener todas las escalas con filtros dinámicos =====
router.get('/', async (req, res) => {
  try {
    const { tipificacion, codpro, desde, porcentaje } = req.query;

    let query = `
      WITH vw_EscalasProducto AS (
        SELECT 
          COALESCE(t.tipificacion, d.Tipificacion) AS tipificacion,
          COALESCE(t.codpro,        d.Codpro)       AS codpro,
          COALESCE(t.[desde],       d.[Desde])      AS [desde],
          COALESCE(t.porcentaje,    d.Porcentaje)   AS porcentaje,
          CASE WHEN t.tipificacion IS NOT NULL THEN 1 ELSE 0 END AS en_t,
          CASE WHEN d.Tipificacion IS NOT NULL THEN 1 ELSE 0 END AS en_d
        FROM t_Descuento_laboratorio AS t
        FULL OUTER JOIN Descuento_laboratorio AS d
          ON t.tipificacion = d.Tipificacion
         AND t.codpro        = d.Codpro
         AND t.[desde]       = d.[Desde]
         AND t.porcentaje    = d.[Porcentaje]
      )
      SELECT
        v.tipificacion,
        v.codpro,
        p.Nombre AS nombreProducto,
        v.[desde],
        v.porcentaje,
        v.en_t,
        v.en_d
      FROM vw_EscalasProducto AS v
      INNER JOIN Productos AS p
        ON LTRIM(RTRIM(v.codpro)) = LTRIM(RTRIM(p.CodPro))
      WHERE 1=1
    `;

    const params = {};
    if (tipificacion) {
      query += ' AND v.tipificacion = @tipificacion';
      params.tipificacion = ensureString(tipificacion);
    }
    if (codpro) {
      query += ' AND v.codpro = @codpro';
      params.codpro = ensureString(codpro);
    }
    if (desde) {
      query += ' AND v.[desde] = @desde';
      params.desde = parseFloat(desde);
    }
    if (porcentaje) {
      query += ' AND v.porcentaje = @porcentaje';
      params.porcentaje = parseFloat(porcentaje);
    }
    query += ' ORDER BY v.tipificacion, v.codpro, v.[desde]';

    const result = await executeQuery(query, params);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener escalas:', error);
    res.status(500).json({
      error: 'Error al obtener las escalas',
      details: error.message
    });
  }
});

// Endpoint para obtener la lista de negocios
router.get('/negocios', (req, res) => {
  const negocios = [
    { codlab: '01', numero: 1, descripcion: 'Farmacia Independiente' },
    { codlab: '01', numero: 2, descripcion: 'Mayorista' },
    { codlab: '01', numero: 3, descripcion: 'Minicadenas' },
    { codlab: '01', numero: 4, descripcion: 'Sub-Distribuidores' },
    { codlab: '01', numero: 5, descripcion: 'Institución' },
    { codlab: '49', numero: 6, descripcion: 'Cadena Regional' },
    { codlab: '49', numero: 7, descripcion: 'Farmacias Regulares' },
    { codlab: '49', numero: 8, descripcion: 'Clinicas' },
    { codlab: '49', numero: 9, descripcion: 'Mayorista' },
    { codlab: '49', numero: 10, descripcion: 'Farmacias Tops' }
  ];
  res.json(negocios);
});

// ===== POST: crear nueva escala (sin error PK) =====
router.post('/', async (req, res) => {
  try {
    const { tipificacion, codpro, desde, porcentaje } = req.body;

    // 1) Validación de presencia
    if (tipificacion == null || codpro == null || desde == null || porcentaje == null) {
      return res.status(400).json({
        error: 'Datos incompletos',
        details: 'tipificacion, codpro, desde y porcentaje son requeridos'
      });
    }

    // 2) Normalizo/parseo
    const tip = ensureString(tipificacion);
    const cod = ensureString(codpro);
    const des = parseFloat(desde);
    const por = parseFloat(porcentaje);
    if (isNaN(des) || isNaN(por)) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: '"desde" y "porcentaje" deben ser números válidos'
      });
    }

    // 3) Compruebo existencia en tabla TEMPORAL
    const checkTemp = await executeQuery(
      `SELECT 1 AS existe
         FROM t_Descuento_laboratorio
        WHERE tipificacion = @tip
          AND LTRIM(RTRIM(codpro)) = @cod
          AND [desde] = @des
          AND porcentaje = @por`,
      { tip, cod, des, por }
    );

    // 4) Compruebo existencia en tabla PRINCIPAL
    const checkMain = await executeQuery(
      `SELECT 1 AS existe
         FROM Descuento_laboratorio
        WHERE Tipificacion = @tip
          AND LTRIM(RTRIM(Codpro)) = @cod
          AND [Desde] = @des
          AND Porcentaje = @por`,
      { tip, cod, des, por }
    );

    // 5) Inserto donde falte, sin riesgo de PK duplicada
    const tablas = [];

    if (checkTemp.recordset.length === 0) {
      await executeQuery(
        `INSERT INTO t_Descuento_laboratorio
           (tipificacion, codpro, [desde], porcentaje)
         VALUES (@tip, @cod, @des, @por)`,
        { tip, cod, des, por }
      );
      tablas.push('temporal');
    }

    if (checkMain.recordset.length === 0) {
      await executeQuery(
        `INSERT INTO Descuento_laboratorio
           (Documento, Tipificacion, Codpro, [Desde], Porcentaje)
         VALUES (@tip, @tip, @cod, @des, @por)`,
        { tip, cod, des, por }
      );
      tablas.push('principal');
    }

    // 6) Si ya existía en ambas
    if (tablas.length === 0) {
      return res.status(409).json({
        error: 'Registro duplicado',
        details: 'Ya existe esta escala en ambas tablas'
      });
    }

    // 7) Éxito
    res.json({
      message: 'Escala creada exitosamente',
      tablas
    });
  } catch (err) {
    console.error('Error al crear la escala:', err);
    res.status(500).json({
      error: 'Error al crear la escala',
      details: err.message
    });
  }
});
  

// ===== PUT: actualizar escala =====
router.put('/', async (req, res) => {
  try {
    const {
      tipificacionOld, codproOld, desdeOld, porcentajeOld,
      tipificacionNew, codproNew, desdeNew, porcentajeNew
    } = req.body;

    const oldTip = ensureString(tipificacionOld);
    const oldCod = ensureString(codproOld);
    const newTip = ensureString(tipificacionNew);
    const newCod = ensureString(codproNew);

    // Actualizar en t_Descuento_laboratorio
    await executeQuery(
      `UPDATE t_Descuento_laboratorio
          SET tipificacion = @newTip,
              codpro       = @newCod,
              [desde]      = @desNew,
              porcentaje   = @porNew
        WHERE tipificacion = @oldTip
          AND codpro       = @oldCod
          AND [desde]      = @desOld
          AND porcentaje   = @porOld`,
      {
        oldTip, oldCod,
        desOld: desdeOld, porOld: porcentajeOld,
        newTip, newCod,
        desNew: desdeNew, porNew: porcentajeNew
      }
    );

    // Actualizar en Descuento_laboratorio
    await executeQuery(
      `UPDATE Descuento_laboratorio
          SET Documento     = @newTip,
              Tipificacion  = @newTip,
              Codpro        = @newCod,
              [Desde]       = @desNew,
              Porcentaje    = @porNew
        WHERE Tipificacion = @oldTip
          AND Codpro       = @oldCod
          AND [Desde]      = @desOld
          AND Porcentaje   = @porOld`,
      {
        oldTip, oldCod,
        desOld: desdeOld, porOld: porcentajeOld,
        newTip, newCod,
        desNew: desdeNew, porNew: porcentajeNew
      }
    );

    res.json({ message: 'Escala actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar escala:', error);
    res.status(500).json({
      error: 'Error al actualizar la escala',
      details: error.message
    });
  }
});

// ===== DELETE: eliminar escala =====
router.delete('/', async (req, res) => {
  try {
    const { tipificacion, codpro, desde, porcentaje } = req.body;

    const tip = ensureString(tipificacion);
    const cod = ensureString(codpro);

    // Borrar de t_Descuento_laboratorio
    await executeQuery(
      `DELETE FROM t_Descuento_laboratorio
        WHERE tipificacion = @tip
          AND codpro       = @cod
          AND [desde]      = @des
          AND porcentaje   = @por`,
      { tip, cod, des: desde, por: porcentaje }
    );

    // Borrar de Descuento_laboratorio
    await executeQuery(
      `DELETE FROM Descuento_laboratorio
        WHERE Tipificacion = @tip
          AND Codpro       = @cod
          AND [Desde]      = @des
          AND Porcentaje   = @por`,
      { tip, cod, des: desde, por: porcentaje }
    );

    res.json({ message: 'Escala eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar escala:', error);
    res.status(500).json({
      error: 'Error al eliminar la escala',
      details: error.message
    });
  }
});

module.exports = router;
