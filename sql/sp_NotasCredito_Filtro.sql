-- Procedimiento almacenado para filtro de Notas de Crédito
-- Permite filtros parciales (solo fecha fin, solo RUC, etc.)

CREATE OR ALTER PROCEDURE sp_NotasCredito_Filtro  
    @Ruc VARCHAR(20) = NULL,  
    @FechaIni DATE = NULL,  
    @FechaFin DATE = NULL,  
    @Laboratorio CHAR(2) = NULL  
AS  
BEGIN  
    SET NOCOUNT ON;  
  
    SELECT   
        nc.Numero,   
        nc.Observacion,   
        nc.Codclie,   
        c.Documento,   
        c.Razon,   
        dc.Vendedor,  
        ncd.Codpro,   
        p.Nombre,   
        ncd.Lote,   
        ncd.Vencimiento,   
        ncd.Cantidad,   
        ncd.Precio,   
        ncd.Descuento1,   
        ncd.Descuento2,   
        ncd.Descuento3,   
        ncd.Subtotal  
    FROM dbo.notas_credito_deta AS ncd  
    INNER JOIN dbo.notas_credito AS nc ON ncd.Numero = nc.Numero  
    INNER JOIN dbo.Clientes AS c ON c.Codclie = nc.Codclie  
    INNER JOIN dbo.Productos AS p ON p.CodPro = ncd.Codpro  
    INNER JOIN dbo.Doccab AS dc ON dc.Numero = nc.Documento  
    WHERE (@Laboratorio IS NULL OR LEFT(ncd.Codpro, 2) = @Laboratorio)  
      AND (@Ruc IS NULL OR c.Documento = @Ruc)  
      AND (@FechaIni IS NULL OR ncd.Vencimiento >= @FechaIni)  
      AND (@FechaFin IS NULL OR ncd.Vencimiento <= @FechaFin)
    ORDER BY nc.Numero ASC;
END
