-- =====================================================
-- CREAR VISTA: v_Jhon_VenMin_ConDescuentos
-- Vista para reporte de ventas mínimas con descuentos
-- =====================================================

-- Verificar si la vista ya existe y eliminarla
IF EXISTS (SELECT * FROM sys.views WHERE name = 'v_Jhon_VenMin_ConDescuentos')
BEGIN
    DROP VIEW v_Jhon_VenMin_ConDescuentos;
    PRINT 'Vista v_Jhon_VenMin_ConDescuentos eliminada';
END
GO

-- Crear la vista
CREATE VIEW v_Jhon_VenMin_ConDescuentos
AS
SELECT 
    doccab.Fecha,
    clientes.documento AS RUC,
    clientes.Razon AS Cliente,
    clientes.Direccion,
    LEFT(zonas.Descripcion, 50) AS Zona,
    empleados.CodEmp AS CodVen,
    empleados.Nombre AS Vendedor,
    (SELECT c_describe FROM tablas WHERE n_codtabla=400 AND n_numero=t_clientes_ubigeo.Dpto) AS Dpto,
    (SELECT c_describe FROM tablas WHERE n_codtabla=401 AND n_numero=t_clientes_ubigeo.Provincia) AS Provincia,
    (SELECT c_describe FROM tablas WHERE n_codtabla=402 AND n_numero=t_clientes_ubigeo.Distrito) AS Distrito,
    docdet.Numero,
    docdet.codpro AS CodPro,
    productos.Nombre AS Producto,
    docdet.Cantidad,
    docdet.Precio,
    docdet.Descuento1,
    docdet.Descuento2,
    docdet.Descuento3,
    docdet.Cantidad * docdet.Precio * 
        (1 - docdet.Descuento1 / 100) *
        (1 - docdet.Descuento2 / 100) *
        (1 - docdet.Descuento3 / 100) AS Total,
    Lineas.Descripcion AS Linea,
    CASE 
        WHEN doccab.tipo = 1 THEN 'Fa'
        ELSE 'Bo'
    END AS TipoDoc,
    Doccab.NroPedido AS NroPedido
FROM docdet
INNER JOIN doccab ON doccab.numero = docdet.numero
INNER JOIN clientes ON clientes.Codclie = doccab.Codclie
INNER JOIN zonas ON clientes.zona = zonas.Codzona
INNER JOIN t_clientes_ubigeo ON t_clientes_ubigeo.Codigo = clientes.Codclie
INNER JOIN productos ON productos.codpro = docdet.codpro
INNER JOIN empleados ON empleados.CodEmp = doccab.Vendedor
INNER JOIN lineas ON lineas.CodLinea = productos.CLinea
WHERE 
    docdet.Precio > 0 
    AND doccab.Eliminado = 0;
GO

PRINT 'Vista v_Jhon_VenMin_ConDescuentos creada exitosamente';
GO

-- Verificar que la vista se creó correctamente
SELECT 
    TABLE_NAME,
    VIEW_DEFINITION
FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_NAME = 'v_Jhon_VenMin_ConDescuentos';
GO

-- Probar la vista
SELECT TOP 10 * FROM v_Jhon_VenMin_ConDescuentos;
GO

