const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');

// Ruta para listar todas las bonificaciones
router.get('/listar', async (req, res) => {
    try {
        const query = `
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
        `;
        const result = await executeQuery(query);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error al obtener bonificaciones:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Nueva ruta para filtrar por código de laboratorio
router.get('/por-laboratorio/:codlab', async (req, res) => {
    try {
        const { codlab } = req.params;
        const query = `
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
            WHERE LEFT(b.Codproducto, 2) = @codlab
        `;
        const result = await executeQuery(query, { codlab });
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error al filtrar por laboratorio:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router; 