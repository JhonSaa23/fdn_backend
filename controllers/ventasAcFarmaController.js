const dbService = require('../services/dbService');
const sql = require('mssql');
const ExcelJS = require('exceljs');

// Consultar reporte de Ventas AC Farma
exports.consultarVentasAcFarma = async (req, res) => {
    try {
        const { fecha, codigoLaboratorio } = req.query;

        console.log('🔍 Consultando Ventas AC Farma con filtros:', { fecha, codigoLaboratorio });

        if (!fecha) {
            return res.status(400).json({
                success: false,
                message: 'La fecha es requerida'
            });
        }

        // Construir la consulta base
        let query = `
            SET DATEFORMAT dmy;
            
            SELECT 
                doccab.Fecha,
                clientes.documento AS RUC,
                clientes.Razon,
                clientes.Direccion,
                LEFT(zonas.Descripcion, 50) AS Zona,
                empleados.CodEmp AS CodVen,
                empleados.Nombre AS Vendedor,
                (SELECT c_describe FROM tablas WHERE n_codtabla=400 AND n_numero=t_clientes_ubigeo.Dpto) AS Dpto,
                (SELECT c_describe FROM tablas WHERE n_codtabla=401 AND n_numero=t_clientes_ubigeo.Provincia) AS Provincia,
                (SELECT c_describe FROM tablas WHERE n_codtabla=402 AND n_numero=t_clientes_ubigeo.Distrito) AS Distrito,
                docdet.Numero,
                docdet.codpro,
                productos.Nombre AS NombreProducto,
                docdet.Cantidad,
                docdet.Precio,
                docdet.Descuento1,
                docdet.Descuento2,
                docdet.Descuento3,
                docdet.Cantidad * docdet.Precio * 
                    (1 - docdet.Descuento1 / 100) *
                    (1 - docdet.Descuento2 / 100) *
                    (1 - docdet.Descuento3 / 100) AS Total,
                Lineas.Descripcion AS Linea,
                CASE 
                    WHEN doccab.tipo = 1 THEN 'Fa'
                    ELSE 'Bo'
                END AS TipoDoc
            FROM docdet
            INNER JOIN doccab ON doccab.numero = docdet.numero
            INNER JOIN clientes ON clientes.Codclie = doccab.Codclie
            INNER JOIN zonas ON clientes.zona = zonas.Codzona
            INNER JOIN t_clientes_ubigeo ON t_clientes_ubigeo.Codigo = clientes.Codclie
            INNER JOIN productos ON productos.codpro = docdet.codpro
            INNER JOIN empleados ON empleados.CodEmp = doccab.Vendedor
            INNER JOIN lineas ON lineas.CodLinea = productos.CLinea
            WHERE 
                docdet.Precio > 0 
                AND doccab.Eliminado = 0
        `;

        const params = [];

        // Filtro de laboratorio (código de 2 dígitos)
        if (codigoLaboratorio && codigoLaboratorio.trim() !== '') {
            query += ` AND LEFT(docdet.CodPro, 2) = @codigoLaboratorio`;
            params.push({ 
                name: 'codigoLaboratorio', 
                type: sql.NVarChar, 
                value: codigoLaboratorio.trim() 
            });
        }

        // Filtro de fecha (formato dd/mm/yyyy)
        query += ` AND CONVERT(DATE, doccab.Fecha, 103) = @fecha`;
        params.push({ 
            name: 'fecha', 
            type: sql.Date, 
            value: new Date(fecha) 
        });

        query += ` ORDER BY doccab.Fecha, docdet.Numero`;

        console.log('📋 Ejecutando consulta con parámetros:', params);

        const result = await dbService.executeQuery(query, params);

        console.log('✅ Resultados encontrados:', result.recordset.length);

        res.json({
            success: true,
            data: result.recordset,
            total: result.recordset.length
        });

    } catch (error) {
        console.error('❌ Error al consultar Ventas AC Farma:', error);
        res.status(500).json({
            success: false,
            message: 'Error al consultar Ventas AC Farma',
            error: error.message
        });
    }
};

