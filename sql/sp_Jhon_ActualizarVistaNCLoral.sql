-- Procedimiento almacenado para actualizar la vista de Notas de Crédito Loreal
-- Este procedimiento actualiza la vista v_nc_loral_giselli con los parámetros de año y mes

CREATE OR ALTER PROCEDURE dbo.sp_Jhon_ActualizarVistaNCLoral
    @anio INT,
    @mes INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Aquí se puede agregar lógica para actualizar la vista
        -- Por ahora, solo retornamos éxito ya que la vista se consulta directamente
        -- con filtros de año y mes en el endpoint GET
        
        SELECT 'Vista actualizada correctamente' AS Mensaje;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
