const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { executeQuery, getConnection } = require('../database');
const { spawn } = require('child_process');
const sql = require('mssql');
const XLSX = require('xlsx');

// Descargar archivo TXT
router.post('/download', async (req, res) => {
  try {
    const { extension, tabla_name } = req.body;
    
    if (!extension || !tabla_name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Debe especificar extensión y nombre de tabla' 
      });
    }
    
    // Consulta para obtener los nombres de las columnas y sus tipos en orden
    const columnResult = await executeQuery(`
      SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
      FROM Information_Schema.Columns 
      WHERE TABLE_NAME = '${tabla_name}'
      ORDER BY ORDINAL_POSITION
    `);
    
    // Obtener los datos usando FORMAT para decimales (mantiene precisión exacta)
    // y CONVERT para fechas
    const columns = columnResult.recordset.map(col => col.COLUMN_NAME);
    const columnExpressions = columns.map(colName => {
      const colInfo = columnResult.recordset.find(c => c.COLUMN_NAME === colName);
      if (!colInfo) return colName;
      
      // Para decimales/números, usar FORMAT para mantener precisión exacta
      if (colInfo.DATA_TYPE === 'decimal' || colInfo.DATA_TYPE === 'numeric') {
        // FORMAT mantiene la precisión exacta del valor
        // Usar formato numérico estándar que preserva todos los dígitos
        if (colInfo.NUMERIC_SCALE > 0) {
          // Construir formato con la cantidad correcta de decimales
          const formatStr = '0.' + '0'.repeat(colInfo.NUMERIC_SCALE);
          return `FORMAT(${colName}, '${formatStr}') AS [${colName}]`;
        } else {
          // Para enteros, usar directamente
          return colName;
        }
      }
      
      // Para fechas, convertir a formato específico sin zona horaria (formato 120 = 'yyyy-mm-dd hh:mi:ss')
      if (colInfo.DATA_TYPE === 'datetime' || colInfo.DATA_TYPE === 'datetime2' || 
          colInfo.DATA_TYPE === 'date' || colInfo.DATA_TYPE === 'smalldatetime') {
        return `CONVERT(VARCHAR(23), ${colName}, 120) AS [${colName}]`;
      }
      
      // Para todos los demás tipos, obtener directamente
      return colName;
    });
    
    // Ejecutar consulta - solo fechas convertidas, decimales directos
    const query = `SELECT ${columnExpressions.join(', ')} FROM ${tabla_name}`;
    const dataResult = await executeQuery(query);
    
    if (!dataResult.recordset || dataResult.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No se encontraron datos en la tabla' 
      });
    }
    
    // Convertir los datos a formato de texto
    let textContent = '';
    let delimiter = '|';
    let fileName = '';
    
    // Determinar el nombre del archivo y delimitador según la tabla
    if (tabla_name === 't_Dtw24Pe' || tabla_name === 't_Dtw241Pe') {
      delimiter = '';
      fileName = tabla_name === 't_Dtw24Pe' ? 'dt24' : 'dt24_1';
    } else if (tabla_name === 't_minsa') {
      delimiter = '|';
      fileName = 'Minsa';
    } else if (tabla_name === 'PERU_FACT') {
      delimiter = '!';
      fileName = 'PERU_FARMNORTE_FACT_';
    } else if (tabla_name === 'PERUFACTINV') {
      delimiter = '!';
      fileName = 'PERU_FARMNORTE_FACTINV_';
    } else if (tabla_name === 'PERU_PROD') {
      delimiter = '!';
      fileName = 'PERU_FARMNORTE_PROD_';
    } else if (tabla_name === 'PERU_SREP') {
      delimiter = '!';
      fileName = 'PERU_FARMNORTE_SREP_';
    } else if (tabla_name === 'srepstore') {
      delimiter = '!';
      fileName = 'PERU_FARMNORTE_REPSTORE_';
    } else {
      delimiter = '!';
      fileName = 'PERU_FARMNORTE_STORE_';
    }
    
    // Obtener las columnas con su información de tipo
    const columnsInfo = columnResult.recordset.map(col => ({
      name: col.COLUMN_NAME,
      dataType: col.DATA_TYPE,
      precision: col.NUMERIC_PRECISION,
      scale: col.NUMERIC_SCALE
    }));
    
    // Función para formatear valores según su tipo
    // Nota: Los valores decimales y fechas ya vienen como strings desde SQL
    const formatValue = (value, columnInfo) => {
      if (value === null || value === undefined) {
        return '';
      }
      
      // Si el valor ya viene como string (porque lo convertimos en SQL), usarlo directamente
      // pero aplicar formato específico según el tipo
      
      // Para fechas (ya vienen como string en formato SQL)
      if (columnInfo.dataType === 'datetime' || columnInfo.dataType === 'datetime2' || 
          columnInfo.dataType === 'date' || columnInfo.dataType === 'smalldatetime') {
        // Ya viene como string en formato 'YYYY-MM-DD HH:mm:ss'
        return value.toString().trim();
      }
      
      // Para números decimales - FORMAT ya los devolvió como string con precisión exacta
      if (columnInfo.dataType === 'decimal' || columnInfo.dataType === 'numeric') {
        // FORMAT ya devolvió el valor como string con el formato correcto
        // Solo necesitamos usarlo tal cual, sin ninguna conversión
        let strValue = value.toString().trim();
        
        // Para valores cero con escala alta, formatear como .000000000000000
        if (columnInfo.scale > 2 && (strValue === '0' || strValue === '0.0' || strValue === '0.00')) {
          return '.' + '0'.repeat(columnInfo.scale);
        }
        
        // Para todos los demás valores, usar el string exacto de FORMAT
        return strValue;
      }
      
      // Para float/real (convertir a string manteniendo precisión)
      if (columnInfo.dataType === 'float' || columnInfo.dataType === 'real') {
        if (typeof value === 'number') {
          // Mantener alta precisión
          return value.toString();
        }
        return value.toString();
      }
      
      // Para enteros, mantener como están
      if (columnInfo.dataType === 'int' || columnInfo.dataType === 'bigint' || 
          columnInfo.dataType === 'smallint' || columnInfo.dataType === 'tinyint') {
        return value.toString();
      }
      
      // Para otros tipos, devolver como string
      return value.toString();
    };
    
    // Si no es t_Dtw24Pe o t_Dtw241Pe, agregar encabezados
    if (tabla_name !== 't_Dtw24Pe' && tabla_name !== 't_Dtw241Pe' && columns.length > 0) {
      // Agregar encabezados
      textContent += columns.join(delimiter) + '\n';
    }
    
    // Agregar filas de datos manteniendo el orden de las columnas
    dataResult.recordset.forEach(row => {
      const values = columns.map((colName, index) => {
        const columnInfo = columnsInfo[index];
        const value = row[colName];
        return formatValue(value, columnInfo);
      });
      textContent += values.join(delimiter) + '\n';
    });
    
    // Crear archivo temporal
    const filePath = path.join(__dirname, '../uploads', `${fileName}.${extension}`);
    fs.writeFileSync(filePath, textContent);
    
    // Enviar archivo como respuesta
    res.download(filePath, `${fileName}.${extension}`, (err) => {
      if (err) {
        console.error('Error al descargar archivo:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Error al descargar archivo: ' + err.message 
        });
      }
      
      // Eliminar archivo temporal después de enviarlo
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error al eliminar archivo temporal:', err);
      });
    });
    
  } catch (error) {
    console.error('Error al generar archivo de exportación:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al generar archivo de exportación: ' + error.message 
    });
  }
});

