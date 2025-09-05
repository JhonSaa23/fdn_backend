const dbService = require('../services/dbService');
const sql = require('mssql');

// BOTON BUSCAR (Listar Guías de Canje)
exports.listarGuiasCanje = async (req, res) => {
    try {
        const result = await dbService.executeQuery(
            `SELECT 
                gc.NroGuia,
                gc.Fecha,
                gc.Proveedor,
                p.Razon
            FROM 
                GuiasCanje AS gc
            INNER JOIN 
                Proveedores AS p
              ON p.CodProv = gc.Proveedor
            WHERE
                gc.Eliminado = 0
                AND LEFT(gc.NroGuia, 4) = 'FF01'
                AND MONTH(gc.Fecha) > 5
                AND YEAR(gc.Fecha) = 2025
            ORDER BY
                gc.NroGuia DESC
                `
        );
        res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error en listarGuiasCanje:', error);
        res.status(500).json({ success: false, message: 'Error al listar guías de canje', error: error.message });
    }
};

// SELECCIONAR FF01 (Cargar Guía Seleccionada - Resumen)
exports.obtenerGuiaCanjeResumen = async (req, res) => {
    const { nroGuia } = req.params;
    try {
        const result = await dbService.executeQuery(
            `SELECT GuiasCanje.NroGuia, GuiasCanje.Fecha, GuiasCanje.Proveedor, Proveedores.Razon FROM GuiasCanje INNER JOIN Proveedores ON Codprov=Proveedor WHERE NroGuia LIKE @nroGuia + '%' AND GuiasCanje.Eliminado=0`,
            [{ name: 'nroGuia', type: sql.NVarChar, value: nroGuia.trim() }]
        );
        res.status(200).json({ success: true, data: result.recordset[0] || null });
    } catch (error) {
        console.error('Error en obtenerGuiaCanjeResumen:', error);
        res.status(500).json({ success: false, message: 'Error al obtener resumen de guía de canje', error: error.message });
    }
};

// CONTENIDO DE CABECERA (Detalles Completos de Cabecera)
exports.obtenerCabeceraGuiaCanje = async (req, res) => {
    const { nroGuia } = req.params;
    try {
        const result = await dbService.executeQuery(
            `SELECT 
                gc.*, 
                pl.laboratorio,
                p.Razon as ProveedorNombre
            FROM GuiasCanje gc 
            INNER JOIN provlab pl ON pl.proveedor = gc.Proveedor 
            INNER JOIN Proveedores p ON p.CodProv = gc.Proveedor
            WHERE gc.NroGuia = @nroGuia`,
            [{ name: 'nroGuia', type: sql.NVarChar, value: nroGuia.trim() }]
        );
        res.status(200).json({ success: true, data: result.recordset[0] || null });
    } catch (error) {
        console.error('Error en obtenerCabeceraGuiaCanje:', error);
        res.status(500).json({ success: false, message: 'Error al obtener cabecera de guía de canje', error: error.message });
    }
};

// BOTON DETALLE (Detalles de la Guía de Canje)
exports.obtenerDetallesGuiaCanje = async (req, res) => {
    const { nroGuia } = req.params;
    try {
        const result = await dbService.executeQuery(
            `SELECT dbo.DetaguiaCanje.NroGuia, dbo.DetaguiaCanje.codpro, dbo.Productos.Nombre as Producto, dbo.DetaguiaCanje.lote, dbo.DetaguiaCanje.Vencimiento, dbo.DetaguiaCanje.Cantidad, dbo.DetaguiaCanje.GuiaDevo FROM dbo.DetaguiaCanje INNER JOIN dbo.Productos ON dbo.DetaguiaCanje.codpro = dbo.Productos.Codpro WHERE dbo.DetaguiaCanje.NroGuia=@nroGuia`,
            [{ name: 'nroGuia', type: sql.NVarChar, value: nroGuia.trim() }]
        );
        res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error en obtenerDetallesGuiaCanje:', error);
        res.status(500).json({ success: false, message: 'Error al obtener detalles de guía de canje', error: error.message });
    }
};

