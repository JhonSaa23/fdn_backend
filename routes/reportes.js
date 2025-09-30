const express = require('express');
const router = express.Router();
const { executeQuery, getConnection, sql } = require('../database');
const excel = require('exceljs');

// Función para formatear fecha directamente sin usar Date
function formatearFechaParaSQL(fechaString) {
  if (!fechaString) return null;
  
  // Si es un string, procesarlo directamente
  if (typeof fechaString === 'string') {
    // Si ya está en formato YYYY-MM-DD, extraer componentes directamente
    const match = fechaString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      // Crear string YYYY-MM-DD sin usar Date
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    
    // Si está en formato DD/MM/YYYY
    if (fechaString.includes('/')) {
      const partes = fechaString.split('/');
      if (partes.length === 3) {
        const dia = partes[0].padStart(2, '0');
        const mes = partes[1].padStart(2, '0');
        const anio = partes[2];
        return `${anio}-${mes}-${dia}`;
      }
    }
  }
  
  // Como último recurso, intentar con Date pero usando métodos UTC
  try {
    const fecha = new Date(fechaString);
    if (!isNaN(fecha.getTime())) {
      const anio = fecha.getUTCFullYear();
      const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getUTCDate()).padStart(2, '0');
      return `${anio}-${mes}-${dia}`;
    }
  } catch (error) {
    console.error('Error al formatear fecha:', error);
  }
  
  // Si no tiene el formato esperado o no es string, devolver la fecha original
  return fechaString;
}

// Consultar reporte CodPro con filtros
router.post('/codpro', async (req, res) => {
  try {
    const { codProducto, fechaInicio, fechaFin } = req.body;
    
    // Validar que exista al menos el código de producto
    if (!codProducto) {
      return res.status(400).json({
        success: false,
        error: 'El código de producto es requerido'
      });
    }

    const fechaInicioFormateada = formatearFechaParaSQL(fechaInicio);
    const fechaFinFormateada = formatearFechaParaSQL(fechaFin);

    let query = `
      SELECT 
        p.Numero    AS Pedido,
        FORMAT(p.Fecha, 'yyyy-MM-dd') AS Fecha,
        c.Documento AS RUC,
        c.Razon     AS RazonSocial,
        d.Cantidad,
        d.Precio,
        d.Descuento1 AS Dscto1,
        d.Descuento2 AS Dscto2,
        d.Descuento3 AS Dscto3
      FROM 
        DoccabPed p
      JOIN 
        DocdetPed d ON p.Numero = d.Numero
      JOIN 
        Clientes c ON p.CodClie = c.CodClie
      WHERE 
        d.CodPro = @codProducto
    `;
    
    let params = {
      codProducto: codProducto
    };
    
    if (fechaInicioFormateada && fechaFinFormateada) {
      query += ' AND CONVERT(date, p.Fecha) BETWEEN @fechaInicio AND @fechaFin';
      params.fechaInicio = fechaInicioFormateada;
      params.fechaFin = fechaFinFormateada;
    }
    
    // Ordenar por fecha
    query += ' ORDER BY p.Fecha ASC';
    
    // Ejecutar la consulta usando el nuevo sistema de parámetros
    const result = await executeQuery(query, params);
    
    // Devolver los resultados directamente
    res.json({
      success: true,
      data: result.recordset,
      totalRegistros: result.recordset.length
    });
    
  } catch (error) {
    console.error('Error al consultar reporte CodPro:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al consultar reporte: ' + error.message 
    });
  }
});

// Endpoint para actualizar la vista de Picking Procter
router.post('/picking-procter/view', async (req, res) => {
  try {
    const { anio, mes } = req.body;
    
    if (!anio || !mes) {
      return res.status(400).json({
        success: false,
        error: 'El año y mes son requeridos'
      });
    }

    const query = `
      EXEC dbo.sp_Jhon_ActualizarVistaPickingCobertura @anio, @mes
    `;

    await executeQuery(query, {
      anio: parseInt(anio),
      mes: parseInt(mes)
    });

    res.json({
      success: true,
      message: `Vista actualizada a ${anio}-${mes}`
    });

  } catch (error) {
    console.error('Error al actualizar vista de Picking Procter:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al actualizar vista: ' + error.message 
    });
  }
});

