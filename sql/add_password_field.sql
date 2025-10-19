-- Agregar campo de contraseña hasheada a la tabla de usuarios
-- Ejecutar este script en la base de datos

-- Verificar si la columna PasswordHash ya existe
IF NOT EXISTS (SELECT * FROM sys.columns 
               WHERE Object_ID = Object_ID('UsersSystems') AND Name = 'PasswordHash')
BEGIN
    -- Agregar la columna PasswordHash
    ALTER TABLE UsersSystems
    ADD PasswordHash NVARCHAR(255) NULL; -- Usar NVARCHAR para almacenar hashes de contraseñas

    PRINT 'Columna PasswordHash agregada a la tabla UsersSystems.';
END
ELSE
BEGIN
    PRINT 'La columna PasswordHash ya existe en la tabla UsersSystems.';
END

-- Actualizar usuarios existentes con contraseñas por defecto
-- NOTA: Estas son contraseñas por defecto que los usuarios deben cambiar
-- Contraseña: "123456" hasheada con bcrypt (salt rounds: 12)
UPDATE UsersSystems 
SET PasswordHash = '$2b$12$sdTFezzimAIdfuumOrAjnevaBvm37WBT475GTp3VGPtSZPbWs8/H2' 
WHERE IDUS = 1 AND PasswordHash IS NULL;

UPDATE UsersSystems 
SET PasswordHash = '$2b$12$sdTFezzimAIdfuumOrAjnevaBvm37WBT475GTp3VGPtSZPbWs8/H2' 
WHERE IDUS = 2 AND PasswordHash IS NULL;

-- Verificar que los campos se agregaron correctamente
SELECT 
    IDUS,
    CodigoInterno,
    Nombres,
    DNI_RUC,
    PasswordHash,
    Activo
FROM UsersSystems 
WHERE PasswordHash IS NOT NULL;

-- Opcional: Si quieres eliminar las columnas de código de acceso antiguas
-- IF EXISTS (SELECT * FROM sys.columns WHERE Object_ID = Object_ID('UsersSystems') AND Name = 'CodigoAcceso')
-- BEGIN
--     ALTER TABLE UsersSystems DROP COLUMN CodigoAcceso;
--     PRINT 'Columna CodigoAcceso eliminada de la tabla UsersSystems.';
-- END

-- IF EXISTS (SELECT * FROM sys.columns WHERE Object_ID = Object_ID('UsersSystems') AND Name = 'CodigoAccesoExpira')
-- BEGIN
--     ALTER TABLE UsersSystems DROP COLUMN CodigoAccesoExpira;
--     PRINT 'Columna CodigoAccesoExpira eliminada de la tabla UsersSystems.';
-- END

-- IF EXISTS (SELECT * FROM sys.columns WHERE Object_ID = Object_ID('UsersSystems') AND Name = 'CodigoAccesoDispositivo')
-- BEGIN
--     ALTER TABLE UsersSystems DROP COLUMN CodigoAccesoDispositivo;
--     PRINT 'Columna CodigoAccesoDispositivo eliminada de la tabla UsersSystems.';
-- END