// INSERTAR (Registro Completo de Devolución por Canje)
exports.registrarGuiaCanje = async (req, res) => {
    const { cabecera, detalles } = req.body;
    let transaction;
    
    try {
        // Iniciar transacción
        transaction = await dbService.beginTransaction();

        // 1. Insertar Cabecera
        const cabeceraParams = [
            { name: 'docu', type: sql.NVarChar, value: cabecera.NroGuia },
            { name: 'feca', type: sql.DateTime, value: new Date(cabecera.Fecha) },
            { name: 'Prov', type: sql.NVarChar, value: cabecera.Proveedor },
            { name: 'empresa', type: sql.NVarChar, value: cabecera.EmpTrans },
            { name: 'ruc', type: sql.NVarChar, value: cabecera.RucTrans },
            { name: 'placa', type: sql.NVarChar, value: cabecera.Placa },
            { name: 'punto', type: sql.NVarChar, value: cabecera.PtoLlegada },
            { name: 'destino', type: sql.NVarChar, value: cabecera.Destinatario }
        ];
        
        await dbService.executeProcedureInTransaction(transaction, 'sp_GuiasCanje_Insertar', cabeceraParams);
        const NroGuiaGenerado = cabecera.NroGuia;

        // 2. Insertar Detalles y Descontar Inventario
        console.log('🔄 Iniciando inserción de detalles y descuento de inventario...');
        console.log('📋 Total de detalles a procesar:', detalles.length);
        
        for (const detalle of detalles) {
            // Validar y convertir la cantidad a número
            const cantidadNumerica = parseFloat(detalle.Cantidad);
            if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
                console.error(`❌ Cantidad inválida para producto ${detalle.codpro}: ${detalle.Cantidad}`);
                throw new Error(`Cantidad inválida: ${detalle.Cantidad}`);
            }
            
            console.log('🔍 Procesando detalle:', {
                codpro: detalle.codpro,
                lote: detalle.lote,
                cantidad: detalle.Cantidad,
                cantidadNumerica: cantidadNumerica,
                vencimiento: detalle.Vencimiento
            });
            
            const detalleParams = [
                { name: 'num', type: sql.NVarChar, value: NroGuiaGenerado },
                { name: 'idpro', type: sql.NVarChar, value: detalle.codpro },
                { name: 'lote', type: sql.NVarChar, value: detalle.lote },
                { name: 'vence', type: sql.DateTime, value: new Date(detalle.Vencimiento) },
                { name: 'cantidad', type: sql.Decimal(18,2), value: detalle.Cantidad },
                { name: 'guia', type: sql.NVarChar, value: detalle.GuiaDevo },
                { name: 'referencia', type: sql.NVarChar, value: detalle.Referencia },
                { name: 'tipodoc', type: sql.NVarChar, value: detalle.TipoDoc }
            ];
            
            console.log('📝 Insertando detalle en DetaGuiaCanje...');
            await dbService.executeProcedureInTransaction(transaction, 'sp_DetaGuiaCanje_insertar', detalleParams);
            console.log('✅ Detalle insertado correctamente');

            // --- OPERACIÓN 1: Descontar Stock Global del Producto en la tabla Productos ---
            console.log(`📦 OPERACIÓN 1: Descontando ${cantidadNumerica} unidades del stock global del producto ${detalle.codpro}`);
            try {
                // Verificar si el producto existe y obtener su stock actual
                const checkProducto = await dbService.executeQueryInTransaction(transaction,
                    `SELECT Codpro, Stock FROM Productos WHERE Codpro = @codigo`,
                    [{ name: 'codigo', type: sql.NVarChar, value: detalle.codpro }]
                );
                
                if (checkProducto.recordset.length === 0) {
                    console.error(`❌ Producto ${detalle.codpro} no encontrado en la tabla Productos`);
                    throw new Error(`Producto ${detalle.codpro} no encontrado`);
                }
                
                const stockActual = checkProducto.recordset[0].Stock;
                console.log(`📊 Stock actual del producto ${detalle.codpro}: ${stockActual}`);
                
                // Verificar que hay suficiente stock
                if (stockActual < cantidadNumerica) {
                    console.error(`❌ Stock insuficiente para producto ${detalle.codpro}. Stock actual: ${stockActual}, Cantidad a descontar: ${cantidadNumerica}`);
                    throw new Error(`Stock insuficiente para producto ${detalle.codpro}. Stock actual: ${stockActual}, Cantidad a descontar: ${cantidadNumerica}`);
                }
                
                const resultProductos = await dbService.executeQueryInTransaction(transaction,
                    `UPDATE Productos SET Stock = Stock - @canti WHERE Codpro = @codigo`,
                    [
                        { name: 'canti', type: sql.Decimal(18,2), value: cantidadNumerica },
                        { name: 'codigo', type: sql.NVarChar, value: detalle.codpro }
                    ]
                );
                console.log('✅ Stock global actualizado. Filas afectadas:', resultProductos.rowsAffected[0]);
                
                // Verificar el stock después de la actualización
                const checkProductoDespues = await dbService.executeQueryInTransaction(transaction,
                    `SELECT Stock FROM Productos WHERE Codpro = @codigo`,
                    [{ name: 'codigo', type: sql.NVarChar, value: detalle.codpro }]
                );
                console.log(`📊 Stock después de descuento: ${checkProductoDespues.recordset[0].Stock}`);
                
            } catch (error) {
                console.error('❌ Error al actualizar stock global:', error);
                throw error;
            }

            // --- OPERACIÓN 2: Descontar Saldo Específico del Producto por Almacén y Lote en la tabla Saldos ---
            console.log(`📦 OPERACIÓN 2: Descontando ${cantidadNumerica} unidades del saldo específico del producto ${detalle.codpro}, lote ${detalle.lote}, almacén 3`);
            try {
                // Verificar si el saldo existe y obtener su valor actual
                const checkSaldo = await dbService.executeQueryInTransaction(transaction,
                    `SELECT Codpro, Almacen, Lote, Saldo FROM Saldos WHERE Codpro = @codigo AND Almacen = 3 AND Lote = @lote`,
                    [
                        { name: 'codigo', type: sql.NVarChar, value: detalle.codpro },
                        { name: 'lote', type: sql.NVarChar, value: detalle.lote }
                    ]
                );
                
                if (checkSaldo.recordset.length === 0) {
                    console.error(`❌ Saldo no encontrado para producto ${detalle.codpro}, lote ${detalle.lote}, almacén 3`);
                    throw new Error(`Saldo no encontrado para producto ${detalle.codpro}, lote ${detalle.lote}, almacén 3`);
                }
                
                const saldoActual = checkSaldo.recordset[0].Saldo;
                console.log(`📊 Saldo actual del producto ${detalle.codpro}, lote ${detalle.lote}, almacén 3: ${saldoActual}`);
                
                // Verificar que hay suficiente saldo
                if (saldoActual < cantidadNumerica) {
                    console.error(`❌ Saldo insuficiente para producto ${detalle.codpro}, lote ${detalle.lote}. Saldo actual: ${saldoActual}, Cantidad a descontar: ${cantidadNumerica}`);
                    throw new Error(`Saldo insuficiente para producto ${detalle.codpro}, lote ${detalle.lote}. Saldo actual: ${saldoActual}, Cantidad a descontar: ${cantidadNumerica}`);
                }
                
                const resultSaldos = await dbService.executeQueryInTransaction(transaction,
                    `UPDATE Saldos SET Saldo = Saldo - @canti WHERE Codpro = @codigo AND Almacen = 3 AND Lote = @lote`,
                    [
                        { name: 'canti', type: sql.Decimal(18,2), value: cantidadNumerica },
                        { name: 'codigo', type: sql.NVarChar, value: detalle.codpro },
                        { name: 'lote', type: sql.NVarChar, value: detalle.lote }
                    ]
                );
                console.log('✅ Saldo específico actualizado. Filas afectadas:', resultSaldos.rowsAffected[0]);
                
                // Verificar el saldo después de la actualización
                const checkSaldoDespues = await dbService.executeQueryInTransaction(transaction,
                    `SELECT Saldo FROM Saldos WHERE Codpro = @codigo AND Almacen = 3 AND Lote = @lote`,
                    [
                        { name: 'codigo', type: sql.NVarChar, value: detalle.codpro },
                        { name: 'lote', type: sql.NVarChar, value: detalle.lote }
                    ]
                );
                console.log(`📊 Saldo después de descuento: ${checkSaldoDespues.recordset[0].Saldo}`);
                
            } catch (error) {
                console.error('❌ Error al actualizar saldo específico:', error);
                throw error;
            }
            
            console.log('✅ Detalle procesado completamente');
        }
        
        console.log('🎉 TODOS LOS DETALLES PROCESADOS Y DESCUENTOS APLICADOS CORRECTAMENTE');

        // 3. Actualizar estado de procesado en guías de devolución
        for (const detalle of detalles) {
            // Actualizar DetaGuiaDevo
            await dbService.executeQueryInTransaction(transaction, 
                `UPDATE DetaGuiaDevo SET Procesado=1 WHERE Codpro=@codpro AND NroGuia=@guiaDevo AND lote=@lote AND Cantidad - (ISNULL((SELECT SUM(cantidad) FROM detaGuiaCanje WHERE codpro=@codpro AND lote=@lote AND GuiaDevo=@guiaDevo AND Referencia=@referencia AND TipoDoc=@tipodoc), 0) + @cantidad) <= 0`,
                [
                    { name: 'codpro', type: sql.NVarChar, value: detalle.codpro },
                    { name: 'guiaDevo', type: sql.NVarChar, value: detalle.GuiaDevo },
                    { name: 'lote', type: sql.NVarChar, value: detalle.lote },
                    { name: 'referencia', type: sql.NVarChar, value: detalle.Referencia },
                    { name: 'tipodoc', type: sql.NVarChar, value: detalle.TipoDoc },
                    { name: 'cantidad', type: sql.Decimal(18,2), value: detalle.Cantidad }
                ]
            );

            // Actualizar DetaGuiaDevoN
            await dbService.executeQueryInTransaction(transaction,
                `UPDATE DetaGuiaDevoN SET Procesado=1 WHERE Codpro=@codpro AND NroGuia=@guiaDevo AND lote=@lote AND Cantidad - (ISNULL((SELECT SUM(cantidad) FROM detaGuiaCanje WHERE codpro=@codpro AND lote=@lote AND GuiaDevo=@guiaDevo), 0) + @cantidad) <= 0`,
                [
                    { name: 'codpro', type: sql.NVarChar, value: detalle.codpro },
                    { name: 'guiaDevo', type: sql.NVarChar, value: detalle.GuiaDevo },
                    { name: 'lote', type: sql.NVarChar, value: detalle.lote },
                    { name: 'cantidad', type: sql.Decimal(18,2), value: detalle.Cantidad }
                ]
            );

            // Actualizar DetaGuiaDevoA
            await dbService.executeQueryInTransaction(transaction,
                `UPDATE DetaGuiaDevoA SET Procesado=1 WHERE Codpro=@codpro AND NroGuia=@guiaDevo AND lote=@lote AND Cantidad - (ISNULL((SELECT SUM(cantidad) FROM detaGuiaCanje WHERE codpro=@codpro AND lote=@lote), 0) + @cantidad) <= 0`,
                [
                    { name: 'codpro', type: sql.NVarChar, value: detalle.codpro },
                    { name: 'guiaDevo', type: sql.NVarChar, value: detalle.GuiaDevo },
                    { name: 'lote', type: sql.NVarChar, value: detalle.lote },
                    { name: 'cantidad', type: sql.Decimal(18,2), value: detalle.Cantidad }
                ]
            );

            // Llamar sp_guiaDevo_Actualizar dos veces
            const guiaDevoActualizarParams = [
                { name: 'GuiaDevoNro', type: sql.NVarChar, value: detalle.GuiaDevo },
                { name: 'CodPro', type: sql.NVarChar, value: detalle.codpro },
                { name: 'Lote', type: sql.NVarChar, value: detalle.lote },
                { name: 'Cantidad', type: sql.Decimal(18,2), value: detalle.Cantidad },
                { name: 'NroGuiaCanje', type: sql.NVarChar, value: NroGuiaGenerado },
                { name: 'Referencia', type: sql.NVarChar, value: detalle.Referencia },
                { name: 'TipoDoc', type: sql.NVarChar, value: detalle.TipoDoc }
            ];
            await dbService.executeProcedureInTransaction(transaction, 'sp_guiaDevo_Actualizar', guiaDevoActualizarParams);
            await dbService.executeProcedureInTransaction(transaction, 'sp_guiaDevo_Actualizar', guiaDevoActualizarParams);
        }

        // 4. Actualizar numeración de guía de devolución
        const numGuiaDevoParam = [
            { name: 'Cod', type: sql.Int, value: 37 },
            { name: 'des1', type: sql.NVarChar, value: 'Número de Guia devolucion para Proveedor' },
            { name: 'codl', type: sql.Int, value: 1 },
            { name: 'des2', type: sql.NVarChar, value: NroGuiaGenerado },
            { name: 'conv', type: sql.Decimal(18,2), value: 0.00 },
            { name: 'afecto', type: sql.Int, value: 0 }
        ];
        await dbService.executeProcedureInTransaction(transaction, 'sp_Tablas_Modificar', numGuiaDevoParam);
        await dbService.executeProcedureInTransaction(transaction, 'sp_Tablas_Modificar', numGuiaDevoParam);

        // 5. Generar guía de venta
        const guiaVentaParams = [
            { name: 'nro', type: sql.NVarChar, value: 'T002-000699' },
            { name: 'Venta', type: sql.NVarChar, value: NroGuiaGenerado },
            { name: 'tipodoc', type: sql.Int, value: 12 },
            { name: 'fec', type: sql.DateTime, value: new Date() },
            { name: 'emp', type: sql.NVarChar, value: cabecera.EmpTrans },
            { name: 'ruc', type: sql.NVarChar, value: cabecera.RucTrans },
            { name: 'placa', type: sql.NVarChar, value: cabecera.Placa },
            { name: 'pto', type: sql.NVarChar, value: cabecera.PtoLlegada },
            { name: 'destino', type: sql.NVarChar, value: cabecera.Destinatario },
            { name: 'peso', type: sql.Decimal(18,2), value: 1.80 }
        ];
        await dbService.executeProcedureInTransaction(transaction, 'sp_GuiaVenta_Insertar', guiaVentaParams);

        // 6. Actualizar numeración de guía de venta
        const numGuiaVentaParam = [
            { name: 'Cod', type: sql.Int, value: 35 },
            { name: 'des1', type: sql.NVarChar, value: 'Número Guia de Venta' },
            { name: 'codl', type: sql.Int, value: 2 },
            { name: 'des2', type: sql.NVarChar, value: 'T002-000699' },
            { name: 'conv', type: sql.Decimal(18,2), value: 0.00 },
            { name: 'afecto', type: sql.Int, value: 0 }
        ];
        await dbService.executeProcedureInTransaction(transaction, 'sp_Tablas_Modificar', numGuiaVentaParam);
        await dbService.executeProcedureInTransaction(transaction, 'sp_Tablas_Modificar', numGuiaVentaParam);

        // Confirmar transacción
        await dbService.commitTransaction(transaction);
        res.status(201).json({ success: true, message: 'Guía de canje registrada exitosamente', NroGuia: NroGuiaGenerado });

    } catch (error) {
        console.error('Error en registrarGuiaCanje:', error);
        if (transaction) {
            await dbService.rollbackTransaction(transaction);
        }
        res.status(500).json({ success: false, message: 'Error al registrar guía de canje', error: error.message });
    }
};