// Endpoint para consultar reporte de Picking Procter
router.get('/picking-procter', async (req, res) => {
  try {
    const { anio, mes } = req.query;
    
    if (!anio || !mes) {
      return res.status(400).json({
        success: false,
        error: 'El año y mes son requeridos'
      });
    }

    const query = `
      SELECT 
        Numero,
        Documento,
        Vendedor,
        Codpro
      FROM dbo.v_picking_procter_cobertura_general
      ORDER BY Numero ASC
    `;

    const result = await executeQuery(query);

    res.json({
      success: true,
      data: result.recordset,
      totalRegistros: result.recordset.length
    });

  } catch (error) {
    console.error('Error al consultar reporte de Picking Procter:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al consultar reporte: ' + error.message 
    });
  }
});

// Endpoint para descargar reporte de Picking Procter en Excel
router.get('/picking-procter/excel', async (req, res) => {
  try {
    const { anio, mes } = req.query;
    
    if (!anio || !mes) {
      return res.status(400).json({
        success: false,
        error: 'El año y mes son requeridos'
      });
    }

    const query = `
      SELECT 
        Numero as 'Número',
        Documento as 'Documento',
        Vendedor as 'Vendedor',
        Codpro as 'Código de Producto'
      FROM dbo.v_picking_procter_cobertura_general
      ORDER BY Numero ASC
    `;

    const result = await executeQuery(query);

    // Crear el libro de Excel
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Picking Procter');

    // Agregar los datos
    worksheet.columns = [
      { header: 'Número', key: 'Número', width: 15 },
      { header: 'Documento', key: 'Documento', width: 15 },
      { header: 'Vendedor', key: 'Vendedor', width: 30 },
      { header: 'Código de Producto', key: 'Código de Producto', width: 20 }
    ];

    // Estilo para el encabezado
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Agregar los datos
    worksheet.addRows(result.recordset);

    // Configurar el tipo de respuesta
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Picking_Procter_${anio}_${mes}.xlsx`
    );

    // Enviar el archivo
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error al generar Excel de Picking Procter:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al generar Excel: ' + error.message 
    });
  }
});

// Endpoint para actualizar vistas de Concurso
router.post('/concurso/actualizar', async (req, res) => {
  try {
    const { anio, mes, dia } = req.body;
    
    if (!anio || !mes || !dia) {
      return res.status(400).json({
        success: false,
        error: 'El año, mes y día son requeridos'
      });
    }

    const query = `
      EXEC dbo.sp_Jhon_actualiza_fecha_concurso @anio, @mes, @dia
    `;

    await executeQuery(query, {
      anio: parseInt(anio),
      mes: parseInt(mes),
      dia: parseInt(dia)
    });

    res.json({
      success: true,
      message: `Vistas actualizadas a la fecha ${anio}-${mes}-${dia}`
    });

  } catch (error) {
    console.error('Error al actualizar vistas de Concurso:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al actualizar vistas: ' + error.message 
    });
  }
});

// Endpoint para actualizar la vista de Notas de Crédito Loreal
router.post('/loreal-notas/view', async (req, res) => {
  try {
    const { anio, mes } = req.body;
    
    if (!anio || !mes) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere año y mes' 
      });
    }

    // Ejecutar el SP para actualizar la vista
    const pool = await getConnection();
    await pool.request()
      .input('anio', sql.Int, parseInt(anio))
      .input('mes', sql.Int, parseInt(mes))
      .execute('dbo.sp_Jhon_ActualizarVistaNCLoral');
    
    res.json({ 
      success: true, 
      message: `Vista actualizada correctamente para ${anio}-${mes}` 
    });
    
  } catch (error) {
    console.error('Error al actualizar vista de Notas Loreal:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al actualizar vista' 
    });
  }
});

// Endpoint para obtener el reporte de Notas de Crédito Loreal
router.get('/loreal-notas', async (req, res) => {
  const { anio, mes } = req.query;

  try {
    const pool = await getConnection();
    let query = `
      SELECT 
        Numero,
        Observacion,
        Codclie,
        Documento,
        Razon,
        Vendedor,
        Codpro,
        Nombre,
        Lote,
        Vencimiento,
        Cantidad,
        Precio,
        Descuento1,
        Descuento2,
        Descuento3,
        Subtotal
      FROM dbo.v_nc_loral_giselli
    `;
    if (anio && mes) {
      query += ` WHERE YEAR(Vencimiento) = ${parseInt(anio)} AND MONTH(Vencimiento) = ${parseInt(mes)} `;
    }
    query += 'ORDER BY Numero ASC';

    const result = await pool.request().query(query);
    res.json({ 
      success: true, 
      data: result.recordset 
    });
  } catch (error) {
    console.error('Error al consultar reporte de Notas Loreal:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al consultar reporte' 
    });
  }
});

// Endpoint para descargar el reporte en Excel
router.get('/loreal-notas/excel', async (req, res) => {
  const { anio, mes } = req.query;
  
  if (!anio || !mes) {
    return res.status(400).json({ 
      success: false, 
      error: 'Se requiere año y mes' 
    });
  }

  try {
    const pool = await getConnection();
    
    // Primero actualizamos la vista con los nuevos parámetros
    await pool.request()
      .input('anio', sql.Int, parseInt(anio))
      .input('mes', sql.Int, parseInt(mes))
      .execute('dbo.sp_Jhon_ActualizarVistaNCLoral');
    
    // Luego consultamos la vista actualizada
    const result = await pool.request()
      .query(`
        SELECT 
          Numero,
          Observacion,
          Codclie,
          Documento,
          Razon,
          Vendedor,
          Codpro,
          Nombre,
          Lote,
          Vencimiento,
          Cantidad,
          Precio,
          Descuento1,
          Descuento2,
          Descuento3,
          Subtotal
        FROM dbo.v_nc_loral_giselli
        ORDER BY Numero ASC
      `);
    
    // Crear el archivo Excel
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Notas de Crédito Loreal');
    
    // Definir las columnas
    const columns = [
      { header: 'Número', key: 'Numero', width: 15 },
      { header: 'Observación', key: 'Observacion', width: 30 },
      { header: 'Código Cliente', key: 'Codclie', width: 15 },
      { header: 'Documento', key: 'Documento', width: 15 },
      { header: 'Razón Social', key: 'Razon', width: 40 },
      { header: 'Vendedor', key: 'Vendedor', width: 20 },
      { header: 'Código Producto', key: 'Codpro', width: 15 },
      { header: 'Producto', key: 'Nombre', width: 40 },
      { header: 'Lote', key: 'Lote', width: 15 },
      { header: 'Vencimiento', key: 'Vencimiento', width: 15 },
      { header: 'Cantidad', key: 'Cantidad', width: 15 },
      { header: 'Precio', key: 'Precio', width: 15 },
      { header: 'Descuento 1', key: 'Descuento1', width: 15 },
      { header: 'Descuento 2', key: 'Descuento2', width: 15 },
      { header: 'Descuento 3', key: 'Descuento3', width: 15 },
      { header: 'Subtotal', key: 'Subtotal', width: 15 }
    ];

    worksheet.columns = columns;

    // Agregar los datos como tabla (esto agrega formato y filtros)
    worksheet.addTable({
      name: 'NotasCreditoLoreal',
      ref: 'A1',
      headerRow: true,
      columns: columns.map(col => ({ name: col.header })),
      rows: result.recordset.map(row => columns.map(col => row[col.key]))
    });

    // Opcional: Estilo de cabecera
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFB6D7A8' } // Verde claro, puedes cambiar el color
    };

    // Configurar respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Notas_Credito_Loreal_${anio}_${mes}.xlsx`);
    
    // Enviar archivo
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error al generar Excel de Notas Loreal:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al generar Excel' 
    });
  }
});

