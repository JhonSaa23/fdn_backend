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

// Endpoint para obtener laboratorios para productos
router.get('/laboratorios', async (req, res) => {
    try {
        const pool = await getConnection();
        
        console.log('🔍 Ejecutando sp_Laboratorios_listar');
        
        // Ejecutar el stored procedure para listar laboratorios
        const result = await pool.request()
            .execute('sp_Laboratorios_listar');
        
        console.log('✅ Laboratorios obtenidos:', result.recordset.length);
        
        res.json({ 
            success: true, 
            data: result.recordset,
            message: 'Laboratorios cargados correctamente'
        });
        
    } catch (error) {
        console.error('❌ Error al cargar laboratorios:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al cargar laboratorios', 
            error: error.message 
        });
    }
});

// Endpoint para obtener productos por laboratorio
router.get('/laboratorio/:codlab', async (req, res) => {
    try {
        const { codlab } = req.params;
        const pool = await getConnection();
        
        // Asegurar que el codlab tenga el formato correcto con espacios (ej: '00  ')
        const formattedCodlab = codlab.trim().padEnd(4, ' ');
        console.log('🔍 Ejecutando sp_produmal_canje con codlab:', `'${formattedCodlab}'`);
        
        // Ejecutar el stored procedure para obtener productos del laboratorio
        console.log('🔍 Ejecutando sp_produmal_canje con labo:', `'${formattedCodlab}'`);
        
        const result = await pool.request()
            .input('labo', sql.VarChar, formattedCodlab)
            .execute('sp_produmal_canje');
        
        console.log('✅ Productos obtenidos:', result.recordset.length);
        
        // Mostrar los primeros 3 productos para debug
        if (result.recordset.length > 0) {
            console.log('📋 Primeros productos:', result.recordset.slice(0, 3).map(p => ({
                codpro: p.codpro,
                nombre: p.nombre,
                lote: p.lote,
                vencimiento: p.vencimiento,
                unidades: p.unidades,
                Fecha: p.Fecha
            })));
        }
        
        res.json({ 
            success: true, 
            data: result.recordset,
            message: 'Productos cargados correctamente'
        });
        
    } catch (error) {
        console.error('❌ Error al cargar productos del laboratorio:', error);
        console.error('❌ Error details:', {
            message: error.message,
            code: error.code,
            state: error.state,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false, 
            message: 'Error al cargar productos del laboratorio', 
            error: error.message 
        });
    }
});



module.exports = router; 