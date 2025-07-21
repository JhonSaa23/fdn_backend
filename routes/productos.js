const express = require('express');
const router = express.Router();
const { sql, getConnection } = require('../database');

// Endpoint para consultar productos por código(s)
router.get('/consulta/:codigos', async (req, res) => {
    try {
        const codigos = req.params.codigos.split(',').map(cod => cod.trim());
        const pool = await getConnection();
        
        let resultados = [];

        for (const codigo of codigos) {
            // Obtener información del producto
            const productoResult = await pool.request()
                .input('codpro', sql.VarChar, codigo)
                .query('SELECT CodPro, Nombre FROM productos WHERE CodPro = @codpro');

            if (productoResult.recordset.length > 0) {
                const producto = productoResult.recordset[0];

                // Obtener saldos del producto (solo saldos >= 1)
                const saldosResult = await pool.request()
                    .input('codpro', sql.VarChar, codigo)
                    .query('SELECT almacen, lote, vencimiento, saldo FROM saldos WHERE codpro = @codpro AND saldo >= 1');

                // Mapear los nombres de almacenes
                const almacenes = {
                    1: 'Farmacos',
                    2: 'Moche JPS',
                    3: 'Canjes',
                    4: 'Primavera',
                    5: 'Moche Maribel'
                };

                const saldos = saldosResult.recordset.map(saldo => ({
                    numeroAlmacen: saldo.almacen,
                    nombreAlmacen: almacenes[saldo.almacen] || `Almacén ${saldo.almacen}`,
                    saldo: saldo.saldo,
                    lote: saldo.lote?.trim(),
                    vencimiento: saldo.vencimiento
                }));

                resultados.push({
                    producto,
                    saldos
                });
            }
        }

        if (resultados.length === 0) {
            return res.status(404).json({ message: 'No se encontraron productos' });
        }

        res.json(resultados);

    } catch (error) {
        console.error('Error al consultar productos:', error);
        res.status(500).json({ message: 'Error al consultar productos', error: error.message });
    }
});

// Endpoint para verificar saldos de productos
router.post('/verificar-saldos', async (req, res) => {
    try {
        const { cod, lote, alma } = req.body;
        const pool = await getConnection();
        
        // Ejecutar el stored procedure para verificar saldos
        const result = await pool.request()
            .input('cod', sql.VarChar, cod)
            .input('lote', sql.VarChar, lote)
            .input('alma', sql.Int, alma)
            .execute('sp_productos_buscaSaldosX');
        
        res.json({ 
            success: true, 
            data: result.recordset,
            message: 'Saldos verificados correctamente'
        });
        
    } catch (error) {
        console.error('Error al verificar saldos:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar saldos', 
            error: error.message 
        });
    }
});

module.exports = router; 