// PROBAR ELIMINAR (Eliminar Guía de Canje - Lógica de borrado lógico)
exports.eliminarGuiaCanje = async (req, res) => {
    const { nroGuia } = req.params;
    try {
        await dbService.executeQuery(
            `UPDATE GuiasCanje SET Eliminado = 1 WHERE NroGuia = @nroGuia`,
            [{ name: 'nroGuia', type: sql.NVarChar, value: nroGuia.trim() }]
        );
        res.status(200).json({ success: true, message: 'Guía de canje eliminada lógicamente' });
    } catch (error) {
        console.error('Error en eliminarGuiaCanje:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar guía de canje', error: error.message });
    }
};

// Eliminar guía de canje completa con devolución de productos al inventario
exports.eliminarGuiaCanjeCompleta = async (req, res) => {
    const { nroGuia } = req.params;
    let transaction;
    
    try {
        console.log('🚀 Iniciando proceso de eliminación de guía de canje:', nroGuia);
        
        // Iniciar transacción
        transaction = await dbService.beginTransaction();
        
        // Paso 1: Verificar que la guía existe y no está eliminada
        console.log('🔍 Paso 1: Verificando existencia de la guía...');
        const checkGuia = await dbService.executeQueryInTransaction(transaction,
            `SELECT NroGuia, Eliminado FROM GuiasCanje WHERE NroGuia = @nroGuia`,
            [{ name: 'nroGuia', type: sql.NVarChar, value: nroGuia.trim() }]
        );
        
        if (checkGuia.recordset.length === 0) {
            throw new Error(`Guía ${nroGuia} no encontrada`);
        }
        
        if (checkGuia.recordset[0].Eliminado === 1) {
            throw new Error(`Guía ${nroGuia} ya está eliminada`);
        }
        
        console.log('✅ Guía encontrada y válida para eliminación');
        
        // Paso 2: Obtener todos los detalles de la guía para procesar
        console.log('📋 Paso 2: Obteniendo detalles de la guía...');
        const detallesGuia = await dbService.executeQueryInTransaction(transaction,
            `SELECT 
                dgc.NroGuia,
                gc.Fecha,
                dgc.codpro,
                dgc.lote,
                dgc.Vencimiento,
                dgc.Cantidad,
                p.PVentaMi,
                p.Costo,
                p.Stock,
                p.Costo AS CostoP,
                dgc.GuiaDevo
            FROM DetaGuiaCanje dgc
            INNER JOIN GuiasCanje gc ON dgc.NroGuia = gc.NroGuia
            INNER JOIN Productos p ON dgc.codpro = p.Codpro
            WHERE dgc.NroGuia = @nroGuia`,
            [{ name: 'nroGuia', type: sql.NVarChar, value: nroGuia.trim() }]
        );
        
        if (detallesGuia.recordset.length === 0) {
            throw new Error(`No se encontraron detalles para la guía ${nroGuia}`);
        }
        
        console.log(`📊 Total de detalles a procesar: ${detallesGuia.recordset.length}`);
        
        // Paso 3: Procesar cada detalle para devolver productos al inventario
        console.log('🔄 Paso 3: Procesando detalles y devolviendo productos al inventario...');
        
        for (const detalle of detallesGuia.recordset) {
            console.log(`🔍 Procesando detalle: Producto ${detalle.codpro}, Lote ${detalle.lote}, Cantidad ${detalle.Cantidad}`);
            
            // Validar cantidad
            const cantidadNumerica = parseFloat(detalle.Cantidad);
            if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
                throw new Error(`Cantidad inválida para producto ${detalle.codpro}: ${detalle.Cantidad}`);
            }
            
            // 3.1 Incrementar Stock Global en la tabla Productos
            console.log(`📦 Incrementando stock global del producto ${detalle.codpro} en ${cantidadNumerica} unidades`);
            const resultProductos = await dbService.executeQueryInTransaction(transaction,
                `UPDATE Productos SET Stock = Stock + @canti WHERE Codpro = @codigo`,
                [
                    { name: 'canti', type: sql.Decimal(18,2), value: cantidadNumerica },
                    { name: 'codigo', type: sql.NVarChar, value: detalle.codpro }
                ]
            );
            console.log('✅ Stock global incrementado. Filas afectadas:', resultProductos.rowsAffected[0]);
            
            // 3.2 Incrementar Saldo Específico en la tabla Saldos
            console.log(`📦 Incrementando saldo específico del producto ${detalle.codpro}, lote ${detalle.lote}, almacén 3`);
            
            // Verificar si existe el registro de saldo
            const checkSaldo = await dbService.executeQueryInTransaction(transaction,
                `SELECT COUNT(*) as conteo FROM Saldos WHERE Codpro = @codigo AND Almacen = 3 AND Lote = @lote`,
                [
                    { name: 'codigo', type: sql.NVarChar, value: detalle.codpro },
                    { name: 'lote', type: sql.NVarChar, value: detalle.lote }
                ]
            );
            
            if (checkSaldo.recordset[0].conteo === 0) {
                // Si no existe, insertar nuevo registro
                console.log(`📝 Insertando nuevo registro de saldo para producto ${detalle.codpro}, lote ${detalle.lote}`);
                await dbService.executeQueryInTransaction(transaction,
                    `INSERT INTO Saldos (Codpro, Almacen, Lote, Saldo) VALUES (@codigo, 3, @lote, @canti)`,
                    [
                        { name: 'codigo', type: sql.NVarChar, value: detalle.codpro },
                        { name: 'lote', type: sql.NVarChar, value: detalle.lote },
                        { name: 'canti', type: sql.Decimal(18,2), value: cantidadNumerica }
                    ]
                );
                console.log('✅ Nuevo registro de saldo insertado');
            } else {
                // Si existe, actualizar
                const resultSaldos = await dbService.executeQueryInTransaction(transaction,
                    `UPDATE Saldos SET Saldo = Saldo + @canti WHERE Codpro = @codigo AND Almacen = 3 AND Lote = @lote`,
                    [
                        { name: 'canti', type: sql.Decimal(18,2), value: cantidadNumerica },
                        { name: 'codigo', type: sql.NVarChar, value: detalle.codpro },
                        { name: 'lote', type: sql.NVarChar, value: detalle.lote }
                    ]
                );
                console.log('✅ Saldo específico incrementado. Filas afectadas:', resultSaldos.rowsAffected[0]);
            }
            
            // 3.3 Obtener el nuevo saldo para la transacción
            const nuevoSaldo = await dbService.executeQueryInTransaction(transaction,
                `SELECT Saldo FROM Saldos WHERE Codpro = @codigo AND Almacen = 3 AND Lote = @lote`,
                [
                    { name: 'codigo', type: sql.NVarChar, value: detalle.codpro },
                    { name: 'lote', type: sql.NVarChar, value: detalle.lote }
                ]
            );
            
            const nstock = nuevoSaldo.recordset[0]?.Saldo || cantidadNumerica;
            
            // 3.4 Registrar Transacción de Entrada
            console.log(`📝 Registrando transacción de entrada para producto ${detalle.codpro}`);
            await dbService.executeQueryInTransaction(transaction,
                `INSERT INTO Transacciones (Documento, fecha, CodPro, Lote, Almacen, tipo, Clase, Cantidad, Costo, venta, stock, costop, TipoDoc)
                 VALUES (@docu, @fecha, @codpro, @lote, 3, 1, 2, @canti, @costo, @venta, @stock, @costop, 11)`,
                [
                    { name: 'docu', type: sql.NVarChar, value: nroGuia },
                    { name: 'fecha', type: sql.DateTime, value: new Date() },
                    { name: 'codpro', type: sql.NVarChar, value: detalle.codpro },
                    { name: 'lote', type: sql.NVarChar, value: detalle.lote },
                    { name: 'canti', type: sql.Decimal(18,2), value: cantidadNumerica },
                    { name: 'costo', type: sql.Decimal(18,2), value: detalle.Costo },
                    { name: 'venta', type: sql.Decimal(18,2), value: detalle.PVentaMi },
                    { name: 'stock', type: sql.Decimal(18,2), value: nstock },
                    { name: 'costop', type: sql.Decimal(18,2), value: detalle.CostoP }
                ]
            );
            console.log('✅ Transacción de entrada registrada');
            
            // 3.5 Revertir estado "Procesado" de los detalles de guías de devolución
            if (detalle.GuiaDevo) {
                console.log(`🔄 Revirtiendo estado procesado de guía de devolución ${detalle.GuiaDevo}`);
                
                // Actualizar DetaGuiaDevo
                await dbService.executeQueryInTransaction(transaction,
                    `UPDATE DetaGuiaDevo SET procesado = 0 WHERE NroGuia = @guiaDevo AND codpro = @codpro AND lote = @lote`,
                    [
                        { name: 'guiaDevo', type: sql.NVarChar, value: detalle.GuiaDevo },
                        { name: 'codpro', type: sql.NVarChar, value: detalle.codpro },
                        { name: 'lote', type: sql.NVarChar, value: detalle.lote }
                    ]
                );
                
                // Actualizar DetaGuiaDevoA
                await dbService.executeQueryInTransaction(transaction,
                    `UPDATE DetaGuiaDevoA SET procesado = 0 WHERE NroGuia = @guiaDevo AND codpro = @codpro AND lote = @lote`,
                    [
                        { name: 'guiaDevo', type: sql.NVarChar, value: detalle.GuiaDevo },
                        { name: 'codpro', type: sql.NVarChar, value: detalle.codpro },
                        { name: 'lote', type: sql.NVarChar, value: detalle.lote }
                    ]
                );
                
                // Actualizar DetaGuiaDevoN
                await dbService.executeQueryInTransaction(transaction,
                    `UPDATE DetaGuiaDevoN SET procesado = 0 WHERE NroGuia = @guiaDevo AND codpro = @codpro AND lote = @lote`,
                    [
                        { name: 'guiaDevo', type: sql.NVarChar, value: detalle.GuiaDevo },
                        { name: 'codpro', type: sql.NVarChar, value: detalle.codpro },
                        { name: 'lote', type: sql.NVarChar, value: detalle.lote }
                    ]
                );
                
                console.log('✅ Estados de guías de devolución revertidos');
            }
            
            console.log('✅ Detalle procesado completamente');
        }
        
        // Paso 4: Marcar la Guía de Canje como eliminada
        console.log('🗑️ Paso 4: Marcando guía como eliminada...');
        await dbService.executeQueryInTransaction(transaction,
            `UPDATE GuiasCanje SET Eliminado = 1 WHERE NroGuia = @nroGuia`,
            [{ name: 'nroGuia', type: sql.NVarChar, value: nroGuia.trim() }]
        );
        console.log('✅ Guía marcada como eliminada');
        
        // Paso 5: Actualizar último número de guía en tabla Tablas
        console.log('🔢 Paso 5: Actualizando último número de guía...');
        const ultimoNumeroGuia = await dbService.executeQueryInTransaction(transaction,
            `SELECT TOP 1 Numero FROM DoccabGuia 
             WHERE Numero LIKE '%T002%' 
             AND Fecha >= '06/01/2025' 
             ORDER BY Numero DESC`,
            []
        );
        
        if (ultimoNumeroGuia.recordset.length > 0) {
            const nuevoUltimoNumero = ultimoNumeroGuia.recordset[0].Numero;
            console.log(`📋 Último número de guía encontrado: ${nuevoUltimoNumero}`);
            
            await dbService.executeQueryInTransaction(transaction,
                `UPDATE Tablas SET c_describe = @nuevoNumero 
                 WHERE n_codtabla = 35 AND n_numero = 2`,
                [{ name: 'nuevoNumero', type: sql.NVarChar, value: nuevoUltimoNumero }]
            );
            console.log(`✅ Último número actualizado a: ${nuevoUltimoNumero}`);
        } else {
            console.log('⚠️ No se encontraron guías para actualizar el último número');
        }
        
        // Confirmar transacción
        await dbService.commitTransaction(transaction);
        
        console.log('🎉 Proceso de eliminación completado exitosamente');
        
        res.status(200).json({
            success: true,
            message: `Guía ${nroGuia} eliminada correctamente y productos devueltos al inventario`,
            detallesProcesados: detallesGuia.recordset.length
        });
        
    } catch (error) {
        console.error('❌ Error en eliminarGuiaCanjeCompleta:', error);
        
        if (transaction) {
            await dbService.rollbackTransaction(transaction);
            console.log('🔄 Transacción revertida debido a error');
        }
        
        res.status(500).json({
            success: false,
            message: 'Error al eliminar guía de canje',
            error: error.message
        });
    }
};

