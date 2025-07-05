// Este archivo ha sido renombrado a promociones.js
// routes/promociones.js
const express = require('express');
const router = express.Router();
const { executeQuery, sql } = require('../database');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');

// Función auxiliar para asegurar que un valor sea string y aplicar trim
const ensureString = (value) => {
  return value != null ? String(value).trim() : '';
};

// ===== GET: obtener todas las promociones con filtros dinámicos =====
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
    console.error('Error al obtener promociones:', error);
    res.status(500).json({
      error: 'Error al obtener las promociones',
      details: error.message
    });
  }
});

// Endpoint para obtener la lista de negocios (deprecated - usar /tipificaciones)
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

// Endpoint para obtener las tipificaciones desde la base de datos
router.get('/tipificaciones', async (req, res) => {
  try {
    const query = `
      SELECT 
        tipificacion,
        codlab,
        RTRIM(descripcion) as descripcion
      FROM t_Tipifica_laboratorio
      ORDER BY tipificacion
    `;
    
    const result = await executeQuery(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener tipificaciones:', error);
    res.status(500).json({
      error: 'Error al obtener las tipificaciones',
      details: error.message
    });
  }
});

// Endpoint para buscar productos por código o nombre
router.get('/buscar-productos', async (req, res) => {
  try {
    const { busqueda } = req.query;
    
    if (!busqueda) {
      return res.json([]);
    }

    const query = `
      SELECT
        RTRIM(CodPro) as codpro,
        RTRIM(Nombre) as nombre,
        RTRIM(Laboratorio) as laboratorio
      FROM Productos
      WHERE CodPro LIKE @busqueda + '%'
         OR Nombre LIKE '%' + @busqueda + '%'
      ORDER BY 
        CASE WHEN CodPro LIKE @busqueda + '%' THEN 0 ELSE 1 END,
        CodPro
    `;

    const result = await executeQuery(query, { busqueda: busqueda.trim() });
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al buscar productos:', error);
    res.status(500).json({
      error: 'Error al buscar productos',
      details: error.message
    });
  }
});

// Endpoint para obtener todos los productos
router.get('/productos', async (req, res) => {
  try {
    console.log('Iniciando consulta de productos...');
    
    const query = `
      SELECT
        RTRIM(CodPro) as codpro,
        RTRIM(Nombre) as nombre
      FROM Productos WITH(NOLOCK)
      ORDER BY CodPro
    `;

    console.log('Ejecutando query:', query);
    
    const result = await executeQuery(query);
    console.log(`Consulta exitosa. Productos encontrados: ${result.recordset.length}`);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error detallado al obtener productos:', error);
    console.error('Stack trace:', error.stack);
    
    // Verificar si es un error de conexión
    const isConnectionError = error.code === 'ECONNCLOSED' || 
                            error.code === 'ECONNRESET' ||
                            error.message.includes('connect');
                            
    res.status(500).json({
      error: 'Error al obtener productos',
      details: error.message,
      type: isConnectionError ? 'CONNECTION_ERROR' : 'QUERY_ERROR',
      code: error.code
    });
  }
});

// ===== POST: crear nueva promocion (sin error PK) =====
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
        details: 'Ya existe esta promoción en ambas tablas'
      });
    }

    // 7) Éxito
    res.json({
      message: 'Promoción creada exitosamente',
      tablas
    });
  } catch (err) {
    console.error('Error al crear la promoción:', err);
    res.status(500).json({
      error: 'Error al crear la promoción',
      details: err.message
    });
  }
});
  

// ===== PUT: actualizar promocion =====
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

    res.json({ message: 'Promoción actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar promoción:', error);
    res.status(500).json({
      error: 'Error al actualizar la promoción',
      details: error.message
    });
  }
});

// ===== DELETE: eliminar promocion =====
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

    res.json({ message: 'Promoción eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar promoción:', error);
    res.status(500).json({
      error: 'Error al eliminar la promoción',
      details: error.message
    });
  }
});

