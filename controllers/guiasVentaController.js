const dbService = require('../services/dbService');
const sql = require('mssql');

// Función de prueba para verificar configuración de Tablas
exports.verificarConfiguracionTablas = async (req, res) => {
    try {
        const result = await dbService.executeQuery(
            `SELECT * FROM Tablas WHERE n_codTabla = 35`
        );
        
        res.status(200).json({ 
            success: true, 
            configuracion: result.recordset
        });
    } catch (error) {
        console.error('Error en verificarConfiguracionTablas:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar configuración de Tablas', 
            error: error.message 
        });
    }
};

// Obtener siguiente número de guía de venta
exports.getSiguienteNumero = async (req, res) => {
    try {
        // Obtener el último número de guía de venta desde la tabla Tablas
        const result = await dbService.executeQuery(
            `SELECT c_describe FROM Tablas WHERE n_codTabla = 35 AND n_numero = 2`
        );
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'No se encontró configuración para números de guía de venta' 
            });
        }
        
        const ultimoNumero = result.recordset[0].c_describe.trim(); // Limpiar espacios
        console.log('🔍 Número actual encontrado:', ultimoNumero);
        console.log('🔍 Longitud del número:', ultimoNumero.length);
        console.log('🔍 Caracteres del número:', ultimoNumero.split('').map(c => c.charCodeAt(0)));
        
        // Extraer el número y el prefijo (ej: T001-026515 -> T001, 026515)
        const match = ultimoNumero.match(/^([A-Z]\d{3})-(\d+)$/);
        console.log('🔍 Resultado del match:', match);
        
        if (!match) {
            return res.status(500).json({ 
                success: false, 
                message: 'Formato de número de guía inválido',
                numeroActual: ultimoNumero
            });
        }
        
        const [, prefijo, numero] = match;
        const siguienteNumero = parseInt(numero) + 1;
        const nuevoNumero = `${prefijo}-${siguienteNumero.toString().padStart(6, '0')}`;
        
        res.status(200).json({ 
            success: true, 
            numero: nuevoNumero,
            ultimoNumero: ultimoNumero
        });
    } catch (error) {
        console.error('Error en getSiguienteNumero:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener siguiente número de guía', 
            error: error.message 
        });
    }
};

// Buscar guía de venta por número
exports.buscarGuiaVenta = async (req, res) => {
    const { numero } = req.params;
    try {
        const result = await dbService.executeQuery(
            `SELECT * FROM doccabguia WHERE Numero = @numero`,
            [{ name: 'numero', type: sql.NVarChar, value: numero.trim() }]
        );
        
        res.status(200).json({ 
            success: true, 
            data: result.recordset[0] || null 
        });
    } catch (error) {
        console.error('Error en buscarGuiaVenta:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al buscar guía de venta', 
            error: error.message 
        });
    }
};

// Insertar nueva guía de venta
exports.insertarGuiaVenta = async (req, res) => {
    const { nro, Venta, tipodoc, fec, emp, ruc, placa, pto, destino, peso } = req.body;
    
    try {
        const result = await dbService.executeQuery(
            `INSERT INTO doccabguia (Numero, Docventa, TipoDoc, Fecha, Empresa, Ruc, Placa, PtoLlegada, Destino, Peso)
             VALUES (@nro, @Venta, @tipodoc, @fec, @emp, @ruc, @placa, @pto, @destino, @peso)`,
            [
                { name: 'nro', type: sql.NVarChar, value: nro },
                { name: 'Venta', type: sql.NVarChar, value: Venta },
                { name: 'tipodoc', type: sql.Int, value: tipodoc },
                { name: 'fec', type: sql.DateTime, value: new Date(fec) },
                { name: 'emp', type: sql.NVarChar, value: emp },
                { name: 'ruc', type: sql.NVarChar, value: ruc },
                { name: 'placa', type: sql.NVarChar, value: placa },
                { name: 'pto', type: sql.NVarChar, value: pto },
                { name: 'destino', type: sql.NVarChar, value: destino },
                { name: 'peso', type: sql.Decimal(18,2), value: peso }
            ]
        );
        
        res.status(200).json({ 
            success: true, 
            message: 'Guía de venta insertada correctamente',
            numero: nro
        });
    } catch (error) {
        console.error('Error en insertarGuiaVenta:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al insertar guía de venta', 
            error: error.message 
        });
    }
};

