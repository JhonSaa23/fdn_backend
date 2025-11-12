-- =====================================================
-- AGREGAR VISTA: Búsqueda de Productos
-- =====================================================

-- Insertar la nueva vista en VistasSistema
IF NOT EXISTS (SELECT 1 FROM VistasSistema WHERE Ruta = '/buscar-productos')
BEGIN
    INSERT INTO VistasSistema (Ruta, Nombre, Descripcion, Icono, Categoria, Orden)
    VALUES ('/buscar-productos', 'Buscar Productos', 'Búsqueda avanzada de productos por nombre, lote y código de barras', 'MagnifyingGlassIcon', 'Inventario', 24);
    
    PRINT 'Vista "Buscar Productos" agregada exitosamente';
END
ELSE
BEGIN
    PRINT 'La vista "Buscar Productos" ya existe';
END
GO

-- =====================================================
-- PROCEDIMIENTO ALMACENADO: BÚSQUEDA DE PRODUCTOS
-- =====================================================

-- Eliminar el procedimiento si existe
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_BuscarProductos]') AND type in (N'P', N'PC'))
BEGIN
    DROP PROCEDURE [dbo].[sp_BuscarProductos];
    PRINT 'Procedimiento sp_BuscarProductos eliminado';
END
GO

-- Crear el procedimiento almacenado
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
END
GO

PRINT 'Procedimiento sp_BuscarProductos creado exitosamente';
GO

