-- Procedimiento almacenado para filtro avanzado de Notas de Crédito Loreal
-- Permite filtrar por rango de fechas y cliente específico (búsqueda unificada)

CREATE OR ALTER PROCEDURE dbo.sp_Jhon_NotasLoreal_FiltroAvanzado
    @fechaInicio DATE = NULL,
    @fechaFin DATE = NULL,
    @buscarCliente VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Consulta base con filtros dinámicos
        SELECT 
            Numero,
            Observacion,
            Codclie,
            Documento,
            Razon,
            Vendedor,
            Codpro,
            Nombre,
            Lote,
            Vencimiento,
            Cantidad,
            Precio,
            Descuento1,
            Descuento2,
            Descuento3,
            Subtotal
        FROM dbo.v_nc_loral_giselli
        WHERE 1=1
            -- Filtro por rango de fechas (usando campo Vencimiento)
            AND (@fechaInicio IS NULL OR CONVERT(DATE, Vencimiento) >= @fechaInicio)
            AND (@fechaFin IS NULL OR CONVERT(DATE, Vencimiento) <= @fechaFin)
            -- Filtro por cliente (búsqueda unificada en código, documento y razón)
            AND (@buscarCliente IS NULL OR 
                 Codclie LIKE '%' + @buscarCliente + '%' OR
                 Documento LIKE '%' + @buscarCliente + '%' OR
                 Razon LIKE '%' + @buscarCliente + '%')
        ORDER BY Numero ASC;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
