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
  const { anio, mes } = req.body;
  
  if (!anio || !mes) {
    return res.status(400).json({ 
      success: false, 
      error: 'Se requiere año y mes' 
    });
  }

  try {
    const pool = await getConnection();
    
    // Ejecutar el procedimiento almacenado para actualizar la vista
    await pool.request()
      .input('anio', sql.Int, parseInt(anio))
      .input('mes', sql.Int, parseInt(mes))
      .execute('dbo.sp_Jhon_ActualizarVistaNCLoral');
    
    res.json({ 
      success: true, 
      message: 'Vista actualizada correctamente' 
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

module.exports = router; 