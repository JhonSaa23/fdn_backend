const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');

// Ruta para listar todas las bonificaciones
router.get('/listar', async (req, res) => {
    try {
        const query = `
            WITH StockAlmacen1 AS (
                SELECT
                    LTRIM(RTRIM(codpro)) AS CodPro,
                    SUM(saldo) AS Stock
                FROM Saldos
                WHERE almacen = '1'
                GROUP BY
                    LTRIM(RTRIM(codpro))
            )
            SELECT
                b.Codproducto,
                b.Factor,
                b.CodBoni,
                b.Cantidad,
                COALESCE(s.Stock, 0)      AS StockProducto,
                p.Nombre                  AS NombreProducto,
                COALESCE(sb.Stock, 0)     AS StockBonificacion,
                pb.Nombre                 AS NombreBonificacion,

                -- 1) Paquetes completos que puedes armar
                CAST(COALESCE(s.Stock, 0) AS INT) / CAST(b.Factor AS INT)
                  AS Paquetes,

                -- 2) Cuántos productos de regalo debes comprar para agotar tu stock normal
                CASE
                  WHEN
                    (CAST(COALESCE(s.Stock, 0) AS INT) / CAST(b.Factor AS INT)) * b.Cantidad
                    > CAST(COALESCE(sb.Stock, 0) AS INT)
                  THEN
                    (CAST(COALESCE(s.Stock, 0) AS INT) / CAST(b.Factor AS INT)) * b.Cantidad
                    - CAST(COALESCE(sb.Stock, 0) AS INT)
                  ELSE 0
                END
                  AS BonosAComprar

            FROM Bonificaciones b
            LEFT JOIN StockAlmacen1 s ON b.Codproducto = s.CodPro
            LEFT JOIN StockAlmacen1 sb ON b.CodBoni = sb.CodPro
            LEFT JOIN Productos p ON b.Codproducto = p.CodPro
            LEFT JOIN Productos pb ON b.CodBoni = pb.CodPro;
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
            WITH StockAlmacen1 AS (
                SELECT
                    LTRIM(RTRIM(codpro)) AS CodPro,
                    SUM(saldo) AS Stock
                FROM Saldos
                WHERE almacen = '1'
                GROUP BY
                    LTRIM(RTRIM(codpro))
            )
            SELECT
                b.Codproducto,
                b.Factor,
                b.CodBoni,
                b.Cantidad,
                COALESCE(s.Stock, 0)      AS StockProducto,
                p.Nombre                  AS NombreProducto,
                COALESCE(sb.Stock, 0)     AS StockBonificacion,
                pb.Nombre                 AS NombreBonificacion,

                -- 1) Paquetes completos que puedes armar
                CAST(COALESCE(s.Stock, 0) AS INT) / CAST(b.Factor AS INT)
                  AS Paquetes,

                -- 2) Cuántos productos de regalo debes comprar para agotar tu stock normal
                CASE
                  WHEN
                    (CAST(COALESCE(s.Stock, 0) AS INT) / CAST(b.Factor AS INT)) * b.Cantidad
                    > CAST(COALESCE(sb.Stock, 0) AS INT)
                  THEN
                    (CAST(COALESCE(s.Stock, 0) AS INT) / CAST(b.Factor AS INT)) * b.Cantidad
                    - CAST(COALESCE(sb.Stock, 0) AS INT)
                  ELSE 0
                END
                  AS BonosAComprar

            FROM Bonificaciones b
            LEFT JOIN StockAlmacen1 s ON b.Codproducto = s.CodPro
            LEFT JOIN StockAlmacen1 sb ON b.CodBoni = sb.CodPro
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