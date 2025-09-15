-- Verificar estado de los índices para búsqueda de productos

-- 1. Verificar índice de productos (debería existir como PK)
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    c.name AS ColumnName,
    ic.key_ordinal AS KeyOrdinal,
    ic.is_included_column AS IsIncluded
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('productos')
    AND i.is_primary_key = 1
ORDER BY ic.key_ordinal;

-- 2. Verificar índice de saldos (el que creamos)
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    c.name AS ColumnName,
    ic.key_ordinal AS KeyOrdinal,
    ic.is_included_column AS IsIncluded
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('saldos')
    AND i.name = 'idx_saldos_filtro'
ORDER BY ic.key_ordinal, ic.is_included_column;

-- 3. Verificar si el índice de saldos existe
SELECT 
    name,
    type_desc,
    is_unique,
    is_primary_key
FROM sys.indexes
WHERE object_id = OBJECT_ID('saldos')
    AND name = 'idx_saldos_filtro';

-- 4. Si no existe, crear el índice
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('saldos') AND name = 'idx_saldos_filtro')
BEGIN
    PRINT 'Creando índice idx_saldos_filtro...'
    CREATE NONCLUSTERED INDEX idx_saldos_filtro
    ON saldos (almacen, codpro)
    INCLUDE (saldo);
    PRINT 'Índice creado exitosamente'
END
ELSE
BEGIN
    PRINT 'El índice idx_saldos_filtro ya existe'
END

-- 5. Verificar estructura de tabla saldos para confirmar columnas
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'saldos'
ORDER BY ORDINAL_POSITION;

-- 6. Verificar si existe índice en nombre de productos
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    c.name AS ColumnName,
    ic.key_ordinal AS KeyOrdinal,
    ic.is_included_column AS IsIncluded
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('productos')
    AND c.name = 'nombre'
ORDER BY ic.key_ordinal;

-- 7. Crear índice en nombre de productos si no existe
IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('productos')
        AND c.name = 'nombre'
        AND ic.is_included_column = 0
)
BEGIN
    PRINT 'Creando índice en nombre de productos...'
    CREATE NONCLUSTERED INDEX idx_productos_nombre
    ON productos (nombre)
    INCLUDE (CodPro, PventaMa, ComisionH, comisionV, comisionR);
    PRINT 'Índice de nombre creado exitosamente'
END
ELSE
BEGIN
    PRINT 'El índice de nombre de productos ya existe'
END