// OBTENER SIGUIENTE NÚMERO DE DOCUMENTO (Para botón Nuevo)
exports.getSigNroGuiaCanje = async (req, res) => {
    try {
        console.log('🔢 Iniciando obtención del siguiente número de guía de canje...');
        
        // Obtener el siguiente número de guía de canje desde la tabla Tablas
        // n_codtabla=37 corresponde a la numeración de guías de canje
        const result = await dbService.executeQuery(
            `SELECT c_describe FROM Tablas WHERE n_codtabla = 37`,
            []
        );
        
        console.log('🔍 Resultado de la consulta:', result.recordset);
        
        let nextNumber = 'FF01-000001'; // Valor por defecto
        
        if (result.recordset && result.recordset.length > 0) {
            const currentNumber = result.recordset[0].c_describe;
            console.log('📋 Número actual encontrado:', currentNumber);
            
            if (currentNumber) {
                // Limpiar espacios en blanco
                const cleanNumber = currentNumber.trim();
                console.log('📋 Número limpio:', cleanNumber);
                
                // Extraer el número y el prefijo
                const match = cleanNumber.match(/^([A-Z]{2}\d{2})-(\d{6})$/);
                if (match) {
                    const prefix = match[1];
                    const number = parseInt(match[2]);
                    const nextNum = number + 1;
                    nextNumber = `${prefix}-${nextNum.toString().padStart(6, '0')}`;
                    console.log('🔢 Número siguiente calculado:', nextNumber);
                } else {
                    // Si no coincide el formato, usar el valor actual + 1
                    nextNumber = cleanNumber;
                    console.log('⚠️ Formato no reconocido, usando valor actual:', nextNumber);
                }
            } else {
                console.log('⚠️ No se encontró número actual, usando valor por defecto:', nextNumber);
            }
        } else {
            console.log('⚠️ No se encontraron registros en Tablas con n_codtabla=37, usando valor por defecto:', nextNumber);
        }
        
        console.log('✅ Número final a devolver:', nextNumber);
        res.status(200).json({ success: true, nextNumber });
    } catch (error) {
        console.error('❌ Error al obtener el siguiente número de guía de canje:', error);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener el siguiente número de guía de canje', 
            error: error.message,
            details: error.stack
        });
    }
};

