-- =====================================================
-- VERIFICAR VISTA: v_Jhon_VenMin_ConDescuentos
-- Script para verificar si la vista existe y mostrar su definición
-- =====================================================

-- Verificar si la vista existe
IF EXISTS (SELECT * FROM sys.views WHERE name = 'v_Jhon_VenMin_ConDescuentos')
BEGIN
    PRINT '✅ La vista v_Jhon_VenMin_ConDescuentos EXISTE';
    PRINT '';
    
    -- Mostrar información de la vista
    SELECT 
        'Información de la Vista' AS Tipo,
        name AS NombreVista,
        create_date AS FechaCreacion,
        modify_date AS FechaModificacion
    FROM sys.views
    WHERE name = 'v_Jhon_VenMin_ConDescuentos';
    
    PRINT '';
    PRINT '📋 Columnas de la vista:';
    
    -- Mostrar las columnas de la vista
    SELECT 
        COLUMN_NAME AS NombreColumna,
        DATA_TYPE AS TipoDato,
        IS_NULLABLE AS PermiteNull,
        CHARACTER_MAXIMUM_LENGTH AS LongitudMaxima
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'v_Jhon_VenMin_ConDescuentos'
    ORDER BY ORDINAL_POSITION;
    
    PRINT '';
    PRINT '📝 Definición de la vista:';
    
    -- Mostrar la definición completa de la vista
    SELECT 
        OBJECT_DEFINITION(OBJECT_ID('v_Jhon_VenMin_ConDescuentos')) AS DefinicionVista;
    
    PRINT '';
    PRINT '🧪 Prueba de la vista (primeros 5 registros):';
    
    -- Probar la vista con algunos registros
    SELECT TOP 5 * 
    FROM v_Jhon_VenMin_ConDescuentos;
    
    PRINT '';
    PRINT '📊 Total de registros en la vista:';
    
    -- Contar el total de registros
    SELECT COUNT(*) AS TotalRegistros 
    FROM v_Jhon_VenMin_ConDescuentos;
END
ELSE
BEGIN
    PRINT '❌ La vista v_Jhon_VenMin_ConDescuentos NO EXISTE';
    PRINT '';
    PRINT '💡 Para crear la vista, ejecuta el archivo: crear_vista_venmin_condescuentos.sql';
END
GO

