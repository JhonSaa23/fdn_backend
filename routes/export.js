const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { executeQuery } = require('../database');
const { spawn } = require('child_process');

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
    
    // Ejecutar consulta para obtener los datos de la tabla
    const dataResult = await executeQuery(`SELECT * FROM ${tabla_name}`);
    
    if (!dataResult.recordset || dataResult.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No se encontraron datos en la tabla' 
      });
    }

    // Consulta para obtener los nombres de las columnas
    const columnResult = await executeQuery(`
      SELECT COLUMN_NAME 
      FROM Information_Schema.Columns 
      WHERE TABLE_NAME = '${tabla_name}'
    `);
    
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
    } else {
      delimiter = '!';
      fileName = `PERU_FARMNORTE_${tabla_name.toUpperCase().replace('PERU_', '')}_`;
    }
    
    // Si no es t_Dtw24Pe o t_Dtw241Pe, agregar encabezados
    if (tabla_name !== 't_Dtw24Pe' && tabla_name !== 't_Dtw241Pe' && columnResult.recordset) {
      // Agregar encabezados
      const headers = columnResult.recordset.map(col => col.COLUMN_NAME);
      textContent += headers.join(delimiter) + '\n';
    }
    
    // Agregar filas de datos
    dataResult.recordset.forEach(row => {
      textContent += Object.values(row).join(delimiter) + '\n';
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

module.exports = router; 