// Preparar datos para impresión
exports.prepararImpresion = async (req, res) => {
    const { doc } = req.body;
    
    try {
        // Limpiar tabla Guia_printer
        await dbService.executeQuery('DELETE FROM Guia_printer');
        await dbService.executeQuery('DBCC CHECKIDENT (\'Guia_printer\',RESEED,0)');
        
        // Insertar datos para impresión
        const result = await dbService.executeQuery(
            `INSERT INTO Guia_printer
             SELECT 
                doccabguia.Numero, 
                Proveedores.Razon as Destinatario, 
                Proveedores.Direc1, 
                Proveedores.Documento as RUC,
                GuiasCanje.Fecha as FechaEmision, 
                doccabguia.Empresa as Trasportista, 
                doccabguia.Ruc as RucTrasporte, 
                doccabguia.Placa,
                doccabguia.Fecha as FecIniTras, 
                '06' AS Codtraslado, 
                'DEVOLUCION' AS descripcion, 
                '06' AS Modalidad,
                (SELECT Direccion FROM Instala) as DirPartida, 
                pROVEEDORES.Direc1 as Dirllegada, 
                doccabGuia.Peso AS PesoBruto,
                DetaGuiaCanje.Codpro, 
                productos.Nombre as Producto, 
                DetaGuiacanje.cantidad, 
                'NIU' as Unidad, 
                doccabguia.Docventa,
                Proveedores.Razon, 
                DetaGuiaCanje.lote, 
                detaguiacanje.vencimiento, 
                LEFT(doccabguia.PtoLLegada,50)
             FROM doccabguia
             INNER JOIN GuiasCanje ON GuiasCanje.NroGuia = doccabguia.Docventa
             INNER JOIN Proveedores ON Proveedores.CodProv = GuiasCanje.Proveedor
             INNER JOIN DetaGuiacanje ON DetaGuiacanje.Nroguia = GuiasCanje.NroGuia
             INNER JOIN Productos ON productos.CodPro = DetaGuiacanje.codpro
             WHERE doccabguia.Numero = @doc`,
            [{ name: 'doc', type: sql.NVarChar, value: doc }]
        );
        
        // Obtener datos insertados
        const datosImpresion = await dbService.executeQuery(
            'SELECT * FROM Guia_printer ORDER BY Nro'
        );
        
        res.status(200).json({ 
            success: true, 
            message: 'Datos preparados para impresión correctamente',
            datos: datosImpresion.recordset
        });
    } catch (error) {
        console.error('Error en prepararImpresion:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al preparar datos para impresión', 
            error: error.message 
        });
    }
};

// Actualizar contador de guías
exports.actualizarContador = async (req, res) => {
    const { numero } = req.body;
    
    try {
        const result = await dbService.executeQuery(
            `UPDATE Tablas
             SET c_describe = @numero
             WHERE n_codTabla = 35 AND n_numero = 2`,
            [{ name: 'numero', type: sql.NVarChar, value: numero }]
        );
        
        res.status(200).json({ 
            success: true, 
            message: 'Contador actualizado correctamente',
            numero: numero
        });
    } catch (error) {
        console.error('Error en actualizarContador:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al actualizar contador', 
            error: error.message 
        });
    }
}; 

// Actualizar contador de Guía de Venta (T002-XXXXXX)
exports.actualizarContadorGuiaVenta = async (req, res) => {
    const { numero } = req.body;
    try {
        console.log('🔢 Actualizando contador de Guía de Venta con número:', numero);
        const result = await require('../services/dbService').executeQuery(
            `UPDATE Tablas SET c_describe = @numero WHERE n_codTabla = 35 AND n_numero = 2`,
            [{ name: 'numero', type: require('mssql').NVarChar, value: numero }]
        );
        console.log('✅ Contador de Guía de Venta actualizado correctamente');
        res.status(200).json({
            success: true,
            message: 'Contador de Guía de Venta actualizado correctamente',
            numero: numero
        });
    } catch (error) {
        console.error('Error en actualizarContadorGuiaVenta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar contador de Guía de Venta',
            error: error.message
        });
    }
};


// Actualizar contador al último número existente y continuar secuencia
exports.actualizarContadorAlUltimoExistente = async (req, res) => {
    try {
        console.log('🔢 Actualizando contador al último número existente...');
        
        // Buscar el último número de guía de venta que realmente existe
        const ultimoNumeroResult = await dbService.executeQuery(
            `SELECT TOP 1 Numero FROM DoccabGuia 
             WHERE Numero LIKE '%T002%' 
             AND Fecha >= '06/01/2025' 
             ORDER BY Numero DESC`,
            []
        );
        
        if (ultimoNumeroResult.recordset.length > 0) {
            const ultimoNumeroExistente = ultimoNumeroResult.recordset[0].Numero;
            console.log(`📋 Último número de guía existente: ${ultimoNumeroExistente}`);
            
            // Actualizar el contador en la tabla Tablas
            const updateResult = await dbService.executeQuery(
                `UPDATE Tablas SET c_describe = @numero WHERE n_codTabla = 35 AND n_numero = 2`,
                [{ name: 'numero', type: sql.NVarChar, value: ultimoNumeroExistente }]
            );
            
            console.log(`✅ Contador actualizado a: ${ultimoNumeroExistente}`);
            res.status(200).json({
                success: true,
                message: 'Contador actualizado al último número existente',
                ultimoNumero: ultimoNumeroExistente
            });
        } else {
            console.log('⚠️ No se encontraron guías de venta para actualizar el contador');
            res.status(404).json({
                success: false,
                message: 'No se encontraron guías de venta para actualizar el contador'
            });
        }
    } catch (error) {
        console.error('Error en actualizarContadorAlUltimoExistente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar contador al último número existente',
            error: error.message
        });
    }
}; 