-- =====================================================
-- AGREGAR VISTA VENTAS AC FARMA A VistasSistema
-- =====================================================

INSERT INTO VistasSistema (Ruta, Nombre, Descripcion, Icono, Categoria, Orden) VALUES
('/reportes/ventas-ac-farma', 'Ventas AC Farma', 'Reporte de ventas AC Farma', 'DocumentTextIcon', 'Reportes', 9);

-- =====================================================
-- ASIGNAR VISTA A USUARIO ADMINISTRADOR (IDUS = 1)
-- =====================================================

INSERT INTO UsuarioVistas (IDUS, IDVista, AsignadoPor) 
SELECT 1, ID, 'Sistema' 
FROM VistasSistema 
WHERE Ruta = '/reportes/ventas-ac-farma';

