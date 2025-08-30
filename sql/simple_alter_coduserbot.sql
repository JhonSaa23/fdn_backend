-- Script simple para cambiar CodUserBot de INT IDENTITY a NVARCHAR editable
-- Solo para cuando tienes pocos usuarios (idealmente solo el admin)

-- Paso 1: Agregar una columna temporal
ALTER TABLE UsersBot ADD CodUserBot_New NVARCHAR(20) NULL;

-- Paso 2: Actualizar la columna temporal con códigos
UPDATE UsersBot 
SET CodUserBot_New = CASE 
    WHEN Rol = 'ADMIN' THEN 'ADMIN001'
    ELSE 'USER001'
END;

-- Paso 3: Eliminar la columna original y renombrar la nueva
ALTER TABLE UsersBot DROP CONSTRAINT PK_UsersBot;
ALTER TABLE UsersBot DROP COLUMN CodUserBot;
EXEC sp_rename 'UsersBot.CodUserBot_New', 'CodUserBot', 'COLUMN';
ALTER TABLE UsersBot ADD CONSTRAINT PK_UsersBot PRIMARY KEY (CodUserBot);

-- Paso 4: Actualizar la tabla de auditoría
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'UsersBotAudit')
BEGIN
    DROP TABLE UsersBotAudit;
    
    CREATE TABLE UsersBotAudit (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CodUserBot NVARCHAR(20) NOT NULL,
        Accion NVARCHAR(20) NOT NULL,
        ValoresAnteriores NVARCHAR(MAX) NULL,
        ValoresNuevos NVARCHAR(MAX) NULL,
        FechaAccion DATETIME NOT NULL DEFAULT GETDATE(),
        UsuarioAccion NVARCHAR(50) NOT NULL
    );
END

-- Paso 5: Recrear el trigger
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_UsersBot_Audit')
    DROP TRIGGER TR_UsersBot_Audit;

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

PRINT 'Campo CodUserBot modificado exitosamente a NVARCHAR(20) editable.';
PRINT 'Tu usuario admin ahora tiene el código: ADMIN001';
