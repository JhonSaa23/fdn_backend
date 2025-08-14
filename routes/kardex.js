const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database'); // Asumiendo que esto maneja tu conexión y ejecución de DB
const sql = require('mssql');
const PDFDocument = require('pdfkit');

/**
 * GET /tabla
 * Retorna todos los registros de la tabla Kardex ordenados por fecha descendente.
 */
router.get('/tabla', async (req, res) => {
  try {
    const query = `
      SELECT 
        k.numero,
        k.documento,
        CONVERT(varchar, k.fecha, 103) AS fecha,
        k.Tipo,
        k.clase,
        k.CantEnt,
        k.CantSal,
        CASE 
          WHEN dc.Vendedor IS NOT NULL AND e.Codemp IS NOT NULL 
          THEN CONCAT(dc.Vendedor, ' - ', e.Nombre)
          WHEN dc.Vendedor IS NOT NULL 
          THEN CONCAT(dc.Vendedor, ' - Sin nombre')
          ELSE ''
        END AS Vendedor,
        k.costo,
        k.venta,
        k.stock,
        k.CostoP
      FROM Kardex k WITH(NOLOCK)
      LEFT JOIN Doccab dc WITH(NOLOCK) ON k.documento = dc.Numero
      LEFT JOIN Empleados e WITH(NOLOCK) ON dc.Vendedor = e.Codemp
      ORDER BY k.Fecha DESC
    `;
    const result = await executeQuery(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener datos del kardex:', error);
    res.status(500).json({ error: 'Error al obtener datos del kardex', details: error.message });
  }
});

/**
 * POST /consultar
 * Consulta registros de Kardex con filtros dinámicos
 */
router.post('/consultar', async (req, res) => {
  try {
    const { documento, fechaDesde, fechaHasta, codpro, lote, movimiento, clase, vendedor } = req.body;

    let query = `
      SELECT 
        k.numero,
        k.documento,
        CONVERT(varchar, k.fecha, 103) AS fecha,
        k.Tipo,
        k.clase,
        k.CantEnt,
        k.CantSal,
        CASE 
          WHEN dc.Vendedor IS NOT NULL AND e.Codemp IS NOT NULL 
          THEN CONCAT(dc.Vendedor, ' - ', e.Nombre)
          WHEN dc.Vendedor IS NOT NULL 
          THEN CONCAT(dc.Vendedor, ' - Sin nombre')
          ELSE ''
        END AS Vendedor,
        k.costo,
        k.venta,
        k.stock,
        k.CostoP
      FROM Kardex k WITH(NOLOCK)
      LEFT JOIN Doccab dc WITH(NOLOCK) ON k.documento = dc.Numero
      LEFT JOIN Empleados e WITH(NOLOCK) ON dc.Vendedor = e.Codemp
      WHERE 1=1
    `;

    const params = {};

    // Filtro por código de producto
    if (codpro && codpro.trim()) {
      query += ' AND k.numero LIKE @codpro';
      params.codpro = `%${codpro.trim()}%`;
    }

    // Filtro por documento
    if (documento && documento.trim()) {
      query += ' AND k.documento LIKE @documento';
      params.documento = `%${documento.trim()}%`;
    }

    // Filtro por fecha desde
    if (fechaDesde && fechaDesde.trim()) {
      query += ' AND CONVERT(date, k.fecha) >= @fechaDesde';
      params.fechaDesde = fechaDesde.trim();
    }

    // Filtro por fecha hasta
    if (fechaHasta && fechaHasta.trim()) {
      query += ' AND CONVERT(date, k.fecha) <= @fechaHasta';
      params.fechaHasta = fechaHasta.trim();
    }

    // Filtro por lote (removido ya que la tabla Kardex no tiene columna lote)
    // if (lote && lote.trim()) {
    //   query += ' AND k.lote LIKE @lote';
    //   params.lote = `%${lote.trim()}%`;
    // }

    // Filtro por tipo de movimiento (entrada/salida)
    if (movimiento && movimiento.trim()) {
      if (movimiento === '1') {
        // Solo entradas (CantEnt > 0)
        query += ' AND k.CantEnt > 0';
      } else if (movimiento === '2') {
        // Solo salidas (CantSal > 0)
        query += ' AND k.CantSal > 0';
      }
    }

    // Filtro por clase
    if (clase && clase.trim()) {
      query += ' AND k.clase LIKE @clase';
      params.clase = `%${clase.trim()}%`;
    }

    // Filtro por vendedor
    if (vendedor && vendedor.trim()) {
      query += ' AND (dc.Vendedor LIKE @vendedor OR e.Nombre LIKE @vendedor)';
      params.vendedor = `%${vendedor.trim()}%`;
    }

    // Ordenar por fecha descendente para ver los más recientes primero
    query += ' ORDER BY k.fecha DESC, k.numero DESC';

    console.log('Ejecutando consulta kardex:', query);
    console.log('Parámetros:', params);

    const result = await executeQuery(query, params);
    res.json(result.recordset);

  } catch (error) {
    console.error('Error al consultar kardex:', error);
    res.status(500).json({ 
      error: 'Error al consultar kardex', 
      details: error.message 
    });
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
          SELECT k.numero,
                k.documento,
                CONVERT(varchar, k.fecha, 103) AS fecha,
                k.Tipo,
                k.clase,
                k.CantEnt,
                k.CantSal,
                CASE 
                  WHEN dc.Vendedor IS NOT NULL AND e.Codemp IS NOT NULL 
                  THEN CONCAT(dc.Vendedor, ' - ', e.Nombre)
                  WHEN dc.Vendedor IS NOT NULL 
                  THEN CONCAT(dc.Vendedor, ' - Sin nombre')
                  ELSE ''
                END AS Vendedor,
                k.costo,
                k.venta,
                k.stock,
                k.CostoP
          FROM Kardex k
          LEFT JOIN Doccab dc WITH(NOLOCK) ON k.documento = dc.Numero
          LEFT JOIN Empleados e WITH(NOLOCK) ON dc.Vendedor = e.Codemp
          ORDER BY k.fecha ASC;
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
 * GET /documento/:numero
 * Busca detalles de un documento en diferentes tablas de manera inteligente
 */
router.get('/documento/:numero', async (req, res) => {
  try {
    const { numero } = req.params;
    const numeroTrimmed = numero.trim();
    
    console.log(`Buscando documento: "${numeroTrimmed}"`);
    
    // Array de consultas para probar en diferentes tablas
    const queries = [
      {
        name: 'Docdet (Facturas)',
        query: `
          SELECT 
            d.numero as documento,
            d.codpro,
            p.Nombre as nombreProducto,
            d.cantidad,
            d.precio,
            d.descuento,
            d.total,
            d.impuesto,
            d.lote,
            d.vencimiento
          FROM Docdet d
          LEFT JOIN Productos p ON d.codpro = p.CodPro
          WHERE d.numero = @numero
        `
      },
      {
        name: 'DocdetPed (Pedidos)',
        query: `
          SELECT 
            d.numero as documento,
            d.codpro,
            p.Nombre as nombreProducto,
            d.cantidad,
            d.precio,
            d.descuento1,
            d.descuento2,
            d.descuento3,
            d.total,
            d.lote,
            d.vencimiento
          FROM DocdetPed d
          LEFT JOIN Productos p ON d.codpro = p.CodPro
          WHERE d.numero = @numero
        `
      }
    ];

    let resultados = [];
    let tablaEncontrada = '';

    // Probar cada consulta hasta encontrar resultados
    for (const queryInfo of queries) {
      try {
        console.log(`Probando en ${queryInfo.name}...`);
        const result = await executeQuery(queryInfo.query, { numero: numeroTrimmed });
        
        if (result.recordset && result.recordset.length > 0) {
          console.log(`Documento encontrado en ${queryInfo.name}, ${result.recordset.length} registros`);
          resultados = result.recordset;
          tablaEncontrada = queryInfo.name;
          break;
        }
      } catch (queryError) {
        console.log(`Error en ${queryInfo.name}:`, queryError.message);
        continue;
      }
    }

    if (resultados.length > 0) {
      res.json({
        success: true,
        data: resultados,
        tabla: tablaEncontrada,
        documento: numeroTrimmed
      });
    } else {
      res.status(404).json({
        success: false,
        message: `No se encontraron detalles para el documento: ${numeroTrimmed}`,
        documento: numeroTrimmed
      });
    }

  } catch (error) {
    console.error('Error al buscar documento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar documento',
      details: error.message
    });
  }
});

/**
 * GET /documento-headers/:numero
 * Obtiene los headers de las tablas y los datos del documento
 */
router.get('/documento-headers/:numero', async (req, res) => {
  try {
    const { numero } = req.params;
    const numeroTrimmed = numero.trim();
    
    console.log(`Buscando documento con headers: "${numeroTrimmed}"`);
    
    // Primero obtener los headers de ambas tablas
    const headersQueries = [
      {
        name: 'Docdet',
        query: `
          SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'Docdet'
          ORDER BY ORDINAL_POSITION
        `
      },
      {
        name: 'DocdetPed',
        query: `
          SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'DocdetPed'
          ORDER BY ORDINAL_POSITION
        `
      }
    ];

    const headers = {};
    for (const headerQuery of headersQueries) {
      try {
        const result = await executeQuery(headerQuery.query);
        headers[headerQuery.name] = result.recordset;
      } catch (error) {
        console.log(`Error obteniendo headers de ${headerQuery.name}:`, error.message);
      }
    }

    // Array de consultas para probar en diferentes tablas
    const dataQueries = [
      {
        name: 'Docdet (Facturas)',
        query: `SELECT * FROM Docdet WHERE numero = @numero`
      },
      {
        name: 'DocdetPed (Pedidos)',
        query: `SELECT * FROM DocdetPed WHERE numero = @numero`
      }
    ];

    let resultados = [];
    let tablaEncontrada = '';

    // Probar cada consulta hasta encontrar resultados
    for (const queryInfo of dataQueries) {
      try {
        console.log(`Probando datos en ${queryInfo.name}...`);
        const result = await executeQuery(queryInfo.query, { numero: numeroTrimmed });
        
        if (result.recordset && result.recordset.length > 0) {
          console.log(`Documento encontrado en ${queryInfo.name}, ${result.recordset.length} registros`);
          resultados = result.recordset;
          tablaEncontrada = queryInfo.name;
          break;
        }
      } catch (queryError) {
        console.log(`Error en ${queryInfo.name}:`, queryError.message);
        continue;
      }
    }

    if (resultados.length > 0) {
      res.json({
        success: true,
        data: resultados,
        headers: headers,
        tabla: tablaEncontrada,
        documento: numeroTrimmed
      });
    } else {
      res.json({
        success: false,
        message: `No se encontraron detalles para el documento: ${numeroTrimmed}`,
        headers: headers,
        documento: numeroTrimmed
      });
    }

  } catch (error) {
    console.error('Error al buscar documento con headers:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar documento',
      details: error.message
    });
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

/**
 * GET /cliente-documento/:numero
 * Obtiene información del cliente basándose en el número de documento
 * Busca en DoccabPed y Doccab para obtener CodClie, luego busca en Clientes
 */
router.get('/cliente-documento/:numero', async (req, res) => {
  try {
    const { numero } = req.params;
    const numeroTrimmed = numero.trim();
    
    console.log(`Buscando cliente para documento: "${numeroTrimmed}"`);
    
    // Array de consultas para buscar el CodClie en las tablas de cabecera
    const cabeceraQueries = [
      {
        name: 'DoccabPed',
        query: `
          SELECT TOP 1 Numero, CodClie, Fecha, Total
          FROM DoccabPed WITH(NOLOCK)
          WHERE Numero = @numero
        `
      },
      {
        name: 'Doccab',
        query: `
          SELECT TOP 1 Numero, CodClie, Fecha, Total
          FROM Doccab WITH(NOLOCK)
          WHERE Numero = @numero
        `
      }
    ];

    let datosCabecera = null;
    let tablaEncontrada = '';

    // Probar cada consulta hasta encontrar el documento
    for (const queryInfo of cabeceraQueries) {
      try {
        console.log(`Buscando en ${queryInfo.name}...`);
        const result = await executeQuery(queryInfo.query, { numero: numeroTrimmed });
        
        if (result.recordset && result.recordset.length > 0) {
          console.log(`Documento encontrado en ${queryInfo.name}`);
          datosCabecera = result.recordset[0];
          tablaEncontrada = queryInfo.name;
          break;
        }
      } catch (queryError) {
        console.log(`Error en ${queryInfo.name}:`, queryError.message);
        continue;
      }
    }

    if (!datosCabecera) {
      return res.json({
        success: false,
        message: `No se encontró el documento: ${numeroTrimmed} en las tablas de cabecera`,
        documento: numeroTrimmed
      });
    }

    // Buscar información del cliente con el CodClie encontrado
    const clienteQuery = `
      SELECT 
        Codclie,
        Documento as RUC,
        Razon as NombreCliente,
        Direccion,
        Celular,
        Email
      FROM Clientes WITH(NOLOCK)
      WHERE Codclie = @codclie
    `;

    try {
      const clienteResult = await executeQuery(clienteQuery, { codclie: datosCabecera.CodClie });
      
      if (clienteResult.recordset && clienteResult.recordset.length > 0) {
        const datosCliente = clienteResult.recordset[0];
        
        res.json({
          success: true,
          documento: numeroTrimmed,
          tabla: tablaEncontrada,
          cabecera: datosCabecera,
          cliente: datosCliente
        });
      } else {
        res.json({
          success: false,
          message: `No se encontró información del cliente con código: ${datosCabecera.CodClie}`,
          documento: numeroTrimmed,
          tabla: tablaEncontrada,
          cabecera: datosCabecera,
          cliente: null
        });
      }
    } catch (clienteError) {
      console.error('Error al buscar cliente:', clienteError);
      res.json({
        success: false,
        message: `Error al buscar información del cliente: ${clienteError.message}`,
        documento: numeroTrimmed,
        tabla: tablaEncontrada,
        cabecera: datosCabecera,
        cliente: null
      });
    }

  } catch (error) {
    console.error('Error al buscar cliente por documento:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar cliente',
      details: error.message
    });
  }
});

/**
 * POST /consultar-ventas
 * Consulta específicamente las salidas por ventas con detalles completos
 */
router.post('/consultar-ventas', async (req, res) => {
  try {
    const { codigo, lote, fechaDesde, fechaHasta, vendedor } = req.body;

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
        k.costo,
        CAST(LTRIM(RTRIM(k.venta)) AS DECIMAL(10,2)) as venta
      FROM Kardex k WITH(NOLOCK)
      LEFT JOIN Doccab dc WITH(NOLOCK) ON k.documento = dc.Numero
      LEFT JOIN Empleados e WITH(NOLOCK) ON dc.Vendedor = e.Codemp
      LEFT JOIN Docdet dd WITH(NOLOCK) ON k.documento = dd.numero
      LEFT JOIN DocdetPed dp WITH(NOLOCK) ON k.documento = dp.numero
      LEFT JOIN Productos p WITH(NOLOCK) ON LTRIM(RTRIM(ISNULL(dd.codpro, dp.codpro))) = LTRIM(RTRIM(p.CodPro))
      WHERE k.CantSal > 0 
        AND k.clase = 'Ventas'
    `;

    const params = {};

         // Filtro por código de producto (buscar en Docdet.codpro o DocdetPed.codpro)
     if (codigo && codigo.trim()) {
       query += ' AND (dd.codpro LIKE @codigo OR dp.codpro LIKE @codigo)';
       params.codigo = `%${codigo.trim()}%`;
     }

    // Filtro por lote (removido ya que la tabla Kardex no tiene columna lote)
    // if (lote && lote.trim()) {
    //   query += ' AND k.lote LIKE @lote';
    //   params.lote = `%${lote.trim()}%`;
    // }

    // Filtro por fecha desde
    if (fechaDesde && fechaDesde.trim()) {
      query += ' AND CONVERT(date, k.fecha) >= @fechaDesde';
      params.fechaDesde = fechaDesde.trim();
    }

    // Filtro por fecha hasta
    if (fechaHasta && fechaHasta.trim()) {
      query += ' AND CONVERT(date, k.fecha) <= @fechaHasta';
      params.fechaHasta = fechaHasta.trim();
    }

    // Si no se especifican fechas, mostrar todos los registros (sin filtro de fecha)
    // if (!fechaDesde && !fechaHasta) {
    //   query += ' AND k.fecha >= DATEADD(day, -30, GETDATE())';
    // }

    // Filtro por vendedor (exacto por código o nombre)
    if (vendedor && vendedor.trim()) {
      // Si contiene " - ", es un vendedor seleccionado del autocompletado
      if (vendedor.includes(' - ')) {
        const codigoVendedor = vendedor.split(' - ')[0].trim();
        query += ' AND dc.Vendedor = @vendedor';
        params.vendedor = codigoVendedor;
      } else {
        // Búsqueda por código exacto o nombre que contenga
        query += ' AND (dc.Vendedor = @vendedor OR e.Nombre LIKE @vendedor)';
        params.vendedor = vendedor.trim();
      }
    }

    // Ordenar por fecha descendente
    query += ' ORDER BY k.fecha DESC, k.documento DESC';

    console.log('Ejecutando consulta de ventas:', query);
    console.log('Parámetros:', params);

    const result = await executeQuery(query, params);
    res.json(result.recordset);

  } catch (error) {
    console.error('Error al consultar ventas:', error);
    res.status(500).json({ 
      error: 'Error al consultar ventas', 
      details: error.message 
    });
  }
});

/**
 * GET /vendedores
 * Obtiene la lista de vendedores disponibles
 */
router.get('/vendedores', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT 
        e.Codemp as codigo,
        e.Nombre as nombre
      FROM Empleados e WITH(NOLOCK)
      INNER JOIN Doccab dc WITH(NOLOCK) ON e.Codemp = dc.Vendedor
      INNER JOIN Kardex k WITH(NOLOCK) ON dc.Numero = k.documento
      WHERE k.CantSal > 0 
        AND k.clase = 'Ventas'
        AND e.Codemp IS NOT NULL
        AND e.Nombre IS NOT NULL
      ORDER BY e.Nombre
    `;

    const result = await executeQuery(query);
    res.json(result.recordset);

  } catch (error) {
    console.error('Error al obtener vendedores:', error);
    res.status(500).json({ 
      error: 'Error al obtener vendedores', 
      details: error.message 
    });
  }
});

/**
 * POST /generar-reporte-ventas
 * Genera un reporte PDF de las ventas consultadas
 */
router.post('/generar-reporte-ventas', async (req, res) => {
  try {
    const { ventas, filtros, totalGeneral, fechaGeneracion, vendedorSeleccionado } = req.body;

    // Crear el documento PDF
    const doc = new PDFDocument({ margin: 30 });

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-ventas.pdf');

    // Pipe el PDF a la respuesta
    doc.pipe(res);

    // Título del reporte
    doc.fontSize(20).font('Helvetica-Bold').text('REPORTE DE VENTAS', { align: 'center' });
    doc.moveDown();

    // Información del reporte
    doc.fontSize(12).font('Helvetica');
    doc.text(`Fecha de generación: ${fechaGeneracion}`);
    doc.text(`Vendedor: ${vendedorSeleccionado}`);
    doc.text(`Total de ventas: ${ventas.length}`);
    doc.text(`Total general: S/ ${totalGeneral.toFixed(2)}`);
    doc.moveDown(2);

    // Tabla de ventas
    if (ventas.length > 0) {
             // Headers de la tabla
       const headers = ['Documento', 'Fecha', 'CodPro', 'Producto', 'Cant', 'P.Unit.', 'Total', 'Vendedor'];
       const columnWidths = [56, 53, 40, 120, 25, 45, 50, 200];
      
             let yPosition = doc.y;
       let xPosition = 30;
       const columnSpacing = 10; // Espacio entre columnas

       // Dibujar headers
       doc.font('Helvetica-Bold').fontSize(10);
       headers.forEach((header, index) => {
         doc.text(header, xPosition, yPosition, { width: columnWidths[index] });
         xPosition += columnWidths[index] + columnSpacing;
       });

      yPosition += 20;
      doc.font('Helvetica').fontSize(9);

      // Dibujar datos
      ventas.forEach((venta, index) => {
        if (yPosition > 700) { // Nueva página si no hay espacio
          doc.addPage();
          yPosition = 30;
        }

        xPosition = 30;
                 const rowData = [
           venta.documento || '',
           venta.fecha || '',
           venta.codigoProducto || '',
           venta.nombreProducto || '',
           venta.cantidad || 0,
           `S/ ${(venta.venta || 0).toFixed(2)}`,
           `S/ ${((venta.cantidad || 0) * (venta.venta || 0)).toFixed(2)}`,
           venta.Vendedor || ''
         ];

                 rowData.forEach((cell, cellIndex) => {
           // Truncar texto largo para evitar desbordamiento
           let cellText = cell.toString();
           if (cellIndex === 3 && cellText.length > 20) { // Producto
             cellText = cellText.substring(0, 17) + '...';
           } else if (cellIndex === 7 && cellText.length > 15) { // Vendedor
             cellText = cellText.substring(0, 12) + '...';
           }
           
           doc.text(cellText, xPosition, yPosition, { 
             width: columnWidths[cellIndex],
             align: cellIndex === 4 || cellIndex === 5 || cellIndex === 6 ? 'right' : 'left'
           });
           xPosition += columnWidths[cellIndex] + columnSpacing;
         });

        yPosition += 15;
      });
    } else {
      doc.text('No se encontraron ventas para el criterio especificado.', { align: 'center' });
    }

    // Finalizar el documento
    doc.end();

  } catch (error) {
    console.error('Error al generar reporte PDF:', error);
    res.status(500).json({ 
      error: 'Error al generar reporte PDF', 
      details: error.message 
    });
  }
});

module.exports = router;
