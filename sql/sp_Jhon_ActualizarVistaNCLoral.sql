-- Procedimiento almacenado para actualizar la vista de Notas de Crédito Loreal
-- Este procedimiento actualiza la vista v_nc_loral_giselli con los parámetros de año y mes

USE [SIFANO]
GO
/****** Object:  StoredProcedure [dbo].[sp_Jhon_ActualizarVistaNCLoral]    Script Date: 30/09/2025 11:03:20 a. m. ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Nuevo procedimiento para actualizar la vista v_nc_loral_giselli
ALTER   PROCEDURE [dbo].[sp_Jhon_ActualizarVistaNCLoral]
  @anio INT,
  @mes  INT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @sql NVARCHAR(MAX) = N'
    ALTER OR ALTER VIEW dbo.v_nc_loral_giselli
    AS
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
    WHERE 
      (LEFT(ncd.Codpro, 2) = ''83'' AND YEAR(nc.Fecha) = ' + CAST(@anio AS NVARCHAR(4)) + ' AND MONTH(nc.Fecha) = ' + CAST(@mes AS NVARCHAR(2)) + ')
      OR
      (YEAR(nc.Fecha) = ' + CAST(@anio AS NVARCHAR(4)) + ' AND MONTH(nc.Fecha) = ' + CAST(@mes AS NVARCHAR(2)) + ' AND nc.Observacion LIKE ''%LOREAL%'')
  ';

  EXEC sp_executesql @sql;
END;