-- Actualizar la vista vw_UsersBot para manejar todos los roles correctamente
DROP VIEW IF EXISTS vw_UsersBot;

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
