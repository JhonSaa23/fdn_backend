-- Verificar estructura de la tabla saldos
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'saldos'
ORDER BY ORDINAL_POSITION;

-- Verificar algunos registros de ejemplo para entender la estructura
SELECT TOP 5 *
FROM saldos;

-- Verificar si hay alguna columna que indique eliminación
SELECT 
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'saldos'
    AND (COLUMN_NAME LIKE '%elimin%' OR COLUMN_NAME LIKE '%delete%' OR COLUMN_NAME LIKE '%activo%')
ORDER BY ORDINAL_POSITION;
