-- =====================================================
-- AGREGAR VISTA INFOCORP A VistasSistema
-- =====================================================

INSERT INTO VistasSistema (Ruta, Nombre, Descripcion, Icono, Categoria, Orden) VALUES
('/infocorp', 'Infocorp', 'Gestión de reportes de clientes', 'DocumentTextIcon', 'Clientes', 24);

-- =====================================================
-- ASIGNAR VISTA A USUARIO ADMINISTRADOR (IDUS = 1)
-- =====================================================

INSERT INTO UsuarioVistas (IDUS, IDVista, AsignadoPor) 
SELECT 1, ID, 'Sistema' 
FROM VistasSistema 
WHERE Ruta = '/infocorp';
