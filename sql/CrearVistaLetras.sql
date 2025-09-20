-- =============================================
-- Script para crear vista de Letras de Cambio
-- =============================================

-- 1. Crear la vista de letras filtrada por vendedor
CREATE VIEW [dbo].[VistaLetrasVendedor] AS
SELECT 
    dl.Numero,
    dl.CodBanco,
    dl.Codclie,
    dl.Vendedor,
    dl.Plazo,
    dl.FecIni,
    dl.FecVen,
    dl.Monto,
    dl.Estado,
    dl.FecCan,
    dl.MontoPagado,
    dl.Banco,
    dl.Anulado,
    c.Razon AS NombreCliente,
    c.Direccion AS DireccionCliente,
    c.Celular AS TelefonoCliente,
    u.Nombres AS NombreVendedor,
    u.Email AS EmailVendedor,
    u.NumeroCelular AS CelularVendedor,
    CASE 
        WHEN dl.Estado = 1 THEN 'Pendiente'
        WHEN dl.Estado = 2 THEN 'Pagado'
        WHEN dl.Estado = 3 THEN 'Vencido'
        ELSE 'Desconocido'
    END AS EstadoDescripcion,
    CASE 
        WHEN dl.FecVen < GETDATE() AND dl.Estado = 1 THEN 1
        ELSE 0
    END AS EsVencido,
    DATEDIFF(DAY, dl.FecIni, dl.FecVen) AS DiasPlazo,
    DATEDIFF(DAY, GETDATE(), dl.FecVen) AS DiasParaVencer,
    dl.Monto - dl.MontoPagado AS SaldoPendiente
FROM DocLetra dl
LEFT JOIN Clientes c ON dl.Codclie = c.Codclie
LEFT JOIN UsersSystems u ON dl.Vendedor = u.CodigoInterno
WHERE dl.Anulado = 0;

GO

-- 2. Insertar la vista en VistasSistema
INSERT INTO VistasSistema (
    Ruta, 
    Nombre, 
    Descripcion, 
    Icono, 
    Categoria, 
    Orden, 
    Activo, 
    FechaCreacion, 
    FechaModificacion
) VALUES (
    '/letras', 
    'Letras de Cambio', 
    'Gestión de letras de cambio por vendedor', 
    'ReceiptIcon', 
    'Ventas', 
    25, 
    1, 
    GETDATE(), 
    GETDATE()
);

GO

-- 3. Crear permisos para la vista (asumiendo que existe una tabla de permisos)
-- Si tienes una tabla de permisos, descomenta y ajusta según tu estructura:
/*
INSERT INTO PermisosVista (
    VistaID,
    UsuarioID,
    PuedeVer,
    PuedeEditar,
    PuedeEliminar,
    FechaCreacion
) 
SELECT 
    v.ID,
    u.ID,
    1, -- Puede ver
    1, -- Puede editar
    0, -- No puede eliminar
    GETDATE()
FROM VistasSistema v
CROSS JOIN UsersSystems u
WHERE v.Ruta = '/letras'
AND u.TipoUsuario IN ('Admin', 'Vendedor', 'Asistente Sistemas');
*/

-- 4. Crear índices para mejorar el rendimiento
CREATE INDEX IX_DocLetra_Vendedor_Estado 
ON DocLetra (Vendedor, Estado, FecVen);

CREATE INDEX IX_DocLetra_Cliente_Estado 
ON DocLetra (Codclie, Estado, FecVen);

GO

-- 5. Crear procedimiento almacenado para obtener letras por vendedor
CREATE PROCEDURE [dbo].[sp_LetrasPorVendedor]
    @CodigoInterno VARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        Numero,
        CodBanco,
        Codclie,
        NombreCliente,
        DireccionCliente,
        TelefonoCliente,
        Vendedor,
        NombreVendedor,
        Plazo,
        FecIni,
        FecVen,
        Monto,
        Estado,
        EstadoDescripcion,
        FecCan,
        MontoPagado,
        SaldoPendiente,
        Banco,
        Anulado,
        EsVencido,
        DiasPlazo,
        DiasParaVencer
    FROM VistaLetrasVendedor
    WHERE Vendedor = @CodigoInterno
    ORDER BY FecVen DESC, Numero DESC;
