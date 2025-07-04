const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');

// GET /bonificaciones/listar?Codproducto=...&Factor=...&CodBoni=...&Cantidad=...
router.get('/listar', async (req, res) => {
  try {
    const { Codproducto, Factor, CodBoni, Cantidad } = req.query;
    let query = 'SELECT Codproducto, Factor, CodBoni, Cantidad FROM Bonificaciones WHERE 1=1';
    const params = {};
    if (Codproducto) {
      query += ' AND Codproducto LIKE @Codproducto';
      params.Codproducto = `%${Codproducto}%`;
    }
    if (Factor) {
      query += ' AND Factor = @Factor';
      params.Factor = Factor;
    }
    if (CodBoni) {
      query += ' AND CodBoni LIKE @CodBoni';
      params.CodBoni = `%${CodBoni}%`;
    }
    if (Cantidad) {
      query += ' AND Cantidad = @Cantidad';
      params.Cantidad = Cantidad;
    }
    query += ' ORDER BY Codproducto';
    const result = await executeQuery(query, params);
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 