// Función de prueba para verificar estructura de tabla
exports.verificarEstructuraTabla = async (req, res) => {
    try {
        const result = await dbService.executeQuery(
            `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_NAME = 'GuiasCanje' 
             ORDER BY ORDINAL_POSITION`
        );
        
        res.status(200).json({ 
            success: true, 
            estructura: result.recordset
        });
    } catch (error) {
        console.error('Error en verificarEstructuraTabla:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar estructura de tabla', 
            error: error.message 
        });
    }
};

// Buscar guía de canje por número
exports.buscarGuiaCanje = async (req, res) => {
    const { numero } = req.params;
    try {
        const result = await dbService.executeQuery(
            `SELECT * FROM GuiasCanje WHERE NroGuia = @numero AND Eliminado = 0`,
            [{ name: 'numero', type: sql.NVarChar, value: numero.trim() }]
        );
        
        res.status(200).json({ 
            success: true, 
            data: result.recordset[0] || null 
        });
    } catch (error) {
        console.error('Error en buscarGuiaCanje:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al buscar guía de canje', 
            error: error.message 
        });
    }
};

// Insertar cabecera de guía de canje
exports.insertarCabeceraGuiaCanje = async (req, res) => {
    const { docu, feca, Prov, empresa, ruc, placa, punto, destino } = req.body;
    
    try {
        // Primero, vamos a verificar la estructura de la tabla
        const structureResult = await dbService.executeQuery(
            `SELECT COLUMN_NAME, DATA_TYPE 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_NAME = 'GuiasCanje' 
             ORDER BY ORDINAL_POSITION`
        );
        console.log('Estructura de la tabla GuiasCanje:', structureResult.recordset);
        
        const result = await dbService.executeQuery(
            `INSERT INTO GuiasCanje (NroGuia, Fecha, Proveedor, EmpTrans, RucTrans, Placa, PtoLlegada, Destinatario, Eliminado)
             VALUES (@docu, @feca, @Prov, @empresa, @ruc, @placa, @punto, @destino, 0)`,
            [
                { name: 'docu', type: sql.Char, value: docu },
                { name: 'feca', type: sql.SmallDateTime, value: new Date(feca) },
                { name: 'Prov', type: sql.Char, value: Prov },
                { name: 'empresa', type: sql.VarChar, value: empresa },
                { name: 'ruc', type: sql.VarChar, value: ruc },
                { name: 'placa', type: sql.Char, value: placa },
                { name: 'punto', type: sql.VarChar, value: punto },
                { name: 'destino', type: sql.VarChar, value: destino }
            ]
        );
        
        res.status(200).json({ 
            success: true, 
            message: 'Cabecera de guía de canje insertada correctamente',
            numero: docu
        });
    } catch (error) {
        console.error('Error en insertarCabeceraGuiaCanje:', error);
        console.error('Datos recibidos:', { docu, feca, Prov, empresa, ruc, placa, punto, destino });
        res.status(500).json({ 
            success: false, 
            message: 'Error al insertar cabecera de guía de canje', 
            error: error.message,
            details: error.stack
        });
    }
};

