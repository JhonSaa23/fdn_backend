-- =====================================================
-- FIX VISTA RUPERO - ASEGURAR ESTRUCTURA CORRECTA
-- =====================================================

-- Verificar si la vista existe y tiene la estructura correcta
IF EXISTS (SELECT 1 FROM VistasSistema WHERE Ruta = '/rupero/ac-farma')
BEGIN
    PRINT 'Vista Ac Farma ya existe, verificando estructura...';
    
    -- Verificar que tenga la categoría correcta
    UPDATE VistasSistema 
    SET Categoria = 'Rupero'
    WHERE Ruta = '/rupero/ac-farma' AND Categoria != 'Rupero';
    
    PRINT 'Categoría actualizada a Rupero';
END
ELSE
BEGIN
    PRINT 'Creando vista Ac Farma...';
    
    -- Insertar la vista Ac Farma
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
    
    PRINT 'Vista Ac Farma creada';
END

-- Obtener el ID de la vista
DECLARE @IDVistaAcFarma INT = (SELECT IDVista FROM VistasSistema WHERE Ruta = '/rupero/ac-farma');

-- Asignar permisos a todos los usuarios si no los tienen
INSERT INTO UsuarioVistas (IDUS, IDVista, FechaAsignacion)
SELECT 
    u.IDUS,
    @IDVistaAcFarma,
    GETDATE()
FROM UsersSystems u
WHERE u.Activo = 1
  AND NOT EXISTS (
    SELECT 1 FROM UsuarioVistas uv 
    WHERE uv.IDUS = u.IDUS AND uv.IDVista = @IDVistaAcFarma
  );

PRINT 'Permisos asignados a usuarios';

-- Verificar resultado final
SELECT 
    'RESULTADO FINAL:' as Estado,
    IDVista,
    Nombre,
    Ruta,
    Categoria,
    Activo
FROM VistasSistema 
WHERE Ruta = '/rupero/ac-farma';

SELECT 
    'PERMISOS ASIGNADOS:' as Estado,
    COUNT(*) as TotalPermisos
FROM UsuarioVistas uv
INNER JOIN VistasSistema v ON uv.IDVista = v.IDVista
WHERE v.Ruta = '/rupero/ac-farma';
