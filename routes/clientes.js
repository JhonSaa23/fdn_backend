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

// ===== GET: obtener todos los clientes con filtros dinámicos y paginación =====
router.get('/', async (req, res) => {
  try {
    const { codlab, cliente, tipificacion, activo, page = 1, limit = 40 } = req.query;

    // Calcular offset para paginación
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `
      WITH vw_ClientesTipificacion AS (
        SELECT 
          COALESCE(t.cliente, d.Cliente) AS cliente,
          COALESCE(t.tipificacion, d.Tipificacion) AS tipificacion,
          d.Codlab AS codlab,
          CASE WHEN t.cliente IS NOT NULL THEN 1 ELSE 0 END AS en_t,
          CASE WHEN d.Cliente IS NOT NULL THEN 1 ELSE 0 END AS en_d
        FROM t_Tipificaciones AS t
        FULL OUTER JOIN Tipificaciones AS d
          ON t.cliente = d.Cliente
         AND t.tipificacion = d.Tipificacion
      )
      SELECT
        v.codlab,
        v.cliente,
        v.tipificacion,
        v.en_t,
        v.en_d,
        c.Activo,
        CASE 
          WHEN c.Activo = 1 THEN 'Activo'
          WHEN c.Activo = 0 THEN 'Inactivo'
          ELSE 'Sin información'
        END AS EstadoDescripcion
      FROM vw_ClientesTipificacion AS v
      LEFT JOIN clientes AS c ON v.cliente = c.Documento
      WHERE 1=1
    `;

    const params = {};
    if (codlab) {
      baseQuery += ' AND v.codlab = @codlab';
      params.codlab = ensureString(codlab);
    }
    if (cliente) {
      baseQuery += ' AND v.cliente = @cliente';
      params.cliente = ensureString(cliente);
    }
    if (tipificacion) {
      baseQuery += ' AND v.tipificacion = @tipificacion';
      params.tipificacion = parseFloat(tipificacion);
    }
    if (activo !== undefined && activo !== '') {
      baseQuery += ' AND c.Activo = @activo';
      params.activo = parseInt(activo);
    }

    // Query para obtener el total de registros
    const countQuery = `
      WITH vw_ClientesTipificacion AS (
        SELECT 
          COALESCE(t.cliente, d.Cliente) AS cliente,
          COALESCE(t.tipificacion, d.Tipificacion) AS tipificacion,
          d.Codlab AS codlab,
          CASE WHEN t.cliente IS NOT NULL THEN 1 ELSE 0 END AS en_t,
          CASE WHEN d.Cliente IS NOT NULL THEN 1 ELSE 0 END AS en_d
        FROM t_Tipificaciones AS t
        FULL OUTER JOIN Tipificaciones AS d
          ON t.cliente = d.Cliente
         AND t.tipificacion = d.Tipificacion
      )
      SELECT COUNT(*) as total
      FROM vw_ClientesTipificacion AS v
      LEFT JOIN clientes AS c ON v.cliente = c.Documento
      WHERE 1=1
      ${codlab ? ' AND v.codlab = @codlab' : ''}
      ${cliente ? ' AND v.cliente = @cliente' : ''}
      ${tipificacion ? ' AND v.tipificacion = @tipificacion' : ''}
      ${activo !== undefined && activo !== '' ? ' AND c.Activo = @activo' : ''}
    `;

    // Query con paginación
    const dataQuery = baseQuery + 
      ' ORDER BY v.codlab, v.cliente, v.tipificacion' +
      ` OFFSET ${offset} ROWS FETCH NEXT ${limitNum} ROWS ONLY`;

    // Ejecutar ambas queries
    const [totalResult, dataResult] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(dataQuery, params)
    ]);

    const total = totalResult.recordset[0].total;
    const totalPages = Math.ceil(total / limitNum);
    const hasMore = pageNum < totalPages;

    res.json({
      data: dataResult.recordset,
      pagination: {
        currentPage: pageNum,
        totalPages,
        limit: limitNum,
        total,
        hasMore
      }
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({
      error: 'Error al obtener los clientes',
      details: error.message
    });
  }
});

