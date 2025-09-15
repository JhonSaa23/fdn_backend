-- Crear índices para optimizar búsquedas en la tabla clientes
-- Estos índices mejorarán significativamente el rendimiento de las consultas

-- Índice compuesto para búsquedas por Razon (nombre de la empresa)
CREATE NONCLUSTERED INDEX idx_clientes_razon 
ON clientes (Razon) 
INCLUDE (Codclie, Documento, Direccion);

-- Índice compuesto para búsquedas por Documento (RUC)
CREATE NONCLUSTERED INDEX idx_clientes_documento 
ON clientes (Documento) 
INCLUDE (Codclie, Razon, Direccion);

-- Índice compuesto para búsquedas por Codclie (código del cliente)
CREATE NONCLUSTERED INDEX idx_clientes_codclie 
ON clientes (Codclie) 
INCLUDE (Razon, Documento, Direccion);

-- Índice adicional para búsquedas por Direccion (dirección del cliente)
CREATE NONCLUSTERED INDEX idx_clientes_direccion 
ON clientes (Direccion) 
INCLUDE (Codclie, Razon, Documento);

-- Verificar que los índices se crearon correctamente
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    c.name AS ColumnName,
    ic.key_ordinal AS KeyOrdinal
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('clientes')
    AND i.name LIKE 'idx_clientes_%'
ORDER BY i.name, ic.key_ordinal;