// Configuración de multer para subida de archivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/excel',
      'application/x-excel',
      'application/x-msexcel'
    ];
    
    const allowedExtensions = ['.xls', '.xlsx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xls, .xlsx)'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

// ===== POST: importar promociones desde Excel =====
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No se proporcionó archivo',
        details: 'Debe seleccionar un archivo Excel'
      });
    }

    // Leer el archivo Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      return res.status(400).json({
        error: 'Archivo vacío',
        details: 'El archivo debe contener al menos una fila de encabezados y una fila de datos'
      });
    }

    // Obtener encabezados
    const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
    
    // Buscar las columnas requeridas
    const tipificacionIndex = headers.findIndex(h => 
      h.includes('tipificacion') || h.includes('tipificación') || h.includes('tipo')
    );
    const codproIndex = headers.findIndex(h => 
      h.includes('codpro') || h.includes('codigo') || h.includes('producto')
    );
    const desdeIndex = headers.findIndex(h => 
      h.includes('desde') || h.includes('cantidad') || h.includes('min')
    );
    const porcentajeIndex = headers.findIndex(h => 
      h.includes('porcentaje') || h.includes('descuento') || h.includes('%')
    );

    if (tipificacionIndex === -1 || codproIndex === -1 || desdeIndex === -1 || porcentajeIndex === -1) {
      return res.status(400).json({
        error: 'Columnas requeridas no encontradas',
        details: 'El archivo debe contener columnas "Tipificacion", "Codpro", "Desde" y "Porcentaje"'
      });
    }

    // Procesar datos
    const promociones = [];
    const errores = [];
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0 || row.every(cell => !cell)) {
        continue; // Saltar filas vacías
      }

      const tipificacion = row[tipificacionIndex];
      const codpro = row[codproIndex];
      const desde = row[desdeIndex];
      const porcentaje = row[porcentajeIndex];

      if (!tipificacion || !codpro || desde == null || porcentaje == null) {
        errores.push(`Fila ${i + 1}: Datos incompletos`);
        continue;
      }

      const tipStr = ensureString(tipificacion);
      const codStr = ensureString(codpro);
      const desNum = parseFloat(desde);
      const porNum = parseFloat(porcentaje);

      if (isNaN(desNum) || isNaN(porNum)) {
        errores.push(`Fila ${i + 1}: "Desde" y "Porcentaje" deben ser números válidos`);
        continue;
      }

      promociones.push({
        tipificacion: tipStr,
        codpro: codStr,
        desde: desNum,
        porcentaje: porNum
      });
    }

    if (promociones.length === 0) {
      return res.status(400).json({
        error: 'No hay datos válidos para procesar',
        details: errores.length > 0 ? errores : ['No se encontraron filas con datos válidos']
      });
    }

    // Insertar en lotes para mejor rendimiento
    let insertados = 0;
    let duplicados = 0;
    const erroresInsercion = [];

    for (const promocionData of promociones) {
      try {
        const { tipificacion, codpro, desde, porcentaje } = promocionData;

        // Verificar si ya existe en alguna tabla
        const [checkTemp, checkMain] = await Promise.all([
          executeQuery(
            `SELECT 1 AS existe FROM t_Descuento_laboratorio 
             WHERE tipificacion = @tip AND LTRIM(RTRIM(codpro)) = @cod 
             AND [desde] = @des AND porcentaje = @por`,
            { tip: tipificacion, cod: codpro, des: desde, por: porcentaje }
          ),
          executeQuery(
            `SELECT 1 AS existe FROM Descuento_laboratorio 
             WHERE Tipificacion = @tip AND LTRIM(RTRIM(Codpro)) = @cod 
             AND [Desde] = @des AND Porcentaje = @por`,
            { tip: tipificacion, cod: codpro, des: desde, por: porcentaje }
          )
        ]);

        let insertadoEnAlgunaTabla = false;

        // Insertar en t_Descuento_laboratorio si no existe
        if (checkTemp.recordset.length === 0) {
          await executeQuery(
            `INSERT INTO t_Descuento_laboratorio (tipificacion, codpro, [desde], porcentaje) 
             VALUES (@tip, @cod, @des, @por)`,
            { tip: tipificacion, cod: codpro, des: desde, por: porcentaje }
          );
          insertadoEnAlgunaTabla = true;
        }

        // Insertar en Descuento_laboratorio si no existe
        // El campo Documento toma el mismo valor que Tipificacion
        if (checkMain.recordset.length === 0) {
          await executeQuery(
            `INSERT INTO Descuento_laboratorio (Documento, Tipificacion, Codpro, [Desde], Porcentaje) 
             VALUES (@tip, @tip, @cod, @des, @por)`,
            { tip: tipificacion, cod: codpro, des: desde, por: porcentaje }
          );
          insertadoEnAlgunaTabla = true;
        }

        if (insertadoEnAlgunaTabla) {
          insertados++;
        } else {
          duplicados++;
        }

      } catch (error) {
        console.error(`Error insertando promoción ${promocionData.codpro}:`, error);
        erroresInsercion.push(`Producto ${promocionData.codpro}: ${error.message}`);
      }
    }

    res.json({
      message: 'Importación de promociones completada',
      resumen: {
        totalProcesados: promociones.length,
        insertados,
        duplicados,
        errores: errores.length + erroresInsercion.length
      },
      detalles: {
        erroresValidacion: errores,
        erroresInsercion
      }
    });

  } catch (error) {
    console.error('Error en importación de promociones:', error);
    res.status(500).json({
      error: 'Error al procesar el archivo',
      details: error.message
    });
  }
});

