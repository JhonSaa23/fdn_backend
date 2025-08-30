-- Script final para cambiar CodUserBot de INT IDENTITY a NVARCHAR editable
-- Para la tabla UsersBot que ya existe

-- Paso 1: Eliminar el trigger primero (porque hace referencia a la columna)
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_UsersBot_Audit')
    DROP TRIGGER TR_UsersBot_Audit;

-- Paso 2: Eliminar la vista
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_UsersBot')
    DROP VIEW vw_UsersBot;

-- Paso 3: Eliminar los stored procedures
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GetActiveUsersBot')
    DROP PROCEDURE sp_GetActiveUsersBot;

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_AddUserBot')
    DROP PROCEDURE sp_AddUserBot;

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_UpdateUserBot')
    DROP PROCEDURE sp_UpdateUserBot;

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_DeleteUserBot')
    DROP PROCEDURE sp_DeleteUserBot;

-- Paso 4: Eliminar la tabla de auditoría
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'UsersBotAudit')
    DROP TABLE UsersBotAudit;

-- Paso 5: Eliminar los índices
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UsersBot_Numero')
    DROP INDEX IX_UsersBot_Numero ON UsersBot;

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UsersBot_Rol')
    DROP INDEX IX_UsersBot_Rol ON UsersBot;

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UsersBot_Laboratorio')
    DROP INDEX IX_UsersBot_Laboratorio ON UsersBot;

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UsersBot_Activo')
    DROP INDEX IX_UsersBot_Activo ON UsersBot;

-- Paso 6: Eliminar la restricción PRIMARY KEY (SQL Server la nombra automáticamente)
-- Primero obtenemos el nombre real de la restricción
DECLARE @PKConstraintName NVARCHAR(128);

SELECT @PKConstraintName = tc.CONSTRAINT_NAME
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
WHERE tc.TABLE_NAME = 'UsersBot' 
AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY';

PRINT 'Eliminando restricción: ' + @PKConstraintName;

-- Eliminar la restricción usando el nombre real
DECLARE @DropConstraintSQL NVARCHAR(MAX) = 'ALTER TABLE UsersBot DROP CONSTRAINT [' + @PKConstraintName + ']';
EXEC sp_executesql @DropConstraintSQL;

-- Paso 7: Eliminar la columna CodUserBot
ALTER TABLE UsersBot DROP COLUMN CodUserBot;

-- Paso 8: Agregar la columna con el nuevo tipo
ALTER TABLE UsersBot ADD CodUserBot NVARCHAR(20) NOT NULL;

-- Paso 9: Asignar códigos a los usuarios existentes
UPDATE UsersBot 
SET CodUserBot = CASE 
    WHEN Rol = 'ADMIN' THEN 'ADMIN001'
    ELSE 'USER001'
END;

-- Paso 10: Agregar la restricción PRIMARY KEY
ALTER TABLE UsersBot ADD CONSTRAINT PK_UsersBot PRIMARY KEY (CodUserBot);

-- Paso 11: Recrear los índices
CREATE INDEX IX_UsersBot_Numero ON UsersBot(Numero);
CREATE INDEX IX_UsersBot_Rol ON UsersBot(Rol);
CREATE INDEX IX_UsersBot_Laboratorio ON UsersBot(Laboratorio);
CREATE INDEX IX_UsersBot_Activo ON UsersBot(Activo);

-- Paso 12: Recrear la tabla de auditoría
CREATE TABLE UsersBotAudit (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CodUserBot NVARCHAR(20) NOT NULL,
    Accion NVARCHAR(20) NOT NULL,
    ValoresAnteriores NVARCHAR(MAX) NULL,
    ValoresNuevos NVARCHAR(MAX) NULL,
    FechaAccion DATETIME NOT NULL DEFAULT GETDATE(),
    UsuarioAccion NVARCHAR(50) NOT NULL
);

