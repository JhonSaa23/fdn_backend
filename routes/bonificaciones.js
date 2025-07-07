const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');

// GET /bonificaciones/listar?Codproducto=...&Factor=...&CodBoni=...&Cantidad=...
router.get('/listar', async (req, res) => {
  try {
    const { Codproducto, Factor, CodBoni, Cantidad } = req.query;
    let query = `
      SELECT 
        b.Codproducto, 
        b.Factor, 
        b.CodBoni, 
        b.Cantidad,
        p.Stock AS StockProducto,
        p.Nombre AS NombreProducto,
        pb.Stock AS StockBonificacion,
        pb.Nombre AS NombreBonificacion
      FROM Bonificaciones b
      LEFT JOIN Productos p ON b.Codproducto = p.CodPro
      LEFT JOIN Productos pb ON b.CodBoni = pb.CodPro
      WHERE 1=1
    `;
    const params = {};
    if (Codproducto) {
      query += ' AND b.Codproducto LIKE @Codproducto';
      params.Codproducto = `%${Codproducto}%`;
    }
    if (Factor) {
      query += ' AND b.Factor = @Factor';
      params.Factor = Factor;
    }
    if (CodBoni) {
      query += ' AND b.CodBoni LIKE @CodBoni';
      params.CodBoni = `%${CodBoni}%`;
    }
    if (Cantidad) {
      query += ' AND b.Cantidad = @Cantidad';
      params.Cantidad = Cantidad;
    }
    query += ' ORDER BY b.Codproducto';
    const result = await executeQuery(query, params);
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 