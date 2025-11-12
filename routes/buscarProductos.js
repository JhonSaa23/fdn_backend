const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const sql = require('mssql');

// Endpoint para buscar productos por nombre, lote y código de barras
router.get('/buscar', async (req, res) => {
  try {
    const { q } = req.query; // Query parameter para la búsqueda
    const busquedaLimpia = q ? q.trim() : '';
    
    // Validar que la búsqueda tenga al menos 1 carácter
    if (!busquedaLimpia || busquedaLimpia.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'La búsqueda no puede estar vacía'
      });
    }
    
    // Si tiene menos de 3 caracteres, solo permitir si es un código numérico (código de barras)
    if (busquedaLimpia.length < 3 && !/^\d+$/.test(busquedaLimpia)) {
      return res.json({
        success: true,
        data: [],
        message: 'La búsqueda debe tener al menos 3 caracteres o ser un código numérico'
      });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('Busqueda', sql.VarChar(255), q.trim())
      .execute('sp_BuscarProductos');
    
    // Mapear los nombres de almacenes
    const almacenes = {
      1: 'Farmacos',
      2: 'Moche JPS',
      3: 'Canjes',
      4: 'Primavera',
      5: 'Moche Maribel'
    };
    
    // Agrupar resultados por producto
    const productosMap = new Map();
    
    result.recordset.forEach(row => {
      const codpro = row.codpro;
      
      if (!productosMap.has(codpro)) {
        productosMap.set(codpro, {
          codpro: codpro,
          CodBar: row.CodBar || null,
          Nombre: row.Nombre || '',
          saldos: []
        });
      }
      
      // Agregar saldo si existe (no es NULL) y es mayor a 0
      if (row.almacen != null && row.saldo != null && row.saldo > 0) {
        const producto = productosMap.get(codpro);
        
        // Crear clave única para el saldo
        const loteKey = (row.lote || '').trim();
        const vencimientoKey = row.vencimiento ? new Date(row.vencimiento).toISOString() : '';
        const saldoKey = `${row.almacen}-${loteKey}-${vencimientoKey}`;
        
        // Evitar duplicados usando un Set
        if (!producto.saldosSet) {
          producto.saldosSet = new Set();
        }
        
        if (!producto.saldosSet.has(saldoKey)) {
          producto.saldosSet.add(saldoKey);
          producto.saldos.push({
            almacen: row.almacen,
            nombreAlmacen: almacenes[row.almacen] || `Almacén ${row.almacen}`,
            lote: row.lote || null,
            vencimiento: row.vencimiento || null,
            saldo: row.saldo
          });
        }
      }
    });
    
    // Convertir el Map a un array y limpiar los Sets
    const productos = Array.from(productosMap.values()).map(producto => {
      // Eliminar el Set temporal antes de devolver
      delete producto.saldosSet;
      return producto;
    });
    
    res.json({
      success: true,
      data: productos,
      count: productos.length
    });
  } catch (error) {
    console.error('Error buscando productos:', error);
    res.status(500).json({
      success: false,
      message: 'Error buscando productos',
      error: error.message
    });
  }
});

module.exports = router;

