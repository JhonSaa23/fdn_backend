-- =====================================================
-- TABLA: ClientesInfocorp
-- Gestión de reportes PDF de clientes
-- =====================================================

CREATE TABLE ClientesInfocorp (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Documento VARCHAR(20) NOT NULL,                    -- Documento del cliente (RUC/DNI)
    ArchivoPDF VARBINARY(MAX),                         -- Archivo PDF en binario
    NombreArchivo VARCHAR(255),                        -- Nombre original del archivo
    FechaActualizacion DATETIME DEFAULT GETDATE(),     -- Fecha de última actualización
    SubidoPor VARCHAR(50),                             -- Usuario que subió/actualizó el archivo
    
    -- Constraints
    CONSTRAINT UK_ClientesInfocorp_Documento UNIQUE (Documento)  -- Un documento solo puede tener un reporte
);

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

CREATE INDEX IX_ClientesInfocorp_Documento ON ClientesInfocorp(Documento);
CREATE INDEX IX_ClientesInfocorp_FechaActualizacion ON ClientesInfocorp(FechaActualizacion);

-- =====================================================
-- PROCEDIMIENTOS ALMACENADOS
-- =====================================================

-- Obtener reporte de un cliente por documento
CREATE PROCEDURE sp_ObtenerReporteCliente
    @Documento VARCHAR(20)
AS
BEGIN
    SELECT 
        ID, Documento, ArchivoPDF, NombreArchivo, FechaActualizacion, SubidoPor
    FROM ClientesInfocorp 
    WHERE Documento = @Documento;
END;
GO

-- Insertar o actualizar reporte de cliente
CREATE PROCEDURE sp_GuardarReporteCliente
    @Documento VARCHAR(20),
    @ArchivoPDF VARBINARY(MAX),
    @NombreArchivo VARCHAR(255),
    @SubidoPor VARCHAR(50)
AS
BEGIN
    BEGIN TRY
        -- Si existe, actualizar; si no, insertar
        IF EXISTS (SELECT 1 FROM ClientesInfocorp WHERE Documento = @Documento)
        BEGIN
            UPDATE ClientesInfocorp 
            SET ArchivoPDF = @ArchivoPDF,
                NombreArchivo = @NombreArchivo,
                FechaActualizacion = GETDATE(),
                SubidoPor = @SubidoPor
            WHERE Documento = @Documento;
        END
        ELSE
        BEGIN
            INSERT INTO ClientesInfocorp (Documento, ArchivoPDF, NombreArchivo, SubidoPor)
            VALUES (@Documento, @ArchivoPDF, @NombreArchivo, @SubidoPor);
        END
        
        SELECT 'Reporte guardado exitosamente' AS Mensaje;
    END TRY
    BEGIN CATCH
        SELECT 'Error al guardar reporte: ' + ERROR_MESSAGE() AS Mensaje;
    END CATCH
END;
GO

-- Eliminar reporte de cliente
CREATE PROCEDURE sp_EliminarReporteCliente
    @Documento VARCHAR(20)
AS
BEGIN
    DELETE FROM ClientesInfocorp WHERE Documento = @Documento;
    SELECT 'Reporte eliminado exitosamente' AS Mensaje;
END;
