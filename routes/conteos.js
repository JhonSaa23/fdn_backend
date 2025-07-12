const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');

/**
 * POST /guardar
 * Guarda o actualiza un conteo físico
 */
router.post('/guardar', async (req, res) => {
  try {
    const { codpro, lote, almacen, vencimiento, fisico, saldoSistema, observaciones } = req.body;

    // Validaciones básicas
    if (!codpro || !almacen || fisico == null) {
      return res.status(400).json({
        error: 'Datos incompletos',
        details: 'Los campos codpro, almacen y fisico son obligatorios'
      });
    }

    // Validar que fisico sea un número
    const fisicoNum = parseFloat(fisico);
    const saldoSistemaNum = parseFloat(saldoSistema || 0);
    
    if (isNaN(fisicoNum)) {
      return res.status(400).json({
        error: 'Valor inválido',
        details: 'El campo fisico debe ser un número válido'
      });
    }

    // Preparar fecha de vencimiento
    let vencimientoDate = null;
    if (vencimiento && vencimiento !== '') {
      vencimientoDate = new Date(vencimiento);
      if (isNaN(vencimientoDate.getTime())) {
        return res.status(400).json({
          error: 'Fecha inválida',
          details: 'El formato de fecha de vencimiento no es válido'
        });
      }
    }

    // Ejecutar el procedimiento almacenado
    const query = `
      EXEC sp_UpsertConteoFisico
        @CodPro = @codpro,
        @Lote = @lote,
        @Almacen = @almacen,
        @Vencimiento = @vencimiento,
        @Fisico = @fisico,
        @SaldoSistema = @saldoSistema,
        @Observaciones = @observaciones
    `;

    await executeQuery(query, {
      codpro: codpro.toString().trim(),
      lote: lote || null,
      almacen: almacen.toString().trim(),
      vencimiento: vencimientoDate,
      fisico: fisicoNum,
      saldoSistema: saldoSistemaNum,
      observaciones: observaciones || null
    });

    // Obtener el registro actualizado para devolverlo
    const selectQuery = `
      SELECT 
        CodPro,
        Lote,
        Almacen,
        Vencimiento,
        Fisico,
        SaldoSistema,
        (Fisico - SaldoSistema) AS Diferencia,
        CASE 
          WHEN (Fisico - SaldoSistema) = 0 THEN 'CUADRADO'
          WHEN (Fisico - SaldoSistema) > 0 THEN 'SOBRANTE'
          WHEN (Fisico - SaldoSistema) < 0 THEN 'FALTANTE'
        END AS TipoDiferencia,
        Observaciones,
        FechaActualizacion
      FROM ConteosFisicos
      WHERE CodPro = @codpro 
        AND Almacen = @almacen
        AND Lote = @lote
        AND Vencimiento = @vencimiento
    `;

    const result = await executeQuery(selectQuery, {
      codpro: codpro.toString().trim(),
      lote: lote || '',
      almacen: almacen.toString().trim(),
      vencimiento: vencimientoDate || '1900-01-01'
    });

    res.json({
      success: true,
      message: 'Conteo físico guardado exitosamente',
      data: result.recordset[0] || null
    });

  } catch (error) {
    console.error('Error al guardar conteo físico:', error);
    res.status(500).json({
      error: 'Error al guardar conteo físico',
      details: error.message
    });
  }
});

/**
 * GET /obtener
 * Obtiene conteos físicos por filtros
 */
