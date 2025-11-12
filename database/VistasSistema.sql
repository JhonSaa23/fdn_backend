-- =====================================================
-- TABLA: VistasSistema
-- Sistema de vistas dinámicas del sistema
-- =====================================================

CREATE TABLE VistasSistema (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Ruta VARCHAR(100) NOT NULL UNIQUE,                    -- Ruta de la vista (ej: /clientes)
    Nombre VARCHAR(100) NOT NULL,                         -- Nombre amigable (ej: Clientes)
    Descripcion VARCHAR(255),                             -- Descripción de la vista
    Icono VARCHAR(50),                                    -- Nombre del icono (ej: UserGroupIcon)
    Categoria VARCHAR(50) DEFAULT 'General',              -- Categoría para agrupar
    Orden INT DEFAULT 0,                                  -- Orden de aparición
    Activo BIT DEFAULT 1,                                 -- Si la vista está activa
    FechaCreacion DATETIME DEFAULT GETDATE(),             -- Fecha de creación
    FechaModificacion DATETIME DEFAULT GETDATE()          -- Fecha de modificación
);

-- =====================================================
-- TABLA: UsuarioVistas
-- Relación entre usuarios y vistas permitidas
-- =====================================================

CREATE TABLE UsuarioVistas (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    IDUS INT NOT NULL,                                    -- ID del usuario
    IDVista INT NOT NULL,                                 -- ID de la vista
    FechaAsignacion DATETIME DEFAULT GETDATE(),           -- Fecha de asignación
    AsignadoPor VARCHAR(50),                              -- Quién asignó el permiso
    
    -- Constraints
    CONSTRAINT FK_UsuarioVistas_Usuario FOREIGN KEY (IDUS) REFERENCES UsersSystems(IDUS) ON DELETE CASCADE,
    CONSTRAINT FK_UsuarioVistas_Vista FOREIGN KEY (IDVista) REFERENCES VistasSistema(ID) ON DELETE CASCADE,
    CONSTRAINT UK_UsuarioVistas UNIQUE (IDUS, IDVista)    -- Un usuario no puede tener la misma vista duplicada
);

-- =====================================================
-- INSERTAR VISTAS DEL SISTEMA
-- =====================================================

INSERT INTO VistasSistema (Ruta, Nombre, Descripcion, Icono, Categoria, Orden) VALUES
('/dashboard', 'Dashboard', 'Panel principal del sistema', 'HomeIcon', 'Principal', 1),
('/medifarma', 'Medifarma', 'Importar datos de Medifarma', 'ArrowUpTrayIcon', 'Importar', 2),
('/bcp', 'BCP', 'Importar datos del BCP', 'ArrowUpTrayIcon', 'Importar', 3),
('/promociones', 'Promociones', 'Gestión de promociones', 'TagIcon', 'Ventas', 4),
('/bonificaciones', 'Bonificaciones', 'Gestión de bonificaciones', 'GiftIcon', 'Ventas', 5),
('/saldos', 'Saldos', 'Consulta de saldos', 'ArchiveBoxIcon', 'Finanzas', 6),
('/movimientos', 'Movimientos', 'Consulta de movimientos', 'ArrowDownTrayIcon', 'Finanzas', 7),
('/clientes', 'Clientes', 'Gestión de clientes', 'UserGroupIcon', 'Clientes', 8),
('/clie-vend', 'Clie_Vend', 'Relación clientes-vendedores', 'UserGroupIcon', 'Clientes', 9),
('/pedidos', 'Pedidos', 'Gestión de pedidos', 'ShoppingCartIcon', 'Ventas', 10),
('/usersbot', 'Usuarios Bot', 'Gestión de usuarios del bot', 'UserGroupIcon', 'Administración', 11),
('/gestion-usuarios', 'Gestión Usuarios', 'Administración de usuarios del sistema', 'UserGroupIcon', 'Administración', 12),
('/escalas', 'Escalas', 'Gestión de escalas', 'ChartBarIcon', 'Ventas', 13),
('/kardex-tabla', 'Kardex', 'Consulta de kardex', 'TableCellsIcon', 'Inventario', 14),
('/guias', 'Guías', 'Gestión de guías', 'TruckIcon', 'Logística', 15),
('/multi-accion', 'Multi Acción', 'Acciones múltiples', 'Bars3Icon', 'Herramientas', 16),
('/consulta-productos', 'Consulta Productos', 'Búsqueda de productos', 'MagnifyingGlassIcon', 'Inventario', 17),
('/devolucion-canje', 'Devolución Canje', 'Gestión de devoluciones', 'ArrowDownTrayIcon', 'Ventas', 18),
('/reporte-codpro', 'Reporte CodPro', 'Reporte de códigos de productos', 'DocumentTextIcon', 'Reportes', 19),
('/reportes/picking-procter', 'Picking Procter', 'Reporte de picking Procter', 'DocumentTextIcon', 'Reportes', 20),
('/reportes/concurso', 'Concurso', 'Reporte de concurso', 'DocumentTextIcon', 'Reportes', 21),
('/reportes/loreal-notas', 'Notas Loreal', 'Reporte de notas Loreal', 'DocumentTextIcon', 'Reportes', 22),
('/reportes/compras-laboratorio', 'Compras por Laboratorio', 'Reporte de compras por laboratorio', 'DocumentTextIcon', 'Reportes', 23),
('/buscar-productos', 'Buscar Productos', 'Búsqueda avanzada de productos por nombre, lote y código de barras', 'MagnifyingGlassIcon', 'Inventario', 24);

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