// Endpoint para filtro avanzado de Notas de Crédito Loreal
router.post('/loreal-notas/filtro-avanzado', async (req, res) => {
  try {
    const { fechaInicio, fechaFin, ruc, laboratorio } = req.body;
    
    // Permitir filtros parciales - no validar que al menos uno esté presente
    // El SP maneja los NULL correctamente

    const pool = await getConnection();
    
    const request = pool.request();
    
    // Agregar parámetros al request
    if (ruc) {
      request.input('Documento', sql.VarChar(20), ruc);
    } else {
      request.input('Documento', sql.VarChar(20), null);
    }
    
    if (fechaInicio) {
      request.input('FechaIni', sql.Date, formatearFechaParaSQL(fechaInicio));
    } else {
      request.input('FechaIni', sql.Date, null);
    }
    
    if (fechaFin) {
      request.input('FechaFin', sql.Date, formatearFechaParaSQL(fechaFin));
    } else {
      request.input('FechaFin', sql.Date, null);
    }
    
    if (laboratorio) {
      request.input('Laboratorio', sql.VarChar(2), laboratorio);
    } else {
      request.input('Laboratorio', sql.VarChar(2), null);
    }

    const result = await request.execute('sp_Jhon_Reporte_NotasCredito');

    res.json({
      success: true,
      data: result.recordset,
      totalRegistros: result.recordset.length,
      filtros: {
        fechaInicio,
        fechaFin,
        ruc,
        laboratorio
      }
    });

  } catch (error) {
    console.error('Error al consultar filtro avanzado de Notas Loreal:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al consultar filtro avanzado' 
    });
  }
});

