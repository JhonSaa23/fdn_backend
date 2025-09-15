-- Índice optimizado para búsqueda de productos con saldos
-- Optimiza la consulta de productos con filtros por almacén
CREATE NONCLUSTERED INDEX idx_saldos_filtro
ON saldos (almacen, codpro)
INCLUDE (saldo);

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
WHERE i.object_id = OBJECT_ID('saldos')
    AND i.name = 'idx_saldos_filtro'
ORDER BY ic.key_ordinal, ic.is_included_column;

-- Verificar si productos.codpro ya tiene índice (debería ser PRIMARY KEY)
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    c.name AS ColumnName,
    ic.key_ordinal AS KeyOrdinal
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('productos')
    AND i.is_primary_key = 1
ORDER BY ic.key_ordinal;