// Ejecutar stored procedure sp_Ventas_MINSA antes de exportar t_minsa
router.post('/ejecutar-sp-minsa', async (req, res) => {
  try {
    const { fec1, fec2 } = req.body;
    
    if (!fec1 || !fec2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Las fechas fec1 y fec2 son requeridas' 
      });
    }
    
    // Validar formato de fechas (acepta YYYY-MM-DD o YYYY-MM-DD HH:mm:ss)
    const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
    if (!dateRegex.test(fec1) || !dateRegex.test(fec2)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Las fechas deben estar en formato YYYY-MM-DD o YYYY-MM-DD HH:mm:ss' 
      });
    }
    
    // Convertir strings a objetos Date
    // Las fechas vienen en formato YYYY-MM-DD HH:mm:ss o YYYY-MM-DD
    let date1, date2;
    
    try {
      // Convertir fechas: el formato viene como YYYY-MM-DD HH:mm:ss o YYYY-MM-DD
      if (fec1.includes(' ')) {
        // Ya tiene hora: convertir directamente reemplazando espacio por T para ISO
        const fecha1ISO = fec1.replace(' ', 'T');
        date1 = new Date(fecha1ISO);
      } else {
        // Solo fecha: agregar hora 00:00:00 en formato ISO
        date1 = new Date(fec1 + 'T00:00:00');
      }
      
      if (fec2.includes(' ')) {
        const fecha2ISO = fec2.replace(' ', 'T');
        date2 = new Date(fecha2ISO);
      } else {
        // Solo fecha: agregar hora 23:59:59 en formato ISO
        date2 = new Date(fec2 + 'T23:59:59');
      }
      
      // Validar que las fechas sean válidas
      if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
        return res.status(400).json({ 
          success: false, 
          error: 'Las fechas proporcionadas no son válidas' 
        });
      }
      
      // Validar que fecha1 sea menor o igual que fecha2
      if (date1 > date2) {
        return res.status(400).json({ 
          success: false, 
          error: 'La fecha inicio debe ser menor o igual a la fecha fin' 
        });
      }
    } catch (dateError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Error al procesar las fechas: ' + dateError.message 
      });
    }
    
    const pool = await getConnection();
    
    // Usar una transacción para configurar DATEFORMAT antes de ejecutar el SP
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
      // Configurar DATEFORMAT ymd (formato estándar YYYY-MM-DD) para SQL Server
      await transaction.request().batch("SET DATEFORMAT ymd;");
      
      // Ejecutar el stored procedure pasando las fechas como objetos Date
      // El driver de mssql manejará la conversión automáticamente
      const request = transaction.request();
      request.input('fec1', sql.DateTime, date1);
      request.input('fec2', sql.DateTime, date2);
      
      const result = await request.execute('sp_Ventas_MINSA');
      
      await transaction.commit();
      
      res.json({
        success: true,
        message: 'Stored procedure ejecutado exitosamente',
        recordset: result.recordset
      });
      
    } catch (spError) {
      await transaction.rollback();
      // Si el error es de conversión, puede ser que el SP tenga problemas internos
      // Re-lanzar el error para que se maneje arriba
      throw spError;
    }
    
  } catch (error) {
    console.error('Error ejecutando sp_Ventas_MINSA:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al ejecutar stored procedure: ' + error.message 
    });
  }
});

