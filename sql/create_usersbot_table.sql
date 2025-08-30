-- Crear tabla UsersBot para manejar usuarios autorizados del bot
CREATE TABLE UsersBot (
    CodUserBot INT IDENTITY(1,1) PRIMARY KEY,
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

-- Crear índices para optimizar consultas
CREATE INDEX IX_UsersBot_Numero ON UsersBot(Numero);
CREATE INDEX IX_UsersBot_Rol ON UsersBot(Rol);
CREATE INDEX IX_UsersBot_Laboratorio ON UsersBot(Laboratorio);
CREATE INDEX IX_UsersBot_Activo ON UsersBot(Activo);

-- Insertar el administrador principal
INSERT INTO UsersBot (Nombre, Numero, Rol, Laboratorio, Activo, CreadoPor)
VALUES ('Jhon Saavedra', '51931161425', 'ADMIN', NULL, 1, 'SYSTEM');

-- Crear tabla de auditoría para cambios en UsersBot
CREATE TABLE UsersBotAudit (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CodUserBot INT NOT NULL,
    Accion NVARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    ValoresAnteriores NVARCHAR(MAX) NULL,
    ValoresNuevos NVARCHAR(MAX) NULL,
    FechaAccion DATETIME NOT NULL DEFAULT GETDATE(),
    UsuarioAccion NVARCHAR(50) NOT NULL
);

-- Crear trigger para auditoría
CREATE TRIGGER TR_UsersBot_Audit
ON UsersBot
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @Accion NVARCHAR(20);
    DECLARE @CodUserBot INT;
    DECLARE @ValoresAnteriores NVARCHAR(MAX);
    DECLARE @ValoresNuevos NVARCHAR(MAX);
    DECLARE @UsuarioAccion NVARCHAR(50) = SYSTEM_USER;
    
    IF EXISTS(SELECT * FROM INSERTED) AND EXISTS(SELECT * FROM DELETED)
    BEGIN
        SET @Accion = 'UPDATE';
        SELECT @CodUserBot = CodUserBot FROM INSERTED;
        
        SELECT @ValoresAnteriores = 
            '{"CodUserBot":"' + CAST(CodUserBot AS NVARCHAR) + 
            '","Nombre":"' + ISNULL(Nombre, '') + 
            '","Numero":"' + ISNULL(Numero, '') + 
            '","Rol":"' + ISNULL(Rol, '') + 
            '","Laboratorio":"' + ISNULL(Laboratorio, '') + 
            '","Activo":"' + CAST(Activo AS NVARCHAR) + '"}'
        FROM DELETED;
        
        SELECT @ValoresNuevos = 
            '{"CodUserBot":"' + CAST(CodUserBot AS NVARCHAR) + 
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
            '{"CodUserBot":"' + CAST(CodUserBot AS NVARCHAR) + 
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
            '{"CodUserBot":"' + CAST(CodUserBot AS NVARCHAR) + 
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

-- Crear vista para consultas comunes
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
        WHEN Rol = 'TRABAJADOR' THEN 'Trabajador'
        WHEN Rol = 'VENDEDOR' THEN 'Vendedor'
        WHEN Rol = 'REPRESENTANTE' THEN 'Representante'
        WHEN Rol = 'USER' THEN 'Usuario'
        ELSE Rol
    END AS RolDescripcion,
    CASE 
        WHEN Activo = 1 THEN 'Activo'
        ELSE 'Inactivo'
    END AS EstadoDescripcion
FROM UsersBot;

-- Crear procedimiento almacenado para obtener usuarios activos
CREATE PROCEDURE sp_GetActiveUsersBot
AS
BEGIN
    SELECT 
        CodUserBot,
        Nombre,
        Numero,
        Rol,
        Laboratorio,
        Activo,
        FechaCreacion
    FROM UsersBot 
    WHERE Activo = 1
    ORDER BY Nombre;
END;

-- Crear procedimiento para agregar usuario
CREATE PROCEDURE sp_AddUserBot
    @Nombre NVARCHAR(100),
    @Numero NVARCHAR(15),
    @Rol NVARCHAR(20) = 'USER',
    @Laboratorio NVARCHAR(50) = NULL,
    @CreadoPor NVARCHAR(50) = NULL
AS
BEGIN
    BEGIN TRY
        INSERT INTO UsersBot (Nombre, Numero, Rol, Laboratorio, CreadoPor)
        VALUES (@Nombre, @Numero, @Rol, @Laboratorio, @CreadoPor);
        
        SELECT SCOPE_IDENTITY() AS CodUserBot;
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;

-- Crear procedimiento para actualizar usuario
CREATE PROCEDURE sp_UpdateUserBot
    @CodUserBot INT,
    @Nombre NVARCHAR(100),
    @Numero NVARCHAR(15),
    @Rol NVARCHAR(20),
    @Laboratorio NVARCHAR(50) = NULL,
    @Activo BIT = 1,
    @ModificadoPor NVARCHAR(50) = NULL
AS
BEGIN
    BEGIN TRY
        UPDATE UsersBot 
        SET 
            Nombre = @Nombre,
            Numero = @Numero,
            Rol = @Rol,
            Laboratorio = @Laboratorio,
            Activo = @Activo,
            FechaModificacion = GETDATE(),
            ModificadoPor = @ModificadoPor
        WHERE CodUserBot = @CodUserBot;
        
        IF @@ROWCOUNT = 0
            THROW 50000, 'Usuario no encontrado', 1;
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;

-- Crear procedimiento para eliminar usuario (desactivar)
CREATE PROCEDURE sp_DeleteUserBot
    @CodUserBot INT,
    @ModificadoPor NVARCHAR(50) = NULL
AS
BEGIN
    BEGIN TRY
        UPDATE UsersBot 
        SET 
            Activo = 0,
            FechaModificacion = GETDATE(),
            ModificadoPor = @ModificadoPor
        WHERE CodUserBot = @CodUserBot;
        
        IF @@ROWCOUNT = 0
            THROW 50000, 'Usuario no encontrado', 1;
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
