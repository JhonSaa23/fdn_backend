-- Script para modificar el campo CodUserBot de auto-incrementable a editable
-- Ejecutar este script después de haber creado la tabla UsersBot

-- Paso 1: Eliminar la restricción IDENTITY del campo CodUserBot
-- Primero necesitamos crear una nueva tabla con la estructura deseada
CREATE TABLE UsersBot_New (
    CodUserBot NVARCHAR(20) NOT NULL PRIMARY KEY, -- Cambiado a NVARCHAR(20) para permitir códigos alfanuméricos
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

-- Paso 2: Copiar los datos existentes (si los hay)
-- Nota: Si ya hay datos, necesitarás proporcionar valores para CodUserBot
-- Por ahora asumimos que la tabla está vacía o solo tiene el admin inicial
INSERT INTO UsersBot_New (CodUserBot, Nombre, Numero, Rol, Laboratorio, Activo, FechaCreacion, FechaModificacion, CreadoPor, ModificadoPor)
SELECT 
    'ADMIN001' as CodUserBot, -- Código manual para el admin
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

-- Paso 3: Eliminar la tabla original y renombrar la nueva
DROP TABLE UsersBot;
EXEC sp_rename 'UsersBot_New', 'UsersBot';

-- Paso 4: Recrear los índices
CREATE INDEX IX_UsersBot_Numero ON UsersBot(Numero);
CREATE INDEX IX_UsersBot_Rol ON UsersBot(Rol);
CREATE INDEX IX_UsersBot_Laboratorio ON UsersBot(Laboratorio);
CREATE INDEX IX_UsersBot_Activo ON UsersBot(Activo);

-- Paso 5: Actualizar el trigger de auditoría para manejar el nuevo tipo de dato
-- Primero eliminamos el trigger existente
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_UsersBot_Audit')
    DROP TRIGGER TR_UsersBot_Audit;

-- Recreamos el trigger con el nuevo tipo de dato
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

-- Paso 6: Actualizar la tabla de auditoría para manejar el nuevo tipo de dato
-- Primero eliminamos la tabla de auditoría existente
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'UsersBotAudit')
    DROP TABLE UsersBotAudit;

-- Recreamos la tabla de auditoría
CREATE TABLE UsersBotAudit (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CodUserBot NVARCHAR(20) NOT NULL, -- Cambiado para coincidir con el nuevo tipo
    Accion NVARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    ValoresAnteriores NVARCHAR(MAX) NULL,
    ValoresNuevos NVARCHAR(MAX) NULL,
    FechaAccion DATETIME NOT NULL DEFAULT GETDATE(),
    UsuarioAccion NVARCHAR(50) NOT NULL
);

-- Paso 7: Actualizar los stored procedures para manejar el nuevo tipo de dato
-- Eliminar procedures existentes si los hay
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'SP_UsersBot_GetAll')
    DROP PROCEDURE SP_UsersBot_GetAll;

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'SP_UsersBot_GetById')
    DROP PROCEDURE SP_UsersBot_GetById;

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'SP_UsersBot_Create')
    DROP PROCEDURE SP_UsersBot_Create;

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'SP_UsersBot_Update')
    DROP PROCEDURE SP_UsersBot_Update;

IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'SP_UsersBot_Delete')
    DROP PROCEDURE SP_UsersBot_Delete;

-- Recrear los stored procedures
CREATE PROCEDURE SP_UsersBot_GetAll
AS
BEGIN
    SELECT * FROM UsersBot ORDER BY Nombre;
END;

CREATE PROCEDURE SP_UsersBot_GetById
    @CodUserBot NVARCHAR(20)
AS
BEGIN
    SELECT * FROM UsersBot WHERE CodUserBot = @CodUserBot;
END;

CREATE PROCEDURE SP_UsersBot_Create
    @CodUserBot NVARCHAR(20),
    @Nombre NVARCHAR(100),
    @Numero NVARCHAR(15),
    @Rol NVARCHAR(20) = 'USER',
    @Laboratorio NVARCHAR(50) = NULL,
    @Activo BIT = 1,
    @CreadoPor NVARCHAR(50) = NULL
AS
BEGIN
    INSERT INTO UsersBot (CodUserBot, Nombre, Numero, Rol, Laboratorio, Activo, CreadoPor)
    VALUES (@CodUserBot, @Nombre, @Numero, @Rol, @Laboratorio, @Activo, @CreadoPor);
    
    SELECT SCOPE_IDENTITY() as Id;
END;

CREATE PROCEDURE SP_UsersBot_Update
    @CodUserBot NVARCHAR(20),
    @Nombre NVARCHAR(100),
    @Numero NVARCHAR(15),
    @Rol NVARCHAR(20),
    @Laboratorio NVARCHAR(50) = NULL,
    @Activo BIT,
    @ModificadoPor NVARCHAR(50) = NULL
AS
BEGIN
    UPDATE UsersBot 
    SET Nombre = @Nombre,
        Numero = @Numero,
        Rol = @Rol,
        Laboratorio = @Laboratorio,
        Activo = @Activo,
        FechaModificacion = GETDATE(),
        ModificadoPor = @ModificadoPor
    WHERE CodUserBot = @CodUserBot;
END;

CREATE PROCEDURE SP_UsersBot_Delete
    @CodUserBot NVARCHAR(20)
AS
BEGIN
    UPDATE UsersBot SET Activo = 0 WHERE CodUserBot = @CodUserBot;
END;

-- Mensaje de confirmación
PRINT 'Tabla UsersBot modificada exitosamente. El campo CodUserBot ahora es editable (NVARCHAR(20)).';
PRINT 'El usuario admin tiene el código: ADMIN001';