// Endpoint para descargar Excel del filtro avanzado de Notas de Crédito Loreal
router.post('/loreal-notas/filtro-avanzado/excel', async (req, res) => {
  try {
    const { fechaInicio, fechaFin, ruc, laboratorio } = req.body;
    
    const pool = await getConnection();
    
    const request = pool.request();
    
    // Agregar parámetros al request
    if (ruc) {
      request.input('Documento', sql.VarChar(20), ruc);
    } else {
      request.input('Documento', sql.VarChar(20), null);
    }
    
    if (fechaInicio) {
      request.input('FechaIni', sql.Date, formatearFechaParaSQL(fechaInicio));
    } else {
      request.input('FechaIni', sql.Date, null);
    }
    
    if (fechaFin) {
      request.input('FechaFin', sql.Date, formatearFechaParaSQL(fechaFin));
    } else {
      request.input('FechaFin', sql.Date, null);
    }
    
    if (laboratorio) {
      request.input('Laboratorio', sql.VarChar(2), laboratorio);
    } else {
      request.input('Laboratorio', sql.VarChar(2), null);
    }

    const result = await request.execute('sp_Jhon_Reporte_NotasCredito');

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontraron datos para exportar'
      });
    }

    // Crear el archivo Excel
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Notas de Crédito Filtro Avanzado');
    
    // Definir las columnas (incluyendo Fecha para filtro avanzado)
    const columns = [
      { header: 'Número', key: 'Numero', width: 15 },
      { header: 'Fecha', key: 'Fecha', width: 15 },
      { header: 'Observación', key: 'Observacion', width: 30 },
      { header: 'Código Cliente', key: 'Codclie', width: 15 },
      { header: 'Documento', key: 'Documento', width: 15 },
      { header: 'Razón Social', key: 'Razon', width: 40 },
      { header: 'Vendedor', key: 'Vendedor', width: 20 },
      { header: 'Código Producto', key: 'Codpro', width: 15 },
      { header: 'Producto', key: 'Nombre', width: 40 },
      { header: 'Lote', key: 'Lote', width: 15 },
      { header: 'Vencimiento', key: 'Vencimiento', width: 15 },
      { header: 'Cantidad', key: 'Cantidad', width: 15 },
      { header: 'Precio', key: 'Precio', width: 15 },
      { header: 'Descuento 1', key: 'Descuento1', width: 15 },
      { header: 'Descuento 2', key: 'Descuento2', width: 15 },
      { header: 'Descuento 3', key: 'Descuento3', width: 15 },
      { header: 'Subtotal', key: 'Subtotal', width: 15 }
    ];

    worksheet.columns = columns;

    // Agregar los datos como tabla
    worksheet.addTable({
      name: 'NotasCreditoFiltroAvanzado',
      ref: 'A1',
      headerRow: true,
      columns: columns.map(col => ({ name: col.header })),
      rows: result.recordset.map(row => columns.map(col => row[col.key]))
    });

    // Estilo de cabecera
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFB6D7A8' }
    };

    // Generar nombre de archivo
    let filename = 'Notas_Credito_Filtro_Avanzado';
    if (fechaInicio) filename += `_desde_${fechaInicio}`;
    if (fechaFin) filename += `_hasta_${fechaFin}`;
    if (ruc) filename += `_RUC_${ruc}`;
    if (laboratorio) filename += `_Lab_${laboratorio}`;
    filename += '.xlsx';

    // Configurar respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Enviar archivo
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error al generar Excel del filtro avanzado de Notas Loreal:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al generar Excel' 
    });
  }
});

// Endpoint para obtener el año y mes actual de la vista de Notas de Crédito Loreal
router.get('/loreal-notas/vista-actual', async (req, res) => {
  try {
    const pool = await getConnection();
    // Intentar obtener el año y mes del campo Vencimiento si existe, si no, usar el campo Fecha si lo tuvieras
    const result = await pool.request().query(`
      SELECT TOP 1 
        YEAR(Vencimiento) AS anio, 
        MONTH(Vencimiento) AS mes
      FROM dbo.v_nc_loral_giselli
      WHERE Vencimiento IS NOT NULL
      ORDER BY Vencimiento DESC
    `);
    if (result.recordset.length > 0) {
      res.json({ success: true, anio: result.recordset[0].anio, mes: result.recordset[0].mes });
    } else {
      res.json({ success: false, error: 'No hay datos en la vista' });
    }
  } catch (error) {
    console.error('Error al obtener año/mes de la vista:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener año/mes de la vista' });
  }
});