CREATE INDEX IX_VistasSistema_Ruta ON VistasSistema(Ruta);
CREATE INDEX IX_VistasSistema_Categoria ON VistasSistema(Categoria);
CREATE INDEX IX_VistasSistema_Activo ON VistasSistema(Activo);
CREATE INDEX IX_UsuarioVistas_IDUS ON UsuarioVistas(IDUS);
CREATE INDEX IX_UsuarioVistas_IDVista ON UsuarioVistas(IDVista);

-- =====================================================
-- PROCEDIMIENTOS ALMACENADOS
-- =====================================================

-- Obtener todas las vistas del sistema
CREATE PROCEDURE sp_ObtenerVistasSistema
AS
BEGIN
    SELECT 
        ID, Ruta, Nombre, Descripcion, Icono, Categoria, Orden, Activo
    FROM VistasSistema 
    WHERE Activo = 1
    ORDER BY Orden, Nombre;
END;

-- Obtener vistas permitidas para un usuario
CREATE PROCEDURE sp_ObtenerVistasUsuario
    @IDUS INT
AS
BEGIN
    SELECT 
        v.ID, v.Ruta, v.Nombre, v.Descripcion, v.Icono, v.Categoria, v.Orden
    FROM VistasSistema v
    INNER JOIN UsuarioVistas uv ON v.ID = uv.IDVista
    WHERE uv.IDUS = @IDUS AND v.Activo = 1
    ORDER BY v.Orden, v.Nombre;
END;

-- Asignar vista a usuario
CREATE PROCEDURE sp_AsignarVistaUsuario
    @IDUS INT,
    @IDVista INT,
    @AsignadoPor VARCHAR(50) = NULL
AS
BEGIN
    BEGIN TRY
        INSERT INTO UsuarioVistas (IDUS, IDVista, AsignadoPor)
        VALUES (@IDUS, @IDVista, @AsignadoPor);
        
        SELECT 'Vista asignada exitosamente' AS Mensaje;
    END TRY
    BEGIN CATCH
        SELECT 'Error al asignar vista: ' + ERROR_MESSAGE() AS Mensaje;
    END CATCH
END;

-- Remover vista de usuario
CREATE PROCEDURE sp_RemoverVistaUsuario
    @IDUS INT,
    @IDVista INT
AS
BEGIN
    DELETE FROM UsuarioVistas 
    WHERE IDUS = @IDUS AND IDVista = @IDVista;
    
    SELECT 'Vista removida exitosamente' AS Mensaje;
END;

-- Obtener vistas disponibles para asignar a un usuario
CREATE PROCEDURE sp_ObtenerVistasDisponibles
    @IDUS INT
AS
BEGIN
    SELECT 
        v.ID, v.Ruta, v.Nombre, v.Descripcion, v.Icono, v.Categoria, v.Orden,
        CASE WHEN uv.IDVista IS NOT NULL THEN 1 ELSE 0 END AS Asignada
    FROM VistasSistema v
    LEFT JOIN UsuarioVistas uv ON v.ID = uv.IDVista AND uv.IDUS = @IDUS
    WHERE v.Activo = 1
    ORDER BY v.Orden, v.Nombre;