router.get('/obtener', async (req, res) => {
  try {
    const { codpro, almacen, estado = 'ACTIVO' } = req.query;

    const query = `
      SELECT 
        CodPro,
        Lote,
        Almacen,
        Vencimiento,
        Fisico,
        SaldoSistema,
        (Fisico - SaldoSistema) AS Diferencia,
        CASE 
          WHEN (Fisico - SaldoSistema) = 0 THEN 'CUADRADO'
          WHEN (Fisico - SaldoSistema) > 0 THEN 'SOBRANTE'
          WHEN (Fisico - SaldoSistema) < 0 THEN 'FALTANTE'
        END AS TipoDiferencia,
        ABS(Fisico - SaldoSistema) AS DiferenciaAbsoluta,
        Observaciones,
        Estado,
        FechaCreacion,
        FechaActualizacion
      FROM ConteosFisicos
      WHERE (@codpro IS NULL OR CodPro = @codpro)
        AND (@almacen IS NULL OR Almacen = @almacen)
        AND Estado = @estado
      ORDER BY CodPro, Almacen, Lote, Vencimiento
    `;

    const result = await executeQuery(query, {
      codpro: codpro || null,
      almacen: almacen || null,
      estado: estado
    });

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (error) {
    console.error('Error al obtener conteos físicos:', error);
    res.status(500).json({
      error: 'Error al obtener conteos físicos',
      details: error.message
    });
  }
});

/**
 * GET /obtener-por-producto/:codpro
 * Obtiene todos los conteos de un producto específico
 */
router.get('/obtener-por-producto/:codpro', async (req, res) => {
  try {
    const { codpro } = req.params;

    if (!codpro) {
      return res.status(400).json({
        error: 'Código de producto requerido',
        details: 'Debe proporcionar un código de producto válido'
      });
    }

    const query = `
      SELECT 
        CodPro,
        Lote,
        Almacen,
        Vencimiento,
        Fisico,
        SaldoSistema,
        (Fisico - SaldoSistema) AS Diferencia,
        CASE 
          WHEN (Fisico - SaldoSistema) = 0 THEN 'CUADRADO'
          WHEN (Fisico - SaldoSistema) > 0 THEN 'SOBRANTE'
          WHEN (Fisico - SaldoSistema) < 0 THEN 'FALTANTE'
        END AS TipoDiferencia,
        ABS(Fisico - SaldoSistema) AS DiferenciaAbsoluta,
        Observaciones,
        Estado,
        FechaCreacion,
        FechaActualizacion
      FROM ConteosFisicos
      WHERE CodPro = @codpro
      ORDER BY Almacen, Lote, Vencimiento
    `;

    const result = await executeQuery(query, {
      codpro: codpro.toString().trim()
    });

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (error) {
    console.error('Error al obtener conteos por producto:', error);
    res.status(500).json({
      error: 'Error al obtener conteos por producto',
      details: error.message
    });
  }
});

/**
 * DELETE /eliminar
 * Elimina un conteo físico (marcándolo como INACTIVO)
 */
router.delete('/eliminar', async (req, res) => {
  try {
    const { codpro, lote, almacen, vencimiento } = req.body;

    if (!codpro || !almacen) {
      return res.status(400).json({
        error: 'Datos incompletos',
        details: 'Los campos codpro y almacen son obligatorios'
      });
    }

    // Preparar fecha de vencimiento
    let vencimientoDate = null;
    if (vencimiento && vencimiento !== '') {
      vencimientoDate = new Date(vencimiento);
      if (isNaN(vencimientoDate.getTime())) {
        return res.status(400).json({
          error: 'Fecha inválida',
          details: 'El formato de fecha de vencimiento no es válido'
        });
      }
    }

    const query = `
      UPDATE ConteosFisicos 
      SET 
        Estado = 'INACTIVO',
        FechaActualizacion = GETDATE(),
        UsuarioActualizacion = SYSTEM_USER
      WHERE CodPro = @codpro 
        AND Almacen = @almacen
        AND ISNULL(Lote, '') = ISNULL(@lote, '')
        AND ISNULL(Vencimiento, '1900-01-01') = ISNULL(@vencimiento, '1900-01-01')
    `;

    const result = await executeQuery(query, {
      codpro: codpro.toString().trim(),
      lote: lote || '',
      almacen: almacen.toString().trim(),
      vencimiento: vencimientoDate || '1900-01-01'
    });

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        error: 'Conteo no encontrado',
        details: 'No se encontró el conteo físico especificado'
      });
    }

    res.json({
      success: true,
      message: 'Conteo físico eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar conteo físico:', error);
    res.status(500).json({
      error: 'Error al eliminar conteo físico',
      details: error.message
    });
  }
});

/**
 * GET /reporte
 * Genera reporte de diferencias para exportar a Excel
 */
router.get('/reporte', async (req, res) => {
  try {
    const { almacen, tipoDiferencia, fechaDesde, fechaHasta } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = {};

    if (almacen) {
      whereClause += ' AND Almacen = @almacen';
      params.almacen = almacen;
    }

    if (tipoDiferencia && tipoDiferencia !== 'TODOS') {
      whereClause += ' AND TipoDiferencia = @tipoDiferencia';
      params.tipoDiferencia = tipoDiferencia;
    }

    if (fechaDesde) {
      whereClause += ' AND CONVERT(date, FechaActualizacion) >= @fechaDesde';
      params.fechaDesde = fechaDesde;
    }

    if (fechaHasta) {
      whereClause += ' AND CONVERT(date, FechaActualizacion) <= @fechaHasta';
      params.fechaHasta = fechaHasta;
    }

    const query = `
      SELECT 
        CodPro AS 'Código Producto',
        Lote,
        Almacen AS 'Almacén',
        FORMAT(Vencimiento, 'dd/MM/yyyy') AS 'Vencimiento',
        Fisico AS 'Físico',
        SaldoSistema AS 'Saldo Sistema',
        Diferencia,
        TipoDiferencia AS 'Tipo Diferencia',
        DiferenciaAbsoluta AS 'Diferencia Absoluta',
        Observaciones,
        FORMAT(FechaActualizacion, 'dd/MM/yyyy HH:mm') AS 'Fecha Actualización'
      FROM vw_ConteosFisicosConDiferencias
      ${whereClause}
      ORDER BY Almacen, CodPro, Lote, Vencimiento
    `;

    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.recordset,
      resumen: {
        totalRegistros: result.recordset.length,
        sobrantes: result.recordset.filter(r => r['Tipo Diferencia'] === 'SOBRANTE').length,
        faltantes: result.recordset.filter(r => r['Tipo Diferencia'] === 'FALTANTE').length,
        cuadrados: result.recordset.filter(r => r['Tipo Diferencia'] === 'CUADRADO').length
      }
    });

  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({
      error: 'Error al generar reporte',
      details: error.message
    });
  }
});

module.exports = router; 