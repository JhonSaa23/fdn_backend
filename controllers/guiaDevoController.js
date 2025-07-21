const dbService = require('../services/dbService');
const sql = require('mssql');

// DATOS PRODUCTOS PARA CANTIDAD (Productos a Devolver/Canjear)
exports.listarProductosADevolver = async (req, res) => {
    const { codLab } = req.params;
    try {
        console.log('🔍 Iniciando búsqueda de productos para laboratorio:', codLab);
        
        // Limpiar el codLab
        const cleanCodLab = codLab.trim();
        console.log('🧹 CodLab limpio:', cleanCodLab);
        
        // Usar el stored procedure sp_GuiasDevo_xDevolver
        // Nota: El stored procedure espera el codLab con espacios (formato original)
        const codLabWithSpaces = cleanCodLab.padEnd(4, ' '); // Asegurar que tenga 4 caracteres con espacios
        
        console.log('📋 Ejecutando stored procedure con codLab:', `'${codLabWithSpaces}'`);
        
        const result = await dbService.executeQuery(
            `EXEC sp_GuiasDevo_xDevolver @codLab`,
            [{ name: 'codLab', type: sql.NVarChar, value: codLabWithSpaces }]
        );
        
        console.log('✅ Productos encontrados por stored procedure:', result.recordset.length);
        
        // Debug: Mostrar la estructura de los datos devueltos
        if (result.recordset.length > 0) {
            console.log('🔍 Estructura del primer producto:', Object.keys(result.recordset[0]));
            console.log('📋 Datos del primer producto:', result.recordset[0]);
            
            // Verificar específicamente el campo tipodoc
            const primerProducto = result.recordset[0];
            console.log('🔍 Campo tipodoc:', primerProducto.tipodoc);
            console.log('🔍 Campo tipodoc (typeof):', typeof primerProducto.tipodoc);
            console.log('🔍 Todos los campos disponibles:', Object.keys(primerProducto));
            
            // Buscar campos que contengan "tipo" o "doc"
            const camposRelacionados = Object.keys(primerProducto).filter(key => 
                key.toLowerCase().includes('tipo') || 
                key.toLowerCase().includes('doc')
            );
            console.log('🔍 Campos relacionados con tipo/doc:', camposRelacionados);
        }
        
        if (result.recordset.length === 0) {
            console.log('⚠️ No hay productos disponibles para devolución en este laboratorio');
            return res.status(200).json({ 
                success: true, 
                data: [],
                message: 'No hay productos disponibles para devolución en este laboratorio'
            });
        }
        
        console.log('✅ Productos cargados:', result.recordset.length, 'productos disponibles para devolución');
        res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('❌ Error en listarProductosADevolver:', error);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Error al listar productos a devolver', 
            error: error.message,
            details: error.stack
        });
    }
}; 