// ===== DELETE: eliminar promociones en masa por tipificaciones =====
router.delete('/masa', async (req, res) => {
  try {
    const { tipificaciones } = req.body;

    // Validación de entrada
    if (!tipificaciones || !Array.isArray(tipificaciones) || tipificaciones.length === 0) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: 'Debe proporcionar un array de tipificaciones'
      });
    }

    // Convertir tipificaciones a números y validar
    const tipificacionesNum = [];
    for (const tip of tipificaciones) {
      const tipNum = parseFloat(tip);
      if (isNaN(tipNum)) {
        return res.status(400).json({
          error: 'Tipificación inválida',
          details: `La tipificación "${tip}" no es un número válido`
        });
      }
      tipificacionesNum.push(tipNum);
    }

    // Construir la condición WHERE con parámetros seguros
    const placeholders = tipificacionesNum.map((_, index) => `@tip${index}`).join(', ');
    const params = {};
    tipificacionesNum.forEach((tip, index) => {
      params[`tip${index}`] = tip;
    });

    // Contar registros que se van a eliminar (para el reporte)
    const countTempQuery = `
      SELECT COUNT(*) as total 
      FROM t_Descuento_laboratorio 
      WHERE tipificacion IN (${placeholders})
    `;
    
    const countMainQuery = `
      SELECT COUNT(*) as total 
      FROM Descuento_laboratorio 
      WHERE Tipificacion IN (${placeholders})
    `;

    const [countTempResult, countMainResult] = await Promise.all([
      executeQuery(countTempQuery, params),
      executeQuery(countMainQuery, params)
    ]);

    const totalTemporal = countTempResult.recordset[0].total;
    const totalPrincipal = countMainResult.recordset[0].total;

    // Eliminar de t_Descuento_laboratorio
    const deleteTempQuery = `
      DELETE FROM t_Descuento_laboratorio 
      WHERE tipificacion IN (${placeholders})
    `;

    // Eliminar de Descuento_laboratorio
    const deleteMainQuery = `
      DELETE FROM Descuento_laboratorio 
      WHERE Tipificacion IN (${placeholders})
    `;

    // Ejecutar eliminaciones
    await Promise.all([
      executeQuery(deleteTempQuery, params),
      executeQuery(deleteMainQuery, params)
    ]);

    res.json({
      message: 'Eliminación en masa de promociones completada exitosamente',
      resumen: {
        tipificacionesEliminadas: tipificacionesNum,
        registrosEliminadosTemporal: totalTemporal,
        registrosEliminadosPrincipal: totalPrincipal,
        totalRegistrosEliminados: totalTemporal + totalPrincipal
      }
    });

  } catch (error) {
    console.error('Error en eliminación en masa de promociones:', error);
    res.status(500).json({
      error: 'Error al eliminar promociones en masa',
      details: error.message
    });
  }
});

module.exports = router;