// Endpoint para reporte de compras por laboratorio
router.post('/compras-laboratorio', async (req, res) => {
  try {
    const { codigoLaboratorio } = req.body;
    
    // Validar que exista el código de laboratorio
    if (!codigoLaboratorio) {
      return res.status(400).json({
        success: false,
        error: 'El código de laboratorio es requerido'
      });
    }

    const query = `
      WITH CompraAcumulada AS (
          SELECT
              RTRIM(P.Codlab) AS "CÓD_MIF (SAP)",
              RTRIM(P.Codpro) AS "CÓDIGO PRODUCTO",
              RTRIM(P.Nombre) AS DESCRIPCION,
              S.saldo AS "CANTIDAD REAL DISPONIBLE",
              DC.Numero AS "N° FACTURA COMPRA",
              DD.Lote AS LOTE,
              DD.Vencimiento AS "F.VCMTO.",
              DC.Fecha AS "FECHA DE FACTURACION",
              DD.Cantidad AS "CANTIDAD COMPRADA",
              SUM(DD.Cantidad) OVER (PARTITION BY DD.Lote ORDER BY ABS(DD.Cantidad - S.saldo)) AS SumaAcumulada
          FROM
              DocCom DC
          LEFT JOIN
              detCom DD ON DC.Numero = DD.Numero
          LEFT JOIN
              Productos P ON RTRIM(DD.CodPro) = RTRIM(P.Codpro)
          LEFT JOIN
              Docdet DV ON RTRIM(DD.CodPro) = RTRIM(DV.CodPro) AND DD.Lote = DV.Lote
          INNER JOIN
              saldos S ON RTRIM(DD.CodPro) = RTRIM(S.codpro) AND DD.Lote = S.lote AND S.almacen = 1
          WHERE
              LEFT(RTRIM(P.Codpro), 2) = @codigoLaboratorio
          GROUP BY
              P.Codlab, P.Codpro, P.Nombre, DC.Numero, DD.Cantidad, DD.Lote, DD.Vencimiento, DC.Fecha, S.saldo
          HAVING
              S.saldo > 0
      )
      SELECT
          "CÓD_MIF (SAP)",
          "CÓDIGO PRODUCTO",
          DESCRIPCION,
          "CANTIDAD REAL DISPONIBLE",
          "N° FACTURA COMPRA",
          LOTE,
          "F.VCMTO.",
          "FECHA DE FACTURACION",
          "CANTIDAD COMPRADA"
      FROM
          CompraAcumulada
      WHERE
          SumaAcumulada - "CANTIDAD COMPRADA" < "CANTIDAD REAL DISPONIBLE"
          OR (SumaAcumulada - "CANTIDAD REAL DISPONIBLE" < "CANTIDAD COMPRADA" AND SumaAcumulada >= "CANTIDAD REAL DISPONIBLE")
      ORDER BY
          DESCRIPCION, LOTE, "FECHA DE FACTURACION", "CANTIDAD COMPRADA"
    `;
    
    const params = {
      codigoLaboratorio: codigoLaboratorio
    };
    
    // Ejecutar la consulta
    const result = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: result.recordset,
      totalRegistros: result.recordset.length,
      laboratorio: codigoLaboratorio
    });
    
  } catch (error) {
    console.error('Error al consultar reporte de compras por laboratorio:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al consultar reporte: ' + error.message 
    });
  }
});

