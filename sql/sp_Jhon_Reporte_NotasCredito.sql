CREATE PROCEDURE sp_Jhon_Reporte_NotasCredito
    @FechaIni DATE = NULL,
    @FechaFin DATE = NULL,
    @Laboratorio VARCHAR(2) = NULL,
    @Documento VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        nc.Numero,
        nc.Fecha,
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
    WHERE ( @Laboratorio IS NULL OR LEFT(ncd.Codpro, 2) = @Laboratorio )
      AND ( @Documento IS NULL OR c.Documento = @Documento )
      AND ( @FechaIni IS NULL OR nc.Fecha >= @FechaIni )
      AND ( @FechaFin IS NULL OR nc.Fecha <= @FechaFin )
    ORDER BY nc.Fecha DESC, nc.Numero;
END
GO
