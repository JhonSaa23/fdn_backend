/*
  Autor: Jhon (SP Unificado)
  Objetivo: Unificar cálculos de descuentos y datos base en un solo SP
  Fuente: Combina la lógica de:
    - sp_Productos_buscaxcuenta (@producto)
    - sp_Desclie_Buscar1 (@Ruclie, @codpro)
    - sp_cliente_tipificacion (@labo, @ruc)
    - sp_Descuento_labo_buscaY (@tipifica, @cod)
    - sp_Escalas_Buscar1 (@Codpro)

  Reglas de reemplazo de descuentos:
    - Solo reemplazar si el valor nuevo > 0
    - Si es 0, < 0, o -9.00, mantener el valor anterior
*/
IF OBJECT_ID('dbo.Jhon_ProductoCalculos', 'P') IS NOT NULL
  DROP PROCEDURE dbo.Jhon_ProductoCalculos;
GO

CREATE PROCEDURE dbo.Jhon_ProductoCalculos
  @ruc       varchar(12),
  @codpro    char(10),
  @cantidad  decimal(18,2)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @labo char(2) = LEFT(@codpro, 2);

  /* ==========================
     1) Datos básicos del producto
     ========================== */
  DECLARE @codproOut char(10),
          @nombre nvarchar(200),
          @PventaMa decimal(18,6),
          @ComisionH decimal(18,6),
          @ComisionV decimal(18,6),
          @ComisionR decimal(18,6),
          @Afecto int;

  SELECT TOP 1
      @codproOut = p.Codpro,
      @nombre    = p.Nombre,
      @PventaMa  = p.PventaMa,
      @ComisionH = ISNULL(p.ComisionH, 0),
      @ComisionV = ISNULL(p.ComisionV, 0),
      @ComisionR = ISNULL(p.ComisionR, 0),
      @Afecto    = CAST(p.Afecto AS INT)
  FROM Productos p
  WHERE p.Codpro = @codpro AND p.Eliminado = 0;

  /* Valores iniciales (básicos) */
  DECLARE @Desc1 decimal(18,6) = ISNULL(@ComisionH, 0),
          @Desc2 decimal(18,6) = ISNULL(@ComisionV, 0),
          @Desc3 decimal(18,6) = ISNULL(@ComisionR, 0);

  /* ==========================
     2) Descuentos por cliente
     ========================== */
  DECLARE @ClieDesc1 decimal(18,6) = NULL,
          @ClieDesc2 decimal(18,6) = NULL,
          @ClieDesc3 decimal(18,6) = NULL;

  SELECT TOP 1
      @ClieDesc1 = ISNULL(Descuento1, 0),
      @ClieDesc2 = ISNULL(Descuento2, 0),
      @ClieDesc3 = ISNULL(Descuento3, 0)
  FROM Desclie d WITH (NOLOCK)
  WHERE d.Ruclie = @ruc AND d.Producto = @codpro;

  IF (@ClieDesc1 > 0) SET @Desc1 = @ClieDesc1;
  IF (@ClieDesc2 > 0) SET @Desc2 = @ClieDesc2;
  IF (@ClieDesc3 > 0) SET @Desc3 = @ClieDesc3;

  /* ==========================
     3) Tipificación y rangos
     ========================== */
  DECLARE @tipificacion int = NULL;
  SELECT TOP 1 @tipificacion = t.tipificacion
  FROM tipificaciones t WITH (NOLOCK)
  WHERE t.Codlab = @labo AND t.Cliente = @ruc;

  DECLARE @TipifDesde decimal(18,6) = NULL,
          @TipifPorc  decimal(18,6) = 0;

  IF (@tipificacion IS NOT NULL)
  BEGIN
    SELECT TOP 1
        @TipifDesde = ISNULL(dl.Desde, 0),
        @TipifPorc  = ISNULL(dl.Porcentaje, 0)
    FROM Descuento_laboratorio dl WITH (NOLOCK)
    WHERE dl.Tipificacion = @tipificacion AND dl.Codpro = @codpro AND @cantidad >= dl.Desde
    ORDER BY dl.Desde DESC;

    IF (@TipifPorc > 0)
      SET @Desc1 = @TipifPorc; -- solo Desc1
  END

  /* ==========================
     4) Escalas por producto
     ========================== */
  DECLARE @R1 decimal(18,6)=0,@R2 decimal(18,6)=0,@R3 decimal(18,6)=0,@R4 decimal(18,6)=0,@R5 decimal(18,6)=0,
          @e11 decimal(18,6)=NULL,@e12 decimal(18,6)=NULL,@e13 decimal(18,6)=NULL,
          @e21 decimal(18,6)=NULL,@e22 decimal(18,6)=NULL,@e23 decimal(18,6)=NULL,
          @e31 decimal(18,6)=NULL,@e32 decimal(18,6)=NULL,@e33 decimal(18,6)=NULL,
          @e41 decimal(18,6)=NULL,@e42 decimal(18,6)=NULL,@e43 decimal(18,6)=NULL,
          @e51 decimal(18,6)=NULL,@e52 decimal(18,6)=NULL,@e53 decimal(18,6)=NULL,
          @rangoUsado int = NULL;

  SELECT TOP 1
    @R1 = ISNULL(e.Rango1,0), @R2 = ISNULL(e.Rango2,0), @R3 = ISNULL(e.Rango3,0),
    @R4 = ISNULL(e.Rango4,0), @R5 = ISNULL(e.Rango5,0),
    @e11 = e.des11, @e12 = e.des12, @e13 = e.des13,
    @e21 = e.des21, @e22 = e.des22, @e23 = e.des23,
    @e31 = e.des31, @e32 = e.des32, @e33 = e.des33,
    @e41 = e.des41, @e42 = e.des42, @e43 = e.des43,
    @e51 = e.des51, @e52 = e.des52, @e53 = e.des53
  FROM Escalas e WITH (NOLOCK)
  WHERE e.Codpro = @codpro AND e.activo = 1;

  IF (@cantidad >= @R5 AND @R5 > 0) SET @rangoUsado = 5;
  ELSE IF (@cantidad >= @R4 AND @R4 > 0) SET @rangoUsado = 4;
  ELSE IF (@cantidad >= @R3 AND @R3 > 0) SET @rangoUsado = 3;
  ELSE IF (@cantidad >= @R2 AND @R2 > 0) SET @rangoUsado = 2;
  ELSE IF (@cantidad >= @R1 AND @R1 > 0) SET @rangoUsado = 1;

  DECLARE @s1 decimal(18,6)=NULL,@s2 decimal(18,6)=NULL,@s3 decimal(18,6)=NULL;
  IF (@rangoUsado = 5) SELECT @s1=@e51,@s2=@e52,@s3=@e53;
  ELSE IF (@rangoUsado = 4) SELECT @s1=@e41,@s2=@e42,@s3=@e43;
  ELSE IF (@rangoUsado = 3) SELECT @s1=@e31,@s2=@e32,@s3=@e33;
  ELSE IF (@rangoUsado = 2) SELECT @s1=@e21,@s2=@e22,@s3=@e23;
  ELSE IF (@rangoUsado = 1) SELECT @s1=@e11,@s2=@e12,@s3=@e13;

  -- Aplicar solo si > 0 (y distinto de -9.00)
  IF (@s1 IS NOT NULL AND @s1 > 0) SET @Desc1 = @s1;
  IF (@s2 IS NOT NULL AND @s2 > 0) SET @Desc2 = @s2;
  IF (@s3 IS NOT NULL AND @s3 > 0) SET @Desc3 = @s3;

  /* ==========================
     5) Resultado final
     ========================== */
  SELECT
    codpro      = @codproOut,
    nombre      = @nombre,
    Pventa      = @PventaMa,
    afecto      = @Afecto,
    Desc1       = ISNULL(@Desc1,0),
    Desc2       = ISNULL(@Desc2,0),
    Desc3       = ISNULL(@Desc3,0),
    tipificacion= @tipificacion,
    tipifDesde  = @TipifDesde,
    tipifPct    = @TipifPorc,
    escalaRango = @rangoUsado,
    R1=@R1,R2=@R2,R3=@R3,R4=@R4,R5=@R5;
END
GO