// Insertar detalle de guía de canje
exports.insertarDetalleGuiaCanje = async (req, res) => {
    const { num, idpro, lote, vence, cantidad, guia, referencia, tipodoc } = req.body;
    
    try {
        console.log('🔄 Iniciando inserción de detalle y descuento de inventario...');
        console.log('📋 Datos del detalle:', { num, idpro, lote, vence, cantidad, guia, referencia, tipodoc });
        
        // Validar y convertir la cantidad a número
        const cantidadNumerica = parseFloat(cantidad);
        if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
            console.error(`❌ Cantidad inválida para producto ${idpro}: ${cantidad}`);
            throw new Error(`Cantidad inválida: ${cantidad}`);
        }
        
        console.log(`🔍 Procesando detalle para producto ${idpro}, cantidad: ${cantidadNumerica}`);
        
        // 1. Insertar el detalle
        console.log('📝 Insertando detalle en DetaGuiaCanje...');
        const result = await dbService.executeQuery(
            `INSERT INTO DetaGuiaCanje (NroGuia, codpro, lote, Vencimiento, Cantidad, GuiaDevo, Referencia, TipoDoc)
             VALUES (@num, @idpro, @lote, @vence, @cantidad, @guia, @referencia, @tipodoc)`,
            [
                { name: 'num', type: sql.NVarChar, value: num },
                { name: 'idpro', type: sql.NVarChar, value: idpro },
                { name: 'lote', type: sql.NVarChar, value: lote },
                { name: 'vence', type: sql.DateTime, value: vence ? new Date(vence) : null },
                { name: 'cantidad', type: sql.Decimal(18,2), value: cantidadNumerica },
                { name: 'guia', type: sql.NVarChar, value: guia },
                { name: 'referencia', type: sql.NVarChar, value: referencia },
                { name: 'tipodoc', type: sql.NVarChar, value: tipodoc }
            ]
        );
        console.log('✅ Detalle insertado correctamente');

        // 2. --- OPERACIÓN 1: Descontar Stock Global del Producto en la tabla Productos ---
        console.log(`📦 OPERACIÓN 1: Descontando ${cantidadNumerica} unidades del stock global del producto ${idpro}`);
        try {
            // Verificar si el producto existe y obtener su stock actual
            const checkProducto = await dbService.executeQuery(
                `SELECT Codpro, Stock FROM Productos WHERE Codpro = @codigo`,
                [{ name: 'codigo', type: sql.NVarChar, value: idpro }]
            );
            
            if (checkProducto.recordset.length === 0) {
                console.error(`❌ Producto ${idpro} no encontrado en la tabla Productos`);
                throw new Error(`Producto ${idpro} no encontrado`);
            }
            
            const stockActual = checkProducto.recordset[0].Stock;
            console.log(`📊 Stock actual del producto ${idpro}: ${stockActual}`);
            
            // Verificar que hay suficiente stock
            if (stockActual < cantidadNumerica) {
                console.error(`❌ Stock insuficiente para producto ${idpro}. Stock actual: ${stockActual}, Cantidad a descontar: ${cantidadNumerica}`);
                throw new Error(`Stock insuficiente para producto ${idpro}. Stock actual: ${stockActual}, Cantidad a descontar: ${cantidadNumerica}`);
            }
            
            const resultProductos = await dbService.executeQuery(
                `UPDATE Productos SET Stock = Stock - @canti WHERE Codpro = @codigo`,
                [
                    { name: 'canti', type: sql.Decimal(18,2), value: cantidadNumerica },
                    { name: 'codigo', type: sql.NVarChar, value: idpro }
                ]
            );
            console.log('✅ Stock global actualizado. Filas afectadas:', resultProductos.rowsAffected[0]);
            
            // Verificar el stock después de la actualización
            const checkProductoDespues = await dbService.executeQuery(
                `SELECT Stock FROM Productos WHERE Codpro = @codigo`,
                [{ name: 'codigo', type: sql.NVarChar, value: idpro }]
            );
            console.log(`📊 Stock después de descuento: ${checkProductoDespues.recordset[0].Stock}`);
            
        } catch (error) {
            console.error('❌ Error al actualizar stock global:', error);
            throw error;
        }

        // 3. --- OPERACIÓN 2: Descontar Saldo Específico del Producto por Almacén y Lote en la tabla Saldos ---
        console.log(`📦 OPERACIÓN 2: Descontando ${cantidadNumerica} unidades del saldo específico del producto ${idpro}, lote ${lote}, almacén 3`);
        try {
            // Verificar si el saldo existe y obtener su valor actual
            const checkSaldo = await dbService.executeQuery(
                `SELECT Codpro, Almacen, Lote, Saldo FROM Saldos WHERE Codpro = @codigo AND Almacen = 3 AND Lote = @lote`,
                [
                    { name: 'codigo', type: sql.NVarChar, value: idpro },
                    { name: 'lote', type: sql.NVarChar, value: lote }
                ]
            );
            
            if (checkSaldo.recordset.length === 0) {
                console.error(`❌ Saldo no encontrado para producto ${idpro}, lote ${lote}, almacén 3`);
                throw new Error(`Saldo no encontrado para producto ${idpro}, lote ${lote}, almacén 3`);
            }
            
            const saldoActual = checkSaldo.recordset[0].Saldo;
            console.log(`📊 Saldo actual del producto ${idpro}, lote ${lote}, almacén 3: ${saldoActual}`);
            
            // Verificar que hay suficiente saldo
            if (saldoActual < cantidadNumerica) {
                console.error(`❌ Saldo insuficiente para producto ${idpro}, lote ${lote}. Saldo actual: ${saldoActual}, Cantidad a descontar: ${cantidadNumerica}`);
                throw new Error(`Saldo insuficiente para producto ${idpro}, lote ${lote}. Saldo actual: ${saldoActual}, Cantidad a descontar: ${cantidadNumerica}`);
            }
            
            const resultSaldos = await dbService.executeQuery(
                `UPDATE Saldos SET Saldo = Saldo - @canti WHERE Codpro = @codigo AND Almacen = 3 AND Lote = @lote`,
                [
                    { name: 'canti', type: sql.Decimal(18,2), value: cantidadNumerica },
                    { name: 'codigo', type: sql.NVarChar, value: idpro },
                    { name: 'lote', type: sql.NVarChar, value: lote }
                ]
            );
            console.log('✅ Saldo específico actualizado. Filas afectadas:', resultSaldos.rowsAffected[0]);
            
            // Verificar el saldo después de la actualización
            const checkSaldoDespues = await dbService.executeQuery(
                `SELECT Saldo FROM Saldos WHERE Codpro = @codigo AND Almacen = 3 AND Lote = @lote`,
                [
                    { name: 'codigo', type: sql.NVarChar, value: idpro },
                    { name: 'lote', type: sql.NVarChar, value: lote }
                ]
            );
            console.log(`📊 Saldo después de descuento: ${checkSaldoDespues.recordset[0].Saldo}`);
            
        } catch (error) {
            console.error('❌ Error al actualizar saldo específico:', error);
            throw error;
        }
        
        console.log('✅ Detalle procesado completamente con descuento de inventario');
        
        res.status(200).json({ 
            success: true, 
            message: 'Detalle de guía de canje insertado correctamente y inventario descontado'
        });
    } catch (error) {
        console.error('Error en insertarDetalleGuiaCanje:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al insertar detalle de guía de canje', 
            error: error.message 
        });
    }
}; 

