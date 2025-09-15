-- Índice optimizado para búsqueda por nombre de productos
-- Optimiza las consultas LIKE en la columna nombre

-- Verificar si ya existe un índice en nombre
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

-- Crear índice en nombre de productos
CREATE NONCLUSTERED INDEX idx_productos_nombre
ON productos (nombre)
INCLUDE (CodPro, PventaMa, ComisionH, comisionV, comisionR);

-- Verificar que el índice se creó correctamente
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
    AND i.name = 'idx_productos_nombre'
ORDER BY ic.key_ordinal, ic.is_included_column;