-- Paso 13: Recrear el trigger
CREATE TRIGGER TR_UsersBot_Audit
ON UsersBot
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Accion NVARCHAR(20);
    DECLARE @CodUserBot NVARCHAR(20);
    DECLARE @ValoresAnteriores NVARCHAR(MAX);
    DECLARE @ValoresNuevos NVARCHAR(MAX);
    DECLARE @UsuarioAccion NVARCHAR(50) = SYSTEM_USER;
    
    IF EXISTS(SELECT * FROM INSERTED) AND EXISTS(SELECT * FROM DELETED)
    BEGIN
        SET @Accion = 'UPDATE';
        SELECT @CodUserBot = CodUserBot FROM INSERTED;
        
        SELECT @ValoresAnteriores = 
            '{"CodUserBot":"' + ISNULL(CodUserBot, '') + 
            '","Nombre":"' + ISNULL(Nombre, '') + 
            '","Numero":"' + ISNULL(Numero, '') + 
            '","Rol":"' + ISNULL(Rol, '') + 
            '","Laboratorio":"' + ISNULL(Laboratorio, '') + 
            '","Activo":"' + CAST(Activo AS NVARCHAR) + '"}'
        FROM DELETED;
        
        SELECT @ValoresNuevos = 
            '{"CodUserBot":"' + ISNULL(CodUserBot, '') + 
            '","Nombre":"' + ISNULL(Nombre, '') + 
            '","Numero":"' + ISNULL(Numero, '') + 
            '","Rol":"' + ISNULL(Rol, '') + 
            '","Laboratorio":"' + ISNULL(Laboratorio, '') + 
            '","Activo":"' + CAST(Activo AS NVARCHAR) + '"}'
        FROM INSERTED;
    END
    ELSE IF EXISTS(SELECT * FROM INSERTED)
    BEGIN
        SET @Accion = 'INSERT';
        SELECT @CodUserBot = CodUserBot FROM INSERTED;
        
        SELECT @ValoresNuevos = 
            '{"CodUserBot":"' + ISNULL(CodUserBot, '') + 
            '","Nombre":"' + ISNULL(Nombre, '') + 
            '","Numero":"' + ISNULL(Numero, '') + 
            '","Rol":"' + ISNULL(Rol, '') + 
            '","Laboratorio":"' + ISNULL(Laboratorio, '') + 
            '","Activo":"' + CAST(Activo AS NVARCHAR) + '"}'
        FROM INSERTED;
    END
    ELSE IF EXISTS(SELECT * FROM DELETED)
    BEGIN
        SET @Accion = 'DELETE';
        SELECT @CodUserBot = CodUserBot FROM DELETED;
        
        SELECT @ValoresAnteriores = 
            '{"CodUserBot":"' + ISNULL(CodUserBot, '') + 
            '","Nombre":"' + ISNULL(Nombre, '') + 
            '","Numero":"' + ISNULL(Numero, '') + 
            '","Rol":"' + ISNULL(Rol, '') + 
            '","Laboratorio":"' + ISNULL(Laboratorio, '') + 
            '","Activo":"' + CAST(Activo AS NVARCHAR) + '"}'
        FROM DELETED;
    END
    
    INSERT INTO UsersBotAudit (CodUserBot, Accion, ValoresAnteriores, ValoresNuevos, UsuarioAccion)
    VALUES (@CodUserBot, @Accion, @ValoresAnteriores, @ValoresNuevos, @UsuarioAccion);
END;

-- Paso 14: Recrear la vista
CREATE VIEW vw_UsersBot AS
SELECT 
    CodUserBot,
    Nombre,
    Numero,
    Rol,
    Laboratorio,
    Activo,
    FechaCreacion,
    FechaModificacion,
    CreadoPor,
    ModificadoPor,
    CASE 
        WHEN Rol = 'ADMIN' THEN 'Administrador'
        WHEN Rol = 'USER' THEN 'Usuario'
        ELSE Rol
    END AS RolDescripcion,
    CASE 
        WHEN Activo = 1 THEN 'Activo'
        ELSE 'Inactivo'
    END AS EstadoDescripcion
FROM UsersBot;

PRINT 'Campo CodUserBot modificado exitosamente a NVARCHAR(20) editable.';
PRINT 'Tu usuario admin ahora tiene el código: ADMIN001';
PRINT 'Todos los objetos (índices, trigger, auditoría, vista) han sido recreados.';
