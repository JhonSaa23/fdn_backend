-- =====================================================
-- VERIFICAR VISTA RUPERO
-- =====================================================

-- Verificar que la vista existe
SELECT 
    IDVista,
    Nombre,
    Ruta,
    Categoria,
    Activo
FROM VistasSistema 
WHERE Ruta = '/rupero/ac-farma' OR Categoria = 'Rupero'
ORDER BY Orden;

-- Verificar permisos asignados
SELECT 
    uv.IDUS,
    u.Nombres,
    u.TipoUsuario,
    v.Nombre as VistaNombre,
    v.Ruta,
    v.Categoria,
    uv.FechaAsignacion
FROM UsuarioVistas uv
INNER JOIN UsersSystems u ON uv.IDUS = u.IDUS
INNER JOIN VistasSistema v ON uv.IDVista = v.IDVista
WHERE v.Categoria = 'Rupero' OR v.Ruta = '/rupero/ac-farma'
ORDER BY u.Nombres, v.Orden;

-- Verificar que la vista tiene la estructura correcta para ser detectada como subruta
SELECT 
    Ruta,
    LEN(Ruta) - LEN(REPLACE(Ruta, '/', '')) as NumeroDeSlash,
    CASE 
        WHEN LEN(Ruta) - LEN(REPLACE(Ruta, '/', '')) > 1 THEN 'Es subruta'
        ELSE 'Es ruta principal'
    END as TipoRuta
FROM VistasSistema 
WHERE Ruta LIKE '/rupero%';
