-- =====================================================
-- AGREGAR VISTA RUPERO A LA BASE DE DATOS
-- =====================================================

-- Verificar si la vista "Ac Farma" ya existe
IF NOT EXISTS (SELECT 1 FROM VistasSistema WHERE Ruta = '/rupero/ac-farma')
BEGIN
    -- Insertar la subvista "Ac Farma" en VistasSistema
    INSERT INTO VistasSistema (
        Nombre, 
        Ruta, 
        Categoria, 
        Icono, 
        Orden, 
        Activo,
        FechaCreacion,
        FechaModificacion
    ) VALUES (
        'Ac Farma',
        '/rupero/ac-farma',
        'Rupero',
        'fas fa-table',
        1,
        1,
        GETDATE(),
        GETDATE()
    );
END

-- Obtener el ID de la vista Ac Farma
DECLARE @IDVistaAcFarma INT = (SELECT IDVista FROM VistasSistema WHERE Ruta = '/rupero/ac-farma');

-- Asignar permisos a todos los usuarios administradores para Ac Farma
INSERT INTO UsuarioVistas (IDUS, IDVista, FechaAsignacion)
SELECT 
    u.IDUS,
    @IDVistaAcFarma,
    GETDATE()
FROM UsersSystems u
WHERE u.TipoUsuario = 'Admin' 
  AND u.Activo = 1
  AND NOT EXISTS (
    SELECT 1 FROM UsuarioVistas uv 
    WHERE uv.IDUS = u.IDUS AND uv.IDVista = @IDVistaAcFarma
  );

-- Asignar permisos a todos los usuarios trabajadores para Ac Farma
INSERT INTO UsuarioVistas (IDUS, IDVista, FechaAsignacion)
SELECT 
    u.IDUS,
    @IDVistaAcFarma,
    GETDATE()
FROM UsersSystems u
WHERE u.TipoUsuario = 'Trabajador' 
  AND u.Activo = 1
  AND NOT EXISTS (
    SELECT 1 FROM UsuarioVistas uv 
    WHERE uv.IDUS = u.IDUS AND uv.IDVista = @IDVistaAcFarma
  );

-- Verificar que las vistas se crearon correctamente
SELECT 
    IDVista,
    Nombre,
    Ruta,
    Categoria,
    Activo
FROM VistasSistema 
WHERE Categoria = 'Rupero'
ORDER BY Orden;

-- Verificar que los permisos se asignaron correctamente
SELECT 
    uv.IDUS,
    u.Nombres,
    u.TipoUsuario,
    v.Nombre as VistaNombre,
    v.Ruta
FROM UsuarioVistas uv
INNER JOIN UsersSystems u ON uv.IDUS = u.IDUS
INNER JOIN VistasSistema v ON uv.IDVista = v.IDVista
WHERE v.Categoria = 'Rupero'
ORDER BY u.Nombres, v.Orden;
