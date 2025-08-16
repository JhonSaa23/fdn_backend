const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const sql = require('mssql');

// Consultar productos (similar a la vista de consulta productos)
router.get('/productos', async (req, res) => {
    try {
        const { search, limit = 10 } = req.query;
        
                            let query = `
                        SELECT TOP ${limit}
                            RTRIM(p.Codpro) AS Codpro,
                            RTRIM(p.Nombre) AS Nombre,
                            p.Stock,
                            LEFT(RTRIM(p.Codpro), 2) AS Laboratorio
                        FROM Productos p
                        WHERE p.Eliminado = 0
                    `;
        
        const params = [];
        
                            if (search) {
                        query += ` AND (RTRIM(p.Codpro) LIKE @search OR RTRIM(p.Nombre) LIKE @search)`;
                        params.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
                    }
        
        query += ` ORDER BY p.Nombre`;
        
        const result = await dbService.executeQuery(query, params);
        
        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });
        
    } catch (error) {
        console.error('Error en consultar productos para bot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar productos',
            error: error.message
        });
    }
});

// Consultar producto específico por código
router.get('/productos/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        
                            const query = `
                        SELECT 
                            RTRIM(p.Codpro) AS Codpro,
                            RTRIM(p.Nombre) AS Nombre,
                            p.Stock,
                            LEFT(RTRIM(p.Codpro), 2) AS Laboratorio
                        FROM Productos p
                        WHERE RTRIM(p.Codpro) = @codigo AND p.Eliminado = 0
                    `;
        
        const result = await dbService.executeQuery(query, [
            { name: 'codigo', type: sql.NVarChar, value: codigo }
        ]);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        res.json({
            success: true,
            data: result.recordset[0]
        });
        
    } catch (error) {
        console.error('Error en consultar producto específico:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar producto',
            error: error.message
        });
    }
});

// Consultar stock de producto
router.get('/productos/:codigo/stock', async (req, res) => {
    try {
        const { codigo } = req.params;
        
        const query = `
            SELECT 
                p.Codpro,
                p.Nombre,
                p.Stock,
                s.Almacen,
                s.Lote,
                s.Saldo
            FROM Productos p
            LEFT JOIN Saldos s ON p.Codpro = s.Codpro
            WHERE p.Codpro = @codigo AND p.Eliminado = 0
            ORDER BY s.Almacen, s.Lote
        `;
        
        const result = await dbService.executeQuery(query, [
            { name: 'codigo', type: sql.NVarChar, value: codigo }
        ]);
        
        res.json({
            success: true,
            data: result.recordset
        });
        
    } catch (error) {
        console.error('Error en consultar stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar stock',
            error: error.message
        });
    }
});

// Consultar laboratorios
router.get('/laboratorios', async (req, res) => {
    try {
        const { search, limit = 20 } = req.query;
        
        let query = `SELECT TOP ${limit} CodLab, Descripcion FROM Laboratorios WHERE 1=1`;
        const params = [];
        
        if (search) {
            query += ` AND (CodLab LIKE @search OR Descripcion LIKE @search)`;
            params.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
        }
        
        query += ` ORDER BY Descripcion`;
        
        const result = await dbService.executeQuery(query, params);
        
        res.json({
            success: true,
            data: result.recordset
        });
        
    } catch (error) {
        console.error('Error en consultar laboratorios:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar laboratorios',
            error: error.message
        });
    }
});

// Consultar productos por laboratorio
router.get('/laboratorios/:codlab/productos', async (req, res) => {
    try {
        const { codlab } = req.params;
        const { limit = 20 } = req.query;
        
        const query = `
            SELECT TOP ${limit}
                RTRIM(p.Codpro) AS Codpro,
                RTRIM(p.Nombre) AS Nombre,
                p.Stock,
                LEFT(RTRIM(p.Codpro), 2) AS Laboratorio
            FROM Productos p
            WHERE LEFT(RTRIM(p.Codpro), 2) = @codlab AND p.Eliminado = 0
            ORDER BY p.Nombre
        `;
        
        const result = await dbService.executeQuery(query, [
            { name: 'codlab', type: sql.NVarChar, value: codlab }
        ]);
        
        res.json({
            success: true,
            data: result.recordset
        });
        
    } catch (error) {
        console.error('Error en consultar productos por laboratorio:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar productos por laboratorio',
            error: error.message
        });
    }
});

// Endpoint de salud del bot
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Bot API funcionando correctamente',
        timestamp: new Date().toISOString(),
        endpoints: {
            productos: '/api/bot/productos',
            producto: '/api/bot/productos/:codigo',
            stock: '/api/bot/productos/:codigo/stock',
            laboratorios: '/api/bot/laboratorios',
            productosPorLaboratorio: '/api/bot/laboratorios/:codlab/productos'
        }
    });
});

module.exports = router;