// Exportar reporte de Ventas AC Farma a Excel
exports.exportarVentasAcFarmaExcel = async (req, res) => {
    try {
        const { fecha, codigoLaboratorio } = req.query;

        console.log('📊 Exportando Ventas AC Farma a Excel:', { fecha, codigoLaboratorio });

        if (!fecha) {
            return res.status(400).json({
                success: false,
                message: 'La fecha es requerida'
            });
        }

        // Construir la consulta (misma que la de consultar)
        let query = `
            SET DATEFORMAT dmy;
            
            SELECT 
                doccab.Fecha,
                clientes.documento AS RUC,
                clientes.Razon,
                clientes.Direccion,
                LEFT(zonas.Descripcion, 50) AS Zona,
                empleados.CodEmp AS CodVen,
                empleados.Nombre AS Vendedor,
                (SELECT c_describe FROM tablas WHERE n_codtabla=400 AND n_numero=t_clientes_ubigeo.Dpto) AS Dpto,
                (SELECT c_describe FROM tablas WHERE n_codtabla=401 AND n_numero=t_clientes_ubigeo.Provincia) AS Provincia,
                (SELECT c_describe FROM tablas WHERE n_codtabla=402 AND n_numero=t_clientes_ubigeo.Distrito) AS Distrito,
                docdet.Numero,
                docdet.codpro,
                productos.Nombre AS NombreProducto,
                docdet.Cantidad,
                docdet.Precio,
                docdet.Descuento1,
                docdet.Descuento2,
                docdet.Descuento3,
                docdet.Cantidad * docdet.Precio * 
                    (1 - docdet.Descuento1 / 100) *
                    (1 - docdet.Descuento2 / 100) *
                    (1 - docdet.Descuento3 / 100) AS Total,
                Lineas.Descripcion AS Linea,
                CASE 
                    WHEN doccab.tipo = 1 THEN 'Fa'
                    ELSE 'Bo'
                END AS TipoDoc
            FROM docdet
            INNER JOIN doccab ON doccab.numero = docdet.numero
            INNER JOIN clientes ON clientes.Codclie = doccab.Codclie
            INNER JOIN zonas ON clientes.zona = zonas.Codzona
            INNER JOIN t_clientes_ubigeo ON t_clientes_ubigeo.Codigo = clientes.Codclie
            INNER JOIN productos ON productos.codpro = docdet.codpro
            INNER JOIN empleados ON empleados.CodEmp = doccab.Vendedor
            INNER JOIN lineas ON lineas.CodLinea = productos.CLinea
            WHERE 
                docdet.Precio > 0 
                AND doccab.Eliminado = 0
        `;

        const params = [];

        // Filtro de laboratorio
        if (codigoLaboratorio && codigoLaboratorio.trim() !== '') {
            query += ` AND LEFT(docdet.CodPro, 2) = @codigoLaboratorio`;
            params.push({ 
                name: 'codigoLaboratorio', 
                type: sql.NVarChar, 
                value: codigoLaboratorio.trim() 
            });
        }

        // Filtro de fecha
        query += ` AND CONVERT(DATE, doccab.Fecha, 103) = @fecha`;
        params.push({ 
            name: 'fecha', 
            type: sql.Date, 
            value: new Date(fecha) 
        });

        query += ` ORDER BY doccab.Fecha, docdet.Numero`;

        const result = await dbService.executeQuery(query, params);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron datos para exportar'
            });
        }

        console.log('📊 Generando archivo Excel con', result.recordset.length, 'registros...');

        // Crear workbook y worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ventas AC Farma');

        // Configurar columnas
        worksheet.columns = [
            { header: 'Fecha', key: 'Fecha', width: 12 },
            { header: 'RUC', key: 'RUC', width: 15 },
            { header: 'Razón Social', key: 'Razon', width: 40 },
            { header: 'Dirección', key: 'Direccion', width: 40 },
            { header: 'Zona', key: 'Zona', width: 25 },
            { header: 'Cód. Vendedor', key: 'CodVen', width: 12 },
            { header: 'Vendedor', key: 'Vendedor', width: 30 },
            { header: 'Dpto', key: 'Dpto', width: 20 },
            { header: 'Provincia', key: 'Provincia', width: 20 },
            { header: 'Distrito', key: 'Distrito', width: 20 },
            { header: 'Número Doc.', key: 'Numero', width: 15 },
            { header: 'Cód. Producto', key: 'codpro', width: 12 },
            { header: 'Producto', key: 'NombreProducto', width: 40 },
            { header: 'Cantidad', key: 'Cantidad', width: 10 },
            { header: 'Precio', key: 'Precio', width: 12 },
            { header: 'Desc. 1', key: 'Descuento1', width: 10 },
            { header: 'Desc. 2', key: 'Descuento2', width: 10 },
            { header: 'Desc. 3', key: 'Descuento3', width: 10 },
            { header: 'Total', key: 'Total', width: 12 },
            { header: 'Línea', key: 'Linea', width: 25 },
            { header: 'Tipo Doc.', key: 'TipoDoc', width: 10 }
        ];

        // Estilo del encabezado
        worksheet.getRow(1).font = { bold: true, size: 11 };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0284C7' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Agregar datos
        result.recordset.forEach(row => {
            const rowData = {
                Fecha: row.Fecha ? new Date(row.Fecha) : null,
                RUC: row.RUC,
                Razon: row.Razon,
                Direccion: row.Direccion,
                Zona: row.Zona,
                CodVen: row.CodVen,
                Vendedor: row.Vendedor,
                Dpto: row.Dpto,
                Provincia: row.Provincia,
                Distrito: row.Distrito,
                Numero: row.Numero,
                codpro: row.codpro,
                NombreProducto: row.NombreProducto,
                Cantidad: row.Cantidad,
                Precio: row.Precio,
                Descuento1: row.Descuento1,
                Descuento2: row.Descuento2,
                Descuento3: row.Descuento3,
                Total: row.Total,
                Linea: row.Linea,
                TipoDoc: row.TipoDoc
            };
            worksheet.addRow(rowData);
        });

        // Formatear columnas numéricas
        worksheet.getColumn('Cantidad').numFmt = '#,##0.00';
        worksheet.getColumn('Precio').numFmt = '#,##0.00';
        worksheet.getColumn('Descuento1').numFmt = '0.00';
        worksheet.getColumn('Descuento2').numFmt = '0.00';
        worksheet.getColumn('Descuento3').numFmt = '0.00';
        worksheet.getColumn('Total').numFmt = '#,##0.00';
        worksheet.getColumn('Fecha').numFmt = 'dd/mm/yyyy';

        // Configurar respuesta
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        
        const fechaFormateada = new Date(fecha).toISOString().split('T')[0];
        const nombreArchivo = `Ventas_AC_Farma_${fechaFormateada}${codigoLaboratorio ? '_Lab' + codigoLaboratorio : ''}.xlsx`;
        
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${nombreArchivo}"`
        );

        // Escribir el archivo
        await workbook.xlsx.write(res);
        res.end();

        console.log('✅ Excel generado exitosamente');

    } catch (error) {
        console.error('❌ Error al exportar Ventas AC Farma:', error);
        
        // Si ya se enviaron headers, no podemos enviar JSON
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Error al exportar Ventas AC Farma',
                error: error.message
            });
        }
    }
};

// Obtener laboratorios disponibles para el filtro
exports.obtenerLaboratoriosAcFarma = async (req, res) => {
    try {
        console.log('🔍 Obteniendo laboratorios disponibles...');

        const query = `
            SELECT DISTINCT 
                LEFT(docdet.CodPro, 2) AS CodLab,
                l.Descripcion
            FROM docdet
            INNER JOIN doccab ON doccab.numero = docdet.numero
            INNER JOIN productos ON productos.codpro = docdet.codpro
            LEFT JOIN Laboratorios l ON LEFT(docdet.CodPro, 2) = l.CodLab
            WHERE doccab.Eliminado = 0
            ORDER BY LEFT(docdet.CodPro, 2)
        `;

        const result = await dbService.executeQuery(query);

        console.log('✅ Laboratorios encontrados:', result.recordset.length);

        res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('❌ Error al obtener laboratorios:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener laboratorios',
            error: error.message
        });
    }
};

