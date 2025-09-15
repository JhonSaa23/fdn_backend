-- Índice compuesto para búsquedas por vendedor con campos incluidos
-- Este índice optimiza las consultas que filtran por vendedor
CREATE NONCLUSTERED INDEX idx_clientes_vendedor 
ON clientes (vendedor) 
INCLUDE (Codclie, Razon, Documento, Direccion, Telefono1, Telefono2, Email);

-- Índice compuesto para búsquedas por vendedor + Razon (para búsquedas de texto)
CREATE NONCLUSTERED INDEX idx_clientes_vendedor_razon 
ON clientes (vendedor, Razon) 
INCLUDE (Codclie, Documento, Direccion);

-- Índice compuesto para búsquedas por vendedor + Documento (para búsquedas por RUC)
CREATE NONCLUSTERED INDEX idx_clientes_vendedor_documento 
ON clientes (vendedor, Documento) 
INCLUDE (Codclie, Razon, Direccion);

-- Índice compuesto para búsquedas por vendedor + Codclie (para búsquedas por código)
CREATE NONCLUSTERED INDEX idx_clientes_vendedor_codclie 
ON clientes (vendedor, Codclie) 
INCLUDE (Razon, Documento, Direccion);

-- Verificar que los índices se crearon correctamente
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    c.name AS ColumnName,
    ic.key_ordinal AS KeyOrdinal,
    ic.is_included_column AS IsIncluded
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('clientes')
    AND i.name LIKE 'idx_clientes_vendedor%'
ORDER BY i.name, ic.key_ordinal, ic.is_included_column;
