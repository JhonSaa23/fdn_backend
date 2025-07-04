const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');
const sql = require('mssql');

// Endpoint para consultar guías con paginación (de la más reciente a la más antigua)
router.get('/listar', async (req, res) => {
  try {
    const { page = 1, limit = 40, tipo, numero, fechaDesde, fechaHasta } = req.query;

    if (!tipo || (tipo !== 'GUIA' && tipo !== 'FACTURA')) {
      return res.json({ success: true, data: [], pagination: { currentPage: 1, totalPages: 0, limit: 40, total: 0, hasMore: false } });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    let baseQuery = '';
    let countQuery = '';
    const params = {};

    if (tipo === 'GUIA') {
      baseQuery = `SELECT Numero, Docventa, TipoDoc, Fecha, Empresa, Ruc, Placa, PtoLLegada, Destino, Eliminado, Impreso, Peso
                   FROM DoccabGuia WHERE 1=1`;
      countQuery = `SELECT COUNT(*) as total FROM DoccabGuia WHERE 1=1`;
      if (numero && numero.trim()) {
        baseQuery += ' AND Numero LIKE @numero';
        countQuery += ' AND Numero LIKE @numero';
        params.numero = `%${numero.trim()}%`;
      }
      if (fechaDesde && fechaDesde.trim()) {
        baseQuery += ' AND Fecha >= @fechaDesde';
        countQuery += ' AND Fecha >= @fechaDesde';
        params.fechaDesde = new Date(fechaDesde.trim());
      }
      if (fechaHasta && fechaHasta.trim()) {
        baseQuery += ' AND Fecha <= @fechaHasta';
        countQuery += ' AND Fecha <= @fechaHasta';
        params.fechaHasta = new Date(fechaHasta.trim());
      }
      baseQuery += ' ORDER BY Fecha DESC, Numero DESC';
      baseQuery += ` OFFSET ${offset} ROWS FETCH NEXT ${limitNum} ROWS ONLY`;
    } else if (tipo === 'FACTURA') {
      baseQuery = `SELECT Numero, Tipo, CodClie, Fecha, Dias, FechaV, Bruto, Descuento, Flete, Subtotal, Igv, Total, Moneda, Cambio, Vendedor, Transporte, Eliminado, Impreso, NroPedido, NroGuia
                   FROM Doccab WHERE 1=1`;
      countQuery = `SELECT COUNT(*) as total FROM Doccab WHERE 1=1`;
      if (numero && numero.trim()) {
        baseQuery += ' AND Numero LIKE @numero';
        countQuery += ' AND Numero LIKE @numero';
        params.numero = `%${numero.trim()}%`;
      }
      if (fechaDesde && fechaDesde.trim()) {
        baseQuery += ' AND Fecha >= @fechaDesde';
        countQuery += ' AND Fecha >= @fechaDesde';
        params.fechaDesde = new Date(fechaDesde.trim());
      }
      if (fechaHasta && fechaHasta.trim()) {
        baseQuery += ' AND Fecha <= @fechaHasta';
        countQuery += ' AND Fecha <= @fechaHasta';
        params.fechaHasta = new Date(fechaHasta.trim());
      }
      baseQuery += ' ORDER BY Fecha DESC, Numero DESC';
      baseQuery += ` OFFSET ${offset} ROWS FETCH NEXT ${limitNum} ROWS ONLY`;
    }

    const [totalResult, dataResult] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(baseQuery, params)
    ]);
    const total = totalResult.recordset[0].total;
    const totalPages = Math.ceil(total / limitNum);
    const hasMore = pageNum < totalPages;
    res.json({
      success: true,
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
    console.error('Error al consultar guías:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Endpoint para buscar una guía específica y obtener información de guía y factura relacionada
router.get('/buscar-guia/:numero', async (req, res) => {
  try {
    const { numero } = req.params;
    
    if (!numero) {
      return res.status(400).json({
        success: false,
        error: 'Número de guía es requerido'
      });
    }
    
    // Buscar la guía en DoccabGuia
    const guiaQuery = `
      SELECT Numero, Docventa, TipoDoc, Fecha as FechaTransporte, Empresa, Ruc, Placa, PtoLLegada, Destino, Eliminado, Impreso, Peso
      FROM DoccabGuia 
      WHERE Numero = @numero
    `;
    
    const guiaResult = await executeQuery(guiaQuery, { numero });
    
    if (guiaResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No se encontró la guía ${numero}`
      });
    }
    
    const guia = guiaResult.recordset[0];
    
    // Buscar la factura relacionada en Doccab usando el Docventa
    let factura = null;
    if (guia.Docventa) {
      const facturaQuery = `
        SELECT Numero, Tipo, CodClie, Fecha as FechaEmision, Dias, FechaV, Bruto, Descuento, Flete, Subtotal, Igv, Total, Moneda, Cambio, Vendedor, Transporte, Eliminado, Impreso, NroPedido, NroGuia
        FROM Doccab 
        WHERE Numero = @docventa
      `;
      
      const facturaResult = await executeQuery(facturaQuery, { docventa: guia.Docventa });
      
      if (facturaResult.recordset.length > 0) {
        factura = facturaResult.recordset[0];
      }
    }
    
    res.json({
      success: true,
      data: {
        guia,
        factura
      }
    });
    
  } catch (error) {
    console.error('Error al buscar guía:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Endpoint para editar una guía individual
router.post('/editar-individual', async (req, res) => {
  try {
    const { numero, tipo, fecha, campo } = req.body;
    
    console.log('Editando guía individual:', { numero, tipo, fecha, campo });
    
    if (!numero || !tipo || !fecha || !campo) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: numero, tipo, fecha y campo'
      });
    }
    
    let query;
    const params = { fecha, numero };
    
    if (tipo === 'GUIA') {
      query = `UPDATE DoccabGuia SET Fecha = @fecha WHERE Numero = @numero`;
    } else if (tipo === 'FACTURA') {
      query = `UPDATE Doccab SET Fecha = @fecha WHERE Numero = @numero`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Tipo debe ser GUIA o FACTURA'
      });
    }
    
    const result = await executeQuery(query, params);
    
    if (result.rowsAffected[0] > 0) {
      res.json({
        success: true,
        message: `${tipo} ${numero} actualizada correctamente`,
        rowsAffected: result.rowsAffected[0]
      });
    } else {
      res.status(404).json({
        success: false,
        error: `No se encontró la ${tipo.toLowerCase()} ${numero}`
      });
    }
    
  } catch (error) {
    console.error('Error al editar guía individual:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Endpoint para editar por rango
router.post('/editar-rango', async (req, res) => {
  try {
    const { numeroInicio, numeroFin, tipo, fecha, campo } = req.body;
    
    console.log('Editando guías por rango:', { numeroInicio, numeroFin, tipo, fecha, campo });
    
    if (!numeroInicio || !numeroFin || !tipo || !fecha || !campo) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: numeroInicio, numeroFin, tipo, fecha y campo'
      });
    }
    
    let query;
    const params = { fecha, numeroInicio, numeroFin };
    
    // Extraer el prefijo del número inicial para verificar consistencia
    const prefijo = numeroInicio.split('-')[0];
    
    if (tipo === 'GUIA') {
      query = `
        UPDATE DoccabGuia 
        SET Fecha = @fecha 
        WHERE Numero BETWEEN @numeroInicio AND @numeroFin
        AND LEFT(Numero, ${prefijo.length}) = '${prefijo}'
      `;
    } else if (tipo === 'FACTURA') {
      query = `
        UPDATE Doccab 
        SET Fecha = @fecha 
        WHERE Numero BETWEEN @numeroInicio AND @numeroFin
        AND LEFT(Numero, ${prefijo.length}) = '${prefijo}'
      `;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Tipo debe ser GUIA o FACTURA'
      });
    }
    
    const result = await executeQuery(query, params);
    
    res.json({
      success: true,
      message: `${result.rowsAffected[0]} ${tipo.toLowerCase()}s actualizadas en el rango ${numeroInicio} - ${numeroFin}`,
      rowsAffected: result.rowsAffected[0]
    });
    
  } catch (error) {
    console.error('Error al editar por rango:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Endpoint para editar selección múltiple
router.post('/editar-seleccion', async (req, res) => {
  try {
    const { numeros, fecha, campo } = req.body;
    
    console.log('Editando selección múltiple:', { numeros, fecha, campo });
    
    if (!numeros || !Array.isArray(numeros) || numeros.length === 0 || !fecha || !campo) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: numeros (array), fecha y campo'
      });
    }
    
    let totalActualizados = 0;
    const resultados = [];
    
    // Procesar cada número individualmente
    for (const item of numeros) {
      try {
        const { numero, tipo } = item;
        
        if (!numero || !tipo) {
          resultados.push({
            numero: numero || 'N/A',
            tipo: tipo || 'N/A',
            success: false,
            error: 'Datos incompletos'
          });
          continue;
        }
        
        let query;
        const params = { fecha, numero };
        
        if (tipo === 'GUIA') {
          query = `UPDATE DoccabGuia SET Fecha = @fecha WHERE Numero = @numero`;
        } else if (tipo === 'FACTURA') {
          query = `UPDATE Doccab SET Fecha = @fecha WHERE Numero = @numero`;
        } else {
          resultados.push({
            numero,
            tipo,
            success: false,
            error: 'Tipo debe ser GUIA o FACTURA'
          });
          continue;
        }
        
        const result = await executeQuery(query, params);
        
        if (result.rowsAffected[0] > 0) {
          totalActualizados++;
          resultados.push({
            numero,
            tipo,
            success: true,
            message: 'Actualizado correctamente'
          });
        } else {
          resultados.push({
            numero,
            tipo,
            success: false,
            error: 'No se encontró el registro'
          });
        }
        
      } catch (itemError) {
        console.error(`Error al procesar ${item.numero}:`, itemError);
        resultados.push({
          numero: item.numero || 'N/A',
          tipo: item.tipo || 'N/A',
          success: false,
          error: itemError.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `${totalActualizados} de ${numeros.length} registros actualizados correctamente`,
      totalActualizados,
      totalProcesados: numeros.length,
      resultados
    });
    
  } catch (error) {
    console.error('Error al editar selección múltiple:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Endpoint para obtener detalles de una guía específica
router.get('/detalle/:numero/:tipo', async (req, res) => {
  try {
    const { numero, tipo } = req.params;
    
    console.log('Consultando detalle de:', { numero, tipo });
    
    let query;
    const params = { numero };
    
    if (tipo === 'GUIA') {
      query = `SELECT * FROM DoccabGuia WHERE Numero = @numero`;
    } else if (tipo === 'FACTURA') {
      query = `SELECT * FROM Doccab WHERE Numero = @numero`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Tipo debe ser GUIA o FACTURA'
      });
    }
    
    const result = await executeQuery(query, params);
    
    if (result.recordset.length > 0) {
      res.json({
        success: true,
        data: result.recordset[0]
      });
    } else {
      res.status(404).json({
        success: false,
        error: `No se encontró la ${tipo.toLowerCase()} ${numero}`
      });
    }
    
  } catch (error) {
    console.error('Error al consultar detalle:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

module.exports = router; 