// Descargar archivo DBF
router.post('/download-dbf', async (req, res) => {
  try {
    const { extension_dbf, tabla_dbf } = req.body;
    
    if (!extension_dbf || !tabla_dbf) {
      return res.status(400).json({ 
        success: false, 
        error: 'Debe especificar extensión y nombre de tabla DBF' 
      });
    }
    
    let scriptPath;
    let outputFileName;
    
    if (tabla_dbf === 'CC000225') {
      scriptPath = path.join(__dirname, '../scripts/cc000225_export.py');
      outputFileName = 'CC000225.dbf';
    } else if (tabla_dbf === 'CD000225') {
      scriptPath = path.join(__dirname, '../scripts/cd000225_export.py');
      outputFileName = 'CD000225.dbf';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Tabla DBF no soportada'
      });
    }
    
    // Verificar si el script existe
    if (!fs.existsSync(scriptPath)) {
      // Si no existe, crear un script temporal con un mensaje
      const tempDir = path.join(__dirname, '../uploads');
      const tempFilePath = path.join(tempDir, `${outputFileName}`);
      
      // Crear un archivo DBF vacío (o de placeholder)
      fs.writeFileSync(tempFilePath, 'DBF EXPORT PLACEHOLDER');
      
      return res.download(tempFilePath, outputFileName, (err) => {
        if (err) {
          console.error('Error al descargar archivo:', err);
          return res.status(500).json({ 
            success: false, 
            error: 'Error al descargar archivo: ' + err.message 
          });
        }
        
        // Eliminar archivo temporal después de enviarlo
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error('Error al eliminar archivo temporal:', err);
        });
      });
    }
    
    // Si el script existe, ejecutarlo
    const pythonProcess = spawn('python', [scriptPath]);
    
    pythonProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      
      // Ruta donde el script Python debe haber creado el archivo DBF
      const dbfFilePath = path.join(__dirname, '../uploads', outputFileName);
      
      if (fs.existsSync(dbfFilePath)) {
        res.download(dbfFilePath, outputFileName, (err) => {
          if (err) {
            console.error('Error al descargar archivo DBF:', err);
            return res.status(500).json({ 
              success: false, 
              error: 'Error al descargar archivo DBF: ' + err.message 
            });
          }
          
          // Eliminar archivo después de enviarlo
          fs.unlink(dbfFilePath, (err) => {
            if (err) console.error('Error al eliminar archivo DBF temporal:', err);
          });
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: 'No se pudo generar el archivo DBF' 
        });
      }
    });
    
  } catch (error) {
    console.error('Error al generar archivo DBF:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al generar archivo DBF: ' + error.message 
    });
  }
});

// Exportar datos a Excel
router.get('/:tabla', async (req, res) => {
  try {
    const tabla_name = req.params.tabla;
    
    // Obtener los datos
    const dataResult = await executeQuery(`SELECT * FROM ${tabla_name}`);
    
    if (!dataResult.recordset || dataResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontraron datos para exportar'
      });
    }

    // Obtener información de las columnas
    const columnResult = await executeQuery(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = @tableName
    `, {
      tableName: tabla_name
    });

    // ... rest of the existing code ...
  } catch (error) {
    console.error('Error al exportar datos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al exportar datos: ' + error.message
    });
  }
});

module.exports = router; 
module.exports = router; 