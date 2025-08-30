const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const sql = require('mssql');

// Consultar productos (similar a la vista de consulta productos)
router.get('/productos', async (req, res) => {
    try {
        const { search, limit = 10 } = req.query;
        
        console.log('🔍 Búsqueda de productos:', { search, limit });
        
        let query = `
            SELECT TOP ${limit}
                RTRIM(p.CodPro) AS CodPro,
                LTRIM(RTRIM(p.Nombre)) AS Nombre,
                p.Peso,
                p.Stock
            FROM Productos p
            WHERE p.Eliminado = 0
        `;
        
        const params = [];
        
        if (search) {
            // Verificar si la búsqueda parece ser un código (solo números)
            const isCodeSearch = /^\d+$/.test(search.trim());
            console.log('🔍 Tipo de búsqueda:', { search: search.trim(), isCodeSearch });
            
            if (isCodeSearch) {
                // Búsqueda por código: exacta (manejando espacios)
                query += ` AND RTRIM(p.CodPro) = @search`;
                params.push({ name: 'search', type: sql.NVarChar, value: search.trim() });
                console.log('🔍 Búsqueda por código exacto:', search.trim());
            } else {
                // Búsqueda por nombre: LIKE con comodines
                query += ` AND LTRIM(RTRIM(p.Nombre)) LIKE @search`;
                params.push({ name: 'search', type: sql.NVarChar, value: `%${search.trim()}%` });
                console.log('🔍 Búsqueda por nombre:', `%${search.trim()}%`);
            }
        }
        
        query += ` ORDER BY p.Nombre`;
        
        console.log('🔍 Query final:', query);
        console.log('🔍 Parámetros:', params);
        
        const result = await dbService.executeQuery(query, params);
        
        console.log('🔍 Resultados encontrados:', result.recordset.length);
        if (result.recordset.length > 0) {
            console.log('🔍 Primer resultado:', result.recordset[0]);
        }
        
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
                RTRIM(p.Codpro) AS Codpro,
                RTRIM(p.Nombre) AS Nombre,
                p.Stock,
                s.Almacen,
                RTRIM(s.Lote) AS Lote,
                s.Vencimiento,
                s.Saldo
            FROM Productos p
            INNER JOIN Saldos s ON p.Codpro = s.Codpro
            WHERE p.Codpro = @codigo AND p.Eliminado = 0 AND s.Saldo > 0
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
        
        let query = `SELECT TOP ${limit} RTRIM(CodLab) AS CodLab, Descripcion FROM Laboratorios WHERE 1=1`;
        const params = [];
        
        if (search) {
            query += ` AND (RTRIM(CodLab) LIKE @search OR Descripcion LIKE @search)`;
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
                RTRIM(p.CodPro) AS CodPro,
                LTRIM(RTRIM(p.Nombre)) AS Nombre,
                p.Peso,
                p.Stock
            FROM Productos p
            WHERE LEFT(RTRIM(p.CodPro), 2) = @codlab AND p.Eliminado = 0
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

// Consultar pedidos por representante
router.get('/pedidos/representante/:codigoRepresentante', async (req, res) => {
    try {
        const { codigoRepresentante } = req.params;
        
        const query = `
            SELECT TOP 5
                RTRIM(p.Numero) AS Numero,
                p.Fecha,
                p.Representante AS CodigoRepresentante,
                c.Razon AS NombreCliente,
                p.Tipo,
                CASE 
                    WHEN p.Tipo = 5 THEN 'Pedido'
                    WHEN p.Tipo = 1 THEN 'Factura'
                    WHEN p.Tipo = 2 THEN 'Boleta'
                    ELSE 'Otro'
                END AS TipoDescripcion,
                p.Estado,
                CASE 
                    WHEN p.Estado = 1 THEN 'Pendiente'
                    WHEN p.Estado = 2 THEN 'En Proceso'
                    WHEN p.Estado = 3 THEN 'Aprobado'
                    WHEN p.Estado = 4 THEN 'Rechazado'
                    WHEN p.Estado = 5 THEN 'Enviado'
                    WHEN p.Estado = 6 THEN 'Entregado'
                    WHEN p.Estado = 7 THEN 'Cancelado'
                    WHEN p.Estado = 8 THEN 'Facturado'
                    ELSE 'Desconocido'
                END AS EstadoDescripcion,
                p.Total
            FROM Doccabped p
            LEFT JOIN Clientes c ON p.CodClie = c.Codclie
            WHERE p.Representante = @codigoRepresentante AND p.Eliminado = 0
            ORDER BY p.Fecha DESC
        `;
        
        const result = await dbService.executeQuery(query, [
            { name: 'codigoRepresentante', type: sql.Int, value: parseInt(codigoRepresentante) }
        ]);
        
        res.json({
            success: true,
            data: result.recordset
        });
        
    } catch (error) {
        console.error('Error en consultar pedidos por representante:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar pedidos',
            error: error.message
        });
    }
});

// Consultar pedidos de un representante por su coduserbot
router.get('/pedidos-representante/:coduserbot', async (req, res) => {
    try {
        const { coduserbot } = req.params;
        
        const query = `
            SELECT TOP 5
                RTRIM(p.Numero) AS Numero,
                p.Fecha,
                p.Representante AS CodigoRepresentante,
                c.Razon AS NombreCliente,
                p.Tipo,
                CASE 
                    WHEN p.Tipo = 5 THEN 'Pedido'
                    WHEN p.Tipo = 1 THEN 'Factura'
                    WHEN p.Tipo = 2 THEN 'Boleta'
                    ELSE 'Otro'
                END AS TipoDescripcion,
                p.Estado,
                CASE 
                    WHEN p.Estado = 1 THEN 'Pendiente'
                    WHEN p.Estado = 2 THEN 'En Proceso'
                    WHEN p.Estado = 3 THEN 'Aprobado'
                    WHEN p.Estado = 4 THEN 'Rechazado'
                    WHEN p.Estado = 5 THEN 'Enviado'
                    WHEN p.Estado = 6 THEN 'Entregado'
                    WHEN p.Estado = 7 THEN 'Cancelado'
                    WHEN p.Estado = 8 THEN 'Facturado'
                    ELSE 'Desconocido'
                END AS EstadoDescripcion,
                p.Total
            FROM Doccabped p
            LEFT JOIN Clientes c ON p.CodClie = c.Codclie
            WHERE p.Representante = @coduserbot AND p.Eliminado = 0
            ORDER BY p.Fecha DESC
        `;
        
        const result = await dbService.executeQuery(query, [
            { name: 'coduserbot', type: sql.VarChar, value: coduserbot }
        ]);
        
        res.json({
            success: true,
            data: result.recordset
        });
        
    } catch (error) {
        console.error('Error en consultar pedidos por coduserbot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar pedidos',
            error: error.message
        });
    }
});

// Consultar productos de un pedido específico
router.get('/pedidos/:numeroPedido/productos', async (req, res) => {
    try {
        const { numeroPedido } = req.params;
        
        const query = `
            SELECT 
                RTRIM(dp.Codpro) AS CodigoProducto,
                p.Nombre AS NombreProducto,
                dp.Cantidad AS Cantidad,
                dp.Precio AS PrecioUnitario,
                (dp.Cantidad * dp.Precio) AS Subtotal
            FROM Docdetped dp
            LEFT JOIN Productos p ON dp.Codpro = p.CodPro
            WHERE RTRIM(dp.Numero) = @numeroPedido
            ORDER BY dp.Codpro
        `;
        
        const result = await dbService.executeQuery(query, [
            { name: 'numeroPedido', type: sql.VarChar, value: numeroPedido }
        ]);
        
        res.json({
            success: true,
            data: result.recordset
        });
        
    } catch (error) {
        console.error('Error en consultar productos del pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar productos del pedido',
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
            productosPorLaboratorio: '/api/bot/laboratorios/:codlab/productos',
            pedidosPorRepresentante: '/api/bot/pedidos/representante/:codigoRepresentante',
            productosDePedido: '/api/bot/pedidos/:numeroPedido/productos'
        }
    });
});

module.exports = router;
