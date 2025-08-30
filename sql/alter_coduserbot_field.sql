-- Script simple para modificar el campo CodUserBot existente
-- Este script modifica la tabla UsersBot que ya existe

-- Paso 1: Crear una tabla temporal con la nueva estructura
CREATE TABLE UsersBot_Temp (
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

-- Paso 2: Copiar los datos existentes, asignando códigos manuales
INSERT INTO UsersBot_Temp (CodUserBot, Nombre, Numero, Rol, Laboratorio, Activo, FechaCreacion, FechaModificacion, CreadoPor, ModificadoPor)
SELECT 
    CASE 
        WHEN Rol = 'ADMIN' THEN 'ADMIN001'
        ELSE 'USER' + RIGHT('000' + CAST(ROW_NUMBER() OVER (ORDER BY FechaCreacion) AS VARCHAR), 3)
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

-- Paso 3: Eliminar la tabla original y renombrar la temporal
DROP TABLE UsersBot;
EXEC sp_rename 'UsersBot_Temp', 'UsersBot';

-- Paso 4: Recrear los índices
CREATE INDEX IX_UsersBot_Numero ON UsersBot(Numero);
CREATE INDEX IX_UsersBot_Rol ON UsersBot(Rol);
CREATE INDEX IX_UsersBot_Laboratorio ON UsersBot(Laboratorio);
CREATE INDEX IX_UsersBot_Activo ON UsersBot(Activo);

-- Paso 5: Actualizar la tabla de auditoría si existe
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'UsersBotAudit')
BEGIN
    -- Eliminar la tabla de auditoría existente
    DROP TABLE UsersBotAudit;
    
    -- Recrear con el nuevo tipo de dato
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

-- Paso 6: Recrear el trigger de auditoría
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

-- Mensaje de confirmación
PRINT 'Campo CodUserBot modificado exitosamente a NVARCHAR(20) editable.';
PRINT 'Los usuarios existentes tienen códigos asignados automáticamente:';
PRINT '- Admin: ADMIN001';
PRINT '- Usuarios: USER001, USER002, etc.';