// Endpoint para exportar reporte de compras por laboratorio a Excel
router.post('/compras-laboratorio/export', async (req, res) => {
  try {
    const { codigoLaboratorio } = req.body;
    
    // Validar que exista el código de laboratorio
    if (!codigoLaboratorio) {
      return res.status(400).json({
        success: false,
        error: 'El código de laboratorio es requerido'
      });
    }

    const query = `
      WITH CompraAcumulada AS (
          SELECT
              RTRIM(P.Codlab) AS "CÓD_MIF (SAP)",
              RTRIM(P.Codpro) AS "CÓDIGO PRODUCTO",
              RTRIM(P.Nombre) AS DESCRIPCION,
              S.saldo AS "CANTIDAD REAL DISPONIBLE",
              DC.Numero AS "N° FACTURA COMPRA",
              DD.Lote AS LOTE,
              DD.Vencimiento AS "F.VCMTO.",
              DC.Fecha AS "FECHA DE FACTURACION",
              DD.Cantidad AS "CANTIDAD COMPRADA",
              SUM(DD.Cantidad) OVER (PARTITION BY DD.Lote ORDER BY ABS(DD.Cantidad - S.saldo)) AS SumaAcumulada
          FROM
              DocCom DC
          LEFT JOIN
              detCom DD ON DC.Numero = DD.Numero
          LEFT JOIN
              Productos P ON RTRIM(DD.CodPro) = RTRIM(P.Codpro)
          LEFT JOIN
              Docdet DV ON RTRIM(DD.CodPro) = RTRIM(DV.CodPro) AND DD.Lote = DV.Lote
          INNER JOIN
              saldos S ON RTRIM(DD.CodPro) = RTRIM(S.codpro) AND DD.Lote = S.lote AND S.almacen = 1
          WHERE
              LEFT(RTRIM(P.Codpro), 2) = @codigoLaboratorio
          GROUP BY
              P.Codlab, P.Codpro, P.Nombre, DC.Numero, DD.Cantidad, DD.Lote, DD.Vencimiento, DC.Fecha, S.saldo
          HAVING
              S.saldo > 0
      )
      SELECT
          "CÓD_MIF (SAP)",
          "CÓDIGO PRODUCTO",
          DESCRIPCION,
          "CANTIDAD REAL DISPONIBLE",
          "N° FACTURA COMPRA",
          LOTE,
          "F.VCMTO.",
          "FECHA DE FACTURACION",
          "CANTIDAD COMPRADA"
      FROM
          CompraAcumulada
      WHERE
          SumaAcumulada - "CANTIDAD COMPRADA" < "CANTIDAD REAL DISPONIBLE"
          OR (SumaAcumulada - "CANTIDAD REAL DISPONIBLE" < "CANTIDAD COMPRADA" AND SumaAcumulada >= "CANTIDAD REAL DISPONIBLE")
      ORDER BY
          DESCRIPCION, LOTE, "FECHA DE FACTURACION", "CANTIDAD COMPRADA"
    `;
    
    const params = {
      codigoLaboratorio: codigoLaboratorio
    };
    
    // Ejecutar la consulta
    const result = await executeQuery(query, params);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontraron datos para exportar'
      });
    }

    // Crear el archivo Excel
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Compras por Laboratorio');

    // Definir las columnas
    worksheet.columns = [
      { header: 'CÓD_MIF (SAP)', key: 'codMif', width: 15 },
      { header: 'CÓDIGO PRODUCTO', key: 'codigoProducto', width: 20 },
      { header: 'DESCRIPCIÓN', key: 'descripcion', width: 40 },
      { header: 'CANTIDAD REAL DISPONIBLE', key: 'cantidadReal', width: 20 },
      { header: 'N° FACTURA COMPRA', key: 'facturaCompra', width: 20 },
      { header: 'LOTE', key: 'lote', width: 15 },
      { header: 'F.VCMTO.', key: 'vencimiento', width: 15 },
      { header: 'FECHA FACTURACIÓN', key: 'fechaFacturacion', width: 20 },
      { header: 'CANTIDAD COMPRADA', key: 'cantidadComprada', width: 20 }
    ];

    // Agregar datos
    result.recordset.forEach(row => {
      worksheet.addRow({
        codMif: row['CÓD_MIF (SAP)'],
        codigoProducto: row['CÓDIGO PRODUCTO'],
        descripcion: row.DESCRIPCION,
        cantidadReal: row['CANTIDAD REAL DISPONIBLE'],
        facturaCompra: row['N° FACTURA COMPRA'],
        lote: row.LOTE,
        vencimiento: row['F.VCMTO.'] ? new Date(row['F.VCMTO.']).toLocaleDateString('es-ES') : '',
        fechaFacturacion: row['FECHA DE FACTURACION'] ? new Date(row['FECHA DE FACTURACION']).toLocaleDateString('es-ES') : '',
        cantidadComprada: row['CANTIDAD COMPRADA']
      });
    });

    // Estilo para el encabezado
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Generar el archivo
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Compras_Laboratorio_${codigoLaboratorio}_${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    res.send(buffer);
    
  } catch (error) {
    console.error('Error al exportar reporte de compras por laboratorio:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al exportar reporte: ' + error.message 
    });
  }
});

module.exports = router; 