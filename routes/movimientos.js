const express = require('express');
const router = express.Router();
const { connectDB } = require('../database');
const sql = require('mssql');

// Consultar movimientos con filtros
router.post('/consultar', async (req, res) => {
  let pool = null;
  
  try {
    const filtros = req.body;
    
    // Conectar a la base de datos
    pool = await connectDB();
    const request = pool.request();
    
    let condiciones = [];
    
    // Construir condiciones de filtro dinámicamente
    if (filtros.banco && filtros.banco.trim() !== '') {
      condiciones.push('Banco = @banco');
      request.input('banco', sql.Int, parseInt(filtros.banco));
    }
    
    if (filtros.fecha && filtros.fecha.trim() !== '') {
      // Formato de fecha: YYYY-MM-DD
      const fecha = new Date(filtros.fecha);
      
      if (!isNaN(fecha.getTime())) {
        condiciones.push('CONVERT(date, Fecha) = @fecha');
        request.input('fecha', sql.Date, fecha);
      }
    }
    
    if (filtros.sucursal && filtros.sucursal.trim() !== '') {
      condiciones.push('Sucursal = @sucursal');
      request.input('sucursal', sql.VarChar, filtros.sucursal);
    }
    
    if (filtros.operacion && filtros.operacion.trim() !== '') {
      condiciones.push('Operacion = @operacion');
      request.input('operacion', sql.VarChar, filtros.operacion);
    }
    
    if (filtros.hora && filtros.hora.trim() !== '') {
      condiciones.push('CONVERT(time, Hora) = @hora');
      request.input('hora', sql.Time, filtros.hora);
    }
    
    if (filtros.vendedor && filtros.vendedor.trim() !== '') {
      condiciones.push('Vendedor = @vendedor');
      request.input('vendedor', sql.VarChar, filtros.vendedor);
    }
    
    if (filtros.procesado !== undefined && filtros.procesado !== null && filtros.procesado.toString().trim() !== '') {
      condiciones.push('Procesado = @procesado');
      request.input('procesado', sql.Bit, parseInt(filtros.procesado));
    }
    
    // Construir la consulta SQL
    let query = 'SELECT TOP 1000 * FROM MovimientoBanco';
    
    if (condiciones.length > 0) {
      query += ' WHERE ' + condiciones.join(' AND ');
    }
    
    // Ordenar por fecha descendente para ver primero los más recientes
    query += ' ORDER BY Fecha DESC, Hora DESC';
    
    console.log('Ejecutando consulta:', query);
    
    // Ejecutar la consulta
    const result = await request.query(query);
    
    // Devolver los resultados
    res.json({
      success: true,
      data: result.recordset,
      totalRegistros: result.recordset.length
    });
    
  } catch (error) {
    console.error('Error al consultar movimientos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al consultar movimientos: ' + error.message 
    });
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (err) {
        console.error('Error al cerrar la conexión a la base de datos:', err);
      }
    }
  }
});

// Eliminar movimientos con filtros
router.post('/eliminar', async (req, res) => {
  let pool = null;
  
  try {
    const filtros = req.body;
    
    // Validar que existan filtros para evitar eliminar toda la tabla
    if (!filtros || Object.keys(filtros).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se permite eliminar registros sin especificar al menos un filtro'
      });
    }
    
    // Conectar a la base de datos
    pool = await connectDB();
    const request = pool.request();
    
    let condiciones = [];
    
    // Construir condiciones de filtro dinámicamente
    if (filtros.banco && filtros.banco.trim() !== '') {
      condiciones.push('Banco = @banco');
      request.input('banco', sql.Int, parseInt(filtros.banco));
    }
    
    if (filtros.fecha && filtros.fecha.trim() !== '') {
      // Formato de fecha: YYYY-MM-DD
      const fecha = new Date(filtros.fecha);
      
      if (!isNaN(fecha.getTime())) {
        condiciones.push('CONVERT(date, Fecha) = @fecha');
        request.input('fecha', sql.Date, fecha);
      }
    }
    
    if (filtros.sucursal && filtros.sucursal.trim() !== '') {
      condiciones.push('Sucursal = @sucursal');
      request.input('sucursal', sql.VarChar, filtros.sucursal);
    }
    
    if (filtros.operacion && filtros.operacion.trim() !== '') {
      condiciones.push('Operacion = @operacion');
      request.input('operacion', sql.VarChar, filtros.operacion);
    }
    
    if (filtros.hora && filtros.hora.trim() !== '') {
      condiciones.push('CONVERT(time, Hora) = @hora');
      request.input('hora', sql.Time, filtros.hora);
    }
    
    if (filtros.vendedor && filtros.vendedor.trim() !== '') {
      condiciones.push('Vendedor = @vendedor');
      request.input('vendedor', sql.VarChar, filtros.vendedor);
    }
    
    if (filtros.procesado !== undefined && filtros.procesado !== null && filtros.procesado.toString().trim() !== '') {
      condiciones.push('Procesado = @procesado');
      request.input('procesado', sql.Bit, parseInt(filtros.procesado));
    }
    
    // Verificar que exista al menos una condición válida
    if (condiciones.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se detectaron filtros válidos para eliminar registros'
      });
    }
    
    // Primero contar cuantos registros serán eliminados
    let countQuery = 'SELECT COUNT(*) AS total FROM MovimientoBanco WHERE ' + condiciones.join(' AND ');
    const countResult = await request.query(countQuery);
    const totalAEliminar = countResult.recordset[0].total;
    
    // Si no hay registros para eliminar, retornar
    if (totalAEliminar === 0) {
      return res.json({
        success: true,
        afectados: 0,
        mensaje: 'No se encontraron registros para eliminar con los filtros especificados'
      });
    }
    
    // Construir la consulta SQL para eliminar
    let deleteQuery = 'DELETE FROM MovimientoBanco WHERE ' + condiciones.join(' AND ');
    
    console.log('Ejecutando eliminación:', deleteQuery);
    
    // Ejecutar la consulta de eliminación
    const deleteResult = await request.query(deleteQuery);
    
    // Devolver los resultados
    res.json({
      success: true,
      afectados: deleteResult.rowsAffected[0],
      mensaje: `Se eliminaron ${deleteResult.rowsAffected[0]} registro(s) correctamente`
    });
    
  } catch (error) {
    console.error('Error al eliminar movimientos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al eliminar movimientos: ' + error.message 
    });
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (err) {
        console.error('Error al cerrar la conexión a la base de datos:', err);
      }
    }
  }
});

module.exports = router; 