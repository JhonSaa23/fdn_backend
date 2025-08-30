-- Script simple para cambiar CodUserBot de INT IDENTITY a NVARCHAR editable
-- Para la tabla UsersBot que ya existe

-- Paso 1: Eliminar el trigger primero
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

-- Paso 6: Crear una tabla temporal con la nueva estructura
CREATE TABLE UsersBot_New (
    CodUserBot NVARCHAR(20) NOT NULL PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL,
    Numero NVARCHAR(15) NOT NULL UNIQUE,
    Rol NVARCHAR(20) NOT NULL DEFAULT 'USER',
    Laboratorio NVARCHAR(50) NULL,
    Activo BIT NOT NULL DEFAULT 1,
    FechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
    FechaModificacion DATETIME NULL,
    CreadoPor NVARCHAR(50) NULL,
    ModificadoPor NVARCHAR(50) NULL
);

-- Paso 7: Copiar los datos existentes con códigos asignados
INSERT INTO UsersBot_New (CodUserBot, Nombre, Numero, Rol, Laboratorio, Activo, FechaCreacion, FechaModificacion, CreadoPor, ModificadoPor)
SELECT 
    CASE 
        WHEN Rol = 'ADMIN' THEN 'ADMIN001'
        ELSE 'USER001'
    END as CodUserBot,
    Nombre,
    Numero,
    Rol,
    Laboratorio,
    Activo,
    FechaCreacion,
    FechaModificacion,
    CreadoPor,
    ModificadoPor
FROM UsersBot;

-- Paso 8: Eliminar la tabla original y renombrar la nueva
DROP TABLE UsersBot;
EXEC sp_rename 'UsersBot_New', 'UsersBot';

-- Paso 9: Recrear los índices
CREATE INDEX IX_UsersBot_Numero ON UsersBot(Numero);
CREATE INDEX IX_UsersBot_Rol ON UsersBot(Rol);
CREATE INDEX IX_UsersBot_Laboratorio ON UsersBot(Laboratorio);
CREATE INDEX IX_UsersBot_Activo ON UsersBot(Activo);

-- Paso 10: Recrear la tabla de auditoría
CREATE TABLE UsersBotAudit (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CodUserBot NVARCHAR(20) NOT NULL,
    Accion NVARCHAR(20) NOT NULL,
    ValoresAnteriores NVARCHAR(MAX) NULL,
    ValoresNuevos NVARCHAR(MAX) NULL,
    FechaAccion DATETIME NOT NULL DEFAULT GETDATE(),
    UsuarioAccion NVARCHAR(50) NOT NULL
);

-- Paso 11: Recrear el trigger
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

-- Paso 12: Recrear la vista
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