// Actualizar contador de guía de devolución para proveedor
exports.actualizarContadorDevolucion = async (req, res) => {
    const { numero } = req.body;
    try {
        console.log('🔢 Actualizando contador de devolución con número:', numero);
        const result = await require('../services/dbService').executeQuery(
            `UPDATE Tablas SET c_describe = @numero WHERE n_codTabla = 37 AND n_numero = 1`,
            [{ name: 'numero', type: require('mssql').NVarChar, value: numero }]
        );
        console.log('✅ Contador de devolución actualizado correctamente');
        res.status(200).json({
            success: true,
            message: 'Contador de devolución actualizado correctamente',
            numero: numero
        });
    } catch (error) {
        console.error('Error en actualizarContadorDevolucion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar contador de devolución',
            error: error.message
        });
    }
}; 

// Listar cabeceras de guías (DoccabGuia)
exports.listarCabGuias = async (req, res) => {
    try {
        console.log('🔍 Obteniendo lista de cabeceras de guías...');
        const result = await dbService.executeQuery(
            `
SELECT Numero, Docventa, Fecha, Empresa, PtoLLegada FROM doccabguia WHERE numero LIKE '%T002%' and Fecha >= '06/01/2025' ORDER BY numero DESC`
        );
        
        console.log(`✅ Se encontraron ${result.recordset.length} cabeceras de guías`);
        res.status(200).json({ 
            success: true, 
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (error) {
        console.error('❌ Error en listarCabGuias:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al listar cabeceras de guías', 
            error: error.message 
        });
    }
};

// Eliminar cabecera de guía individual
exports.eliminarCabGuia = async (req, res) => {
    const { numero } = req.params;
    
    try {
        console.log(`🗑️ Eliminando cabecera de guía: ${numero}`);
        
        const result = await dbService.executeQuery(
            `DELETE FROM DoccabGuia WHERE numero = @numero`,
            [{ name: 'numero', type: sql.NVarChar, value: numero.trim() }]
        );
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: `No se encontró la cabecera de guía ${numero}`
            });
        }
        
        console.log(`✅ Cabecera de guía ${numero} eliminada correctamente`);
        res.status(200).json({
            success: true,
            message: `Cabecera de guía ${numero} eliminada correctamente`
        });
    } catch (error) {
        console.error('❌ Error en eliminarCabGuia:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar cabecera de guía',
            error: error.message
        });
    }
};