// Endpoint para obtener la lista de laboratorios
router.get('/laboratorios', (req, res) => {
  const laboratorios = [
    { codlab: '01', descripcion: 'Laboratorio 01' },
    { codlab: '49', descripcion: 'Laboratorio 49' }
  ];
  res.json(laboratorios);
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

// ===== GET: obtener clientes con información de estado activo =====
router.get('/con-estado', async (req, res) => {
  try {
    const { documento, activo, page = 1, limit = 40 } = req.query;

    // Calcular offset para paginación
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `
      SELECT 
        Documento,
        Activo,
        Codclie,
        Razon,
        Direccion,
        Telefono1,
        Telefono2,
        Celular,
        Email,
        Vendedor,
        CASE 
          WHEN Activo = 1 THEN 'Activo'
          ELSE 'Inactivo'
        END AS EstadoDescripcion
      FROM clientes
      WHERE 1=1
    `;

    const params = {};
    if (documento) {
      baseQuery += ' AND Documento = @documento';
      params.documento = ensureString(documento);
    }
    if (activo !== undefined && activo !== '') {
      baseQuery += ' AND Activo = @activo';
      params.activo = parseInt(activo);
    }

    // Query para obtener el total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM clientes
      WHERE 1=1
      ${documento ? ' AND Documento = @documento' : ''}
      ${activo !== undefined && activo !== '' ? ' AND Activo = @activo' : ''}
    `;

    // Query con paginación
    const dataQuery = baseQuery + 
      ' ORDER BY Documento' +
      ` OFFSET ${offset} ROWS FETCH NEXT ${limitNum} ROWS ONLY`;

    // Ejecutar ambas queries
    const [totalResult, dataResult] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(dataQuery, params)
    ]);

    const total = totalResult.recordset[0].total;
    const totalPages = Math.ceil(total / limitNum);
    const hasMore = pageNum < totalPages;

    res.json({
      data: dataResult.recordset,
      pagination: {
        currentPage: pageNum,
        totalPages,
        limit: limitNum,
        total,
        hasMore
      }
    });
  } catch (error) {
    console.error('Error al obtener clientes con estado:', error);
    res.status(500).json({
      error: 'Error al obtener los clientes con estado',
      details: error.message
    });
  }
});

// ===== POST: crear nuevo cliente (sin error PK) =====
router.post('/', async (req, res) => {
  try {
    const { codlab, cliente, tipificacion } = req.body;

    // 1) Validación de presencia
    if (cliente == null || tipificacion == null) {
      return res.status(400).json({
        error: 'Datos incompletos',
        details: 'cliente y tipificacion son requeridos'
      });
    }

    // 2) Normalizo/parseo
    const cod = ensureString(codlab || '01'); // Por defecto laboratorio 01
    const cli = ensureString(cliente);
    const tip = parseFloat(tipificacion);
    if (isNaN(tip)) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: '"tipificacion" debe ser un número válido'
      });
    }

    // 3) Compruebo existencia en tabla TEMPORAL
    const checkTemp = await executeQuery(
      `SELECT 1 AS existe
         FROM t_Tipificaciones
        WHERE cliente = @cli
          AND tipificacion = @tip`,
      { cli, tip }
    );

    // 4) Compruebo existencia en tabla PRINCIPAL
    const checkMain = await executeQuery(
      `SELECT 1 AS existe
         FROM Tipificaciones
        WHERE Codlab = @cod
          AND Cliente = @cli
          AND Tipificacion = @tip`,
      { cod, cli, tip }
    );

    // 5) Inserto donde falte, sin riesgo de PK duplicada
    const tablas = [];

    if (checkTemp.recordset.length === 0) {
      await executeQuery(
        `INSERT INTO t_Tipificaciones
           (cliente, tipificacion)
         VALUES (@cli, @tip)`,
        { cli, tip }
      );
      tablas.push('temporal');
    }

    if (checkMain.recordset.length === 0) {
      await executeQuery(
        `INSERT INTO Tipificaciones
           (Codlab, Cliente, Tipificacion)
         VALUES (@cod, @cli, @tip)`,
        { cod, cli, tip }
      );
      tablas.push('principal');
    }

    // 6) Si ya existía en ambas
    if (tablas.length === 0) {
      return res.status(409).json({
        error: 'Registro duplicado',
        details: 'Ya existe este cliente en ambas tablas'
      });
    }

    // 7) Éxito
    res.json({
      message: 'Cliente creado exitosamente',
      tablas
    });
  } catch (err) {
    console.error('Error al crear el cliente:', err);
    res.status(500).json({
      error: 'Error al crear el cliente',
      details: err.message
    });
  }
});

// ===== PUT: actualizar cliente =====
router.put('/', async (req, res) => {
  try {
    const {
      codlabOld, clienteOld, tipificacionOld,
      codlabNew, clienteNew, tipificacionNew
    } = req.body;

    const oldCod = ensureString(codlabOld);
    const oldCli = ensureString(clienteOld);
    const newCod = ensureString(codlabNew);
    const newCli = ensureString(clienteNew);

    // Actualizar en t_Tipificaciones
    await executeQuery(
      `UPDATE t_Tipificaciones
          SET cliente = @newCli,
              tipificacion = @tipNew
        WHERE cliente = @oldCli
          AND tipificacion = @tipOld`,
      {
        oldCli,
        tipOld: tipificacionOld,
        newCli,
        tipNew: tipificacionNew
      }
    );

    // Actualizar en Tipificaciones
    await executeQuery(
      `UPDATE Tipificaciones
          SET Codlab = @newCod,
              Cliente = @newCli,
              Tipificacion = @tipNew
        WHERE Codlab = @oldCod
          AND Cliente = @oldCli
          AND Tipificacion = @tipOld`,
      {
        oldCod, oldCli,
        tipOld: tipificacionOld,
        newCod, newCli,
        tipNew: tipificacionNew
      }
    );

    res.json({ message: 'Cliente actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({
      error: 'Error al actualizar el cliente',
      details: error.message
    });
  }
});

// ===== DELETE: eliminar cliente =====
router.delete('/', async (req, res) => {
  try {
    const { codlab, cliente, tipificacion } = req.body;

    const cod = ensureString(codlab);
    const cli = ensureString(cliente);

    // Borrar de t_Tipificaciones
    await executeQuery(
      `DELETE FROM t_Tipificaciones
        WHERE cliente = @cli
          AND tipificacion = @tip`,
      { cli, tip: tipificacion }
    );

    // Borrar de Tipificaciones
    await executeQuery(
      `DELETE FROM Tipificaciones
        WHERE Codlab = @cod
          AND Cliente = @cli
          AND Tipificacion = @tip`,
      { cod, cli, tip: tipificacion }
    );

    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({
      error: 'Error al eliminar el cliente',
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

// ===== POST: importar clientes desde Excel =====
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const { codlab } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        error: 'No se proporcionó archivo',
        details: 'Debe seleccionar un archivo Excel'
      });
    }

    if (!codlab) {
      return res.status(400).json({
        error: 'Laboratorio requerido',
        details: 'Debe seleccionar un laboratorio (01 o 49)'
      });
    }

    const cod = ensureString(codlab);
    if (cod !== '01' && cod !== '49') {
      return res.status(400).json({
        error: 'Laboratorio inválido',
        details: 'El laboratorio debe ser 01 o 49'
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
    
    // Buscar las columnas Cliente y Tipificacion
    const clienteIndex = headers.findIndex(h => 
      h.includes('cliente') || h.includes('ruc') || h.includes('documento')
    );
    const tipificacionIndex = headers.findIndex(h => 
      h.includes('tipificacion') || h.includes('tipificación') || h.includes('tipo')
    );

    if (clienteIndex === -1 || tipificacionIndex === -1) {
      return res.status(400).json({
        error: 'Columnas requeridas no encontradas',
        details: 'El archivo debe contener columnas "Cliente" y "Tipificacion"'
      });
    }

    // Procesar datos
    const clientes = [];
    const errores = [];
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0 || row.every(cell => !cell)) {
        continue; // Saltar filas vacías
      }

      const cliente = row[clienteIndex];
      const tipificacion = row[tipificacionIndex];

      if (!cliente || !tipificacion) {
        errores.push(`Fila ${i + 1}: Cliente o Tipificación vacíos`);
        continue;
      }

      const clienteStr = ensureString(cliente);
      const tipStr = parseFloat(tipificacion);

      if (isNaN(tipStr)) {
        errores.push(`Fila ${i + 1}: Tipificación "${tipificacion}" no es un número válido`);
        continue;
      }

      clientes.push({
        cliente: clienteStr,
        tipificacion: tipStr
      });
    }

    if (clientes.length === 0) {
      return res.status(400).json({
        error: 'No hay datos válidos para procesar',
        details: errores.length > 0 ? errores : ['No se encontraron filas con datos válidos']
      });
    }

    // Insertar en lotes para mejor rendimiento
    let insertados = 0;
    let duplicados = 0;
    const erroresInsercion = [];

    for (const clienteData of clientes) {
      try {
        const { cliente, tipificacion } = clienteData;

        // Verificar si ya existe en alguna tabla
        const [checkTemp, checkMain] = await Promise.all([
          executeQuery(
            `SELECT 1 AS existe FROM t_Tipificaciones 
             WHERE cliente = @cli AND tipificacion = @tip`,
            { cli: cliente, tip: tipificacion }
          ),
          executeQuery(
            `SELECT 1 AS existe FROM Tipificaciones 
             WHERE Codlab = @cod AND Cliente = @cli AND Tipificacion = @tip`,
            { cod, cli: cliente, tip: tipificacion }
          )
        ]);

        let insertadoEnAlgunaTabla = false;

        // Insertar en t_Tipificaciones si no existe
        if (checkTemp.recordset.length === 0) {
          await executeQuery(
            `INSERT INTO t_Tipificaciones (cliente, tipificacion) 
             VALUES (@cli, @tip)`,
            { cli: cliente, tip: tipificacion }
          );
          insertadoEnAlgunaTabla = true;
        }

        // Insertar en Tipificaciones si no existe
        if (checkMain.recordset.length === 0) {
          await executeQuery(
            `INSERT INTO Tipificaciones (Codlab, Cliente, Tipificacion) 
             VALUES (@cod, @cli, @tip)`,
            { cod, cli: cliente, tip: tipificacion }
          );
          insertadoEnAlgunaTabla = true;
        }

        if (insertadoEnAlgunaTabla) {
          insertados++;
        } else {
          duplicados++;
        }

      } catch (error) {
        console.error(`Error insertando cliente ${clienteData.cliente}:`, error);
        erroresInsercion.push(`Cliente ${clienteData.cliente}: ${error.message}`);
      }
    }

    res.json({
      message: 'Importación completada',
      resumen: {
        totalProcesados: clientes.length,
        insertados,
        duplicados,
        errores: errores.length + erroresInsercion.length
      },
      detalles: {
        laboratorio: cod,
        erroresValidacion: errores,
        erroresInsercion
      }
    });

  } catch (error) {
    console.error('Error en importación:', error);
    res.status(500).json({
      error: 'Error al procesar el archivo',
      details: error.message
    });
  }
});

// ===== DELETE: eliminar clientes en masa por tipificaciones =====
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
      FROM t_Tipificaciones 
      WHERE tipificacion IN (${placeholders})
    `;
    
    const countMainQuery = `
      SELECT COUNT(*) as total 
      FROM Tipificaciones 
      WHERE Tipificacion IN (${placeholders})
    `;

    const [countTempResult, countMainResult] = await Promise.all([
      executeQuery(countTempQuery, params),
      executeQuery(countMainQuery, params)
    ]);

    const totalTemporal = countTempResult.recordset[0].total;
    const totalPrincipal = countMainResult.recordset[0].total;

    // Eliminar de t_Tipificaciones
    const deleteTempQuery = `
      DELETE FROM t_Tipificaciones 
      WHERE tipificacion IN (${placeholders})
    `;

    // Eliminar de Tipificaciones
    const deleteMainQuery = `
      DELETE FROM Tipificaciones 
      WHERE Tipificacion IN (${placeholders})
    `;

    // Ejecutar eliminaciones
    await Promise.all([
      executeQuery(deleteTempQuery, params),
      executeQuery(deleteMainQuery, params)
    ]);

    res.json({
      message: 'Eliminación en masa completada exitosamente',
      resumen: {
        tipificacionesEliminadas: tipificacionesNum,
        registrosEliminadosTemporal: totalTemporal,
        registrosEliminadosPrincipal: totalPrincipal,
        totalRegistrosEliminados: totalTemporal + totalPrincipal
      }
    });

  } catch (error) {
    console.error('Error en eliminación en masa:', error);
    res.status(500).json({
      error: 'Error al eliminar clientes en masa',
      details: error.message
    });
  }
});

module.exports = router; 