END;

-- =====================================================
-- PROCEDIMIENTO ALMACENADO: BÚSQUEDA DE PRODUCTOS
-- =====================================================

-- Búsqueda de productos por nombre, lote y código de barras
CREATE PROCEDURE sp_BuscarProductos
    @Busqueda VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Limpiar la búsqueda
    DECLARE @BusquedaLimpia VARCHAR(255) = LTRIM(RTRIM(@Busqueda));
    
    -- Verificar que la búsqueda tenga al menos 1 carácter
    IF LEN(@BusquedaLimpia) < 1
    BEGIN
        SELECT 
            p.codpro,
            p.CodBar,
            p.Nombre,
            s.almacen,
            s.lote,
            s.vencimiento,
            s.saldo
        FROM productos p
        LEFT JOIN Saldos s ON p.codpro = s.codpro
        WHERE 1 = 0; -- Retornar conjunto vacío si la búsqueda está vacía
        RETURN;
    END;
    
    -- Si tiene menos de 3 caracteres, solo buscar si es un código numérico (código de barras)
    -- Verificar si es numérico intentando convertir a número
    DECLARE @EsNumerico BIT = 0;
    BEGIN TRY
        DECLARE @NumeroTest FLOAT = CAST(@BusquedaLimpia AS FLOAT);
        SET @EsNumerico = 1;
    END TRY
    BEGIN CATCH
        SET @EsNumerico = 0;
    END CATCH;
    
    IF LEN(@BusquedaLimpia) < 3 AND @EsNumerico = 1
    BEGIN
        -- Es un código numérico corto, permitir búsqueda exacta
        -- Buscar por código de producto exacto o código de barras exacto
        SELECT 
            p.codpro,
            p.CodBar,
            p.Nombre,
            s.almacen,
            s.lote,
            s.vencimiento,
            s.saldo
        FROM productos p
        LEFT JOIN Saldos s ON p.codpro = s.codpro
        WHERE LTRIM(RTRIM(p.codpro)) = @BusquedaLimpia
           OR (p.CodBar IS NOT NULL AND LTRIM(RTRIM(p.CodBar)) = @BusquedaLimpia)
        ORDER BY 
            p.Nombre,
            s.almacen,
            s.vencimiento;
        RETURN;
    END;
    
    -- Si tiene menos de 3 caracteres y no es numérico, retornar vacío
    IF LEN(@BusquedaLimpia) < 3
    BEGIN
        SELECT 
            p.codpro,
            p.CodBar,
            p.Nombre,
            s.almacen,
            s.lote,
            s.vencimiento,
            s.saldo
        FROM productos p
        LEFT JOIN Saldos s ON p.codpro = s.codpro
        WHERE 1 = 0; -- Retornar conjunto vacío
        RETURN;
    END;
    
    -- Búsqueda: primero encontrar productos que coincidan con la búsqueda
    -- y luego obtener sus saldos
    WITH ProductosEncontrados AS (
        SELECT DISTINCT p.codpro
        FROM productos p
        WHERE (
            -- Búsqueda por nombre (LIKE)
            LTRIM(RTRIM(p.Nombre)) LIKE '%' + @BusquedaLimpia + '%'
            -- Búsqueda por código de producto (LIKE)
            OR LTRIM(RTRIM(p.codpro)) LIKE '%' + @BusquedaLimpia + '%'
            -- Búsqueda por código de barras (LIKE)
            OR (p.CodBar IS NOT NULL AND LTRIM(RTRIM(p.CodBar)) LIKE '%' + @BusquedaLimpia + '%')
        )
        UNION
        -- También buscar por lote en saldos
        SELECT DISTINCT s.codpro
        FROM Saldos s
        WHERE s.lote IS NOT NULL 
            AND LTRIM(RTRIM(s.lote)) LIKE '%' + @BusquedaLimpia + '%'
    )
    SELECT 
        p.codpro,
        p.CodBar,
        p.Nombre,
        s.almacen,
        s.lote,
        s.vencimiento,
        s.saldo
    FROM ProductosEncontrados pe
    INNER JOIN productos p ON pe.codpro = p.codpro
    LEFT JOIN Saldos s ON p.codpro = s.codpro
    WHERE s.saldo IS NULL OR s.saldo > 0
    ORDER BY 
        p.Nombre,
        s.almacen,
        s.vencimiento;
END;