END;

GO

-- 6. Crear procedimiento para estadísticas de letras
CREATE PROCEDURE [dbo].[sp_EstadisticasLetrasVendedor]
    @CodigoInterno VARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(*) AS TotalLetras,
        SUM(CASE WHEN Estado = 1 THEN 1 ELSE 0 END) AS LetrasPendientes,
        SUM(CASE WHEN Estado = 2 THEN 1 ELSE 0 END) AS LetrasPagadas,
        SUM(CASE WHEN EsVencido = 1 THEN 1 ELSE 0 END) AS LetrasVencidas,
        SUM(Monto) AS MontoTotal,
        SUM(MontoPagado) AS MontoPagado,
        SUM(SaldoPendiente) AS SaldoTotal,
        AVG(DiasPlazo) AS PromedioDiasPlazo
    FROM VistaLetrasVendedor
    WHERE Vendedor = @CodigoInterno;
END;

GO

-- 6. Crear procedimiento para letras con filtros por mes y año
CREATE PROCEDURE [dbo].[sp_LetrasPorVendedorFiltradas]
    @CodigoInterno VARCHAR(10),
    @Mes INT = NULL,
    @Año INT = NULL,
    @Estado INT = NULL,
    @Cliente VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        Numero,
        CodBanco,
        Codclie,
        NombreCliente,
        DireccionCliente,
        TelefonoCliente,
        Vendedor,
        NombreVendedor,
        Plazo,
        FecIni,
        FecVen,
        Monto,
        Estado,
        EstadoDescripcion,
        FecCan,
        MontoPagado,
        SaldoPendiente,
        Banco,
        Anulado,
        EsVencido,
        DiasPlazo,
        DiasParaVencer
    FROM VistaLetrasVendedor
    WHERE Vendedor = @CodigoInterno
    AND (@Mes IS NULL OR MONTH(FecIni) = @Mes)
    AND (@Año IS NULL OR YEAR(FecIni) = @Año)
    AND (@Estado IS NULL OR Estado = @Estado)
    AND (@Cliente IS NULL OR Codclie LIKE '%' + @Cliente + '%' OR NombreCliente LIKE '%' + @Cliente + '%')
    ORDER BY FecVen DESC, Numero DESC;
END;

GO

-- 7. Crear procedimiento para estadísticas con filtros por mes y año
CREATE PROCEDURE [dbo].[sp_EstadisticasLetrasVendedorFiltradas]
    @CodigoInterno VARCHAR(10),
    @Mes INT = NULL,
    @Año INT = NULL,
    @Estado INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(*) AS TotalLetras,
        SUM(CASE WHEN Estado = 1 THEN 1 ELSE 0 END) AS LetrasPendientes,
        SUM(CASE WHEN Estado = 2 THEN 1 ELSE 0 END) AS LetrasPagadas,
        SUM(CASE WHEN EsVencido = 1 THEN 1 ELSE 0 END) AS LetrasVencidas,
        SUM(Monto) AS MontoTotal,
        SUM(MontoPagado) AS MontoPagado,
        SUM(SaldoPendiente) AS SaldoTotal,
        AVG(DiasPlazo) AS PromedioDiasPlazo,
        MIN(FecIni) AS FechaInicioMasAntigua,
        MAX(FecVen) AS FechaVencimientoMasReciente
    FROM VistaLetrasVendedor
    WHERE Vendedor = @CodigoInterno
    AND (@Mes IS NULL OR MONTH(FecIni) = @Mes)
    AND (@Año IS NULL OR YEAR(FecIni) = @Año)
    AND (@Estado IS NULL OR Estado = @Estado);
END;

GO

PRINT 'Vista de Letras de Cambio creada exitosamente';
PRINT 'Ruta: /letras';
PRINT 'Vista: VistaLetrasVendedor';
PRINT 'Procedimientos: sp_LetrasPorVendedor, sp_EstadisticasLetrasVendedor, sp_LetrasPorVendedorFiltradas, sp_EstadisticasLetrasVendedorFiltradas';