// Obtener último número de cabecera de guía
exports.obtenerUltimoNumeroCabGuia = async (req, res) => {
    try {
        console.log('🔢 Obteniendo último número de cabecera de guía...');
        const result = await dbService.executeQuery(
            `SELECT c_describe FROM Tablas WHERE n_codtabla = 35 AND n_numero = 2`
        );
        
        let ultimoNumero = 'T002-000001'; // Valor por defecto
        
        if (result.recordset && result.recordset.length > 0) {
            ultimoNumero = result.recordset[0].c_describe || ultimoNumero;
        }
        
        console.log(`✅ Último número obtenido: ${ultimoNumero}`);
        res.status(200).json({
            success: true,
            ultimoNumero: ultimoNumero
        });
    } catch (error) {
        console.error('❌ Error en obtenerUltimoNumeroCabGuia:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener último número de cabecera de guía',
            error: error.message
        });
    }
};

// Actualizar último número de cabecera de guía
exports.actualizarUltimoNumeroCabGuia = async (req, res) => {
    const { nuevoNumero } = req.body;
    
    try {
        console.log(`🔢 Actualizando último número de cabecera de guía a: ${nuevoNumero}`);
        
        const result = await dbService.executeQuery(
            `UPDATE Tablas SET c_describe = @nuevoNumero WHERE n_codtabla = 35 AND n_numero = 2`,
            [{ name: 'nuevoNumero', type: sql.NVarChar, value: nuevoNumero.trim() }]
        );
        
        console.log('✅ Último número de cabecera de guía actualizado correctamente');
        res.status(200).json({
            success: true,
            message: 'Último número de cabecera de guía actualizado correctamente',
            nuevoNumero: nuevoNumero
        });
    } catch (error) {
        console.error('❌ Error en actualizarUltimoNumeroCabGuia:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar último número de cabecera de guía',
            error: error.message
        });
    }
}; 