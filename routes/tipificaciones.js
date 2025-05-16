const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const readXlsxFile = require('read-excel-file/node');
const { executeQuery } = require('../database');
const { upload } = require('../utils/fileHandler');

// Obtener todas las tipificaciones
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM t_Tipificaciones');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener tipificaciones:', error);
    res.status(500).json({ error: 'Error al obtener tipificaciones: ' + error.message });
  }
});

// Obtener todos los descuentos por laboratorio
router.get('/descuentos', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM t_Descuento_laboratorio');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener descuentos:', error);
    res.status(500).json({ error: 'Error al obtener descuentos: ' + error.message });
  }
});

// Importar archivo Excel de tipificaciones de clientes
router.post('/import-clientes', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se ha subido ningún archivo' 
      });
    }

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    
    // Leer archivo Excel
    const rows = await readXlsxFile(filePath);
    
    // Saltar la primera fila (encabezados)
    const dataRows = rows.slice(1);
    
    let processedCount = 0;
    let errorCount = 0;
    
    // Procesar cada fila del Excel
    for (const row of dataRows) {
      try {
        const cliente = row[0] ? row[0].toString() : '';
        const tipo = row[1] ? row[1].toString() : '';

        if (!cliente || !tipo) continue;

        // Insertar en la base de datos
        const query = `
          INSERT INTO t_Tipificaciones (cliente, tipificacion) 
          VALUES ('${cliente}', '${tipo}')
        `;

        await executeQuery(query);
        processedCount++;
      } catch (rowError) {
        console.error('Error al procesar fila:', rowError);
        errorCount++;
      }
    }

    // Eliminar el archivo temporal después de procesarlo
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error al eliminar archivo temporal:', err);
    });
    
    res.json({ 
      success: true, 
      message: `Tipificaciones de clientes importadas correctamente. Se procesaron ${processedCount} registros. Errores: ${errorCount}` 
    });
    
  } catch (error) {
    console.error('Error al importar tipificaciones de clientes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al importar archivo: ' + error.message 
    });
  }
});

// Importar archivo Excel de descuentos por laboratorio
router.post('/import-descuentos', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se ha subido ningún archivo' 
      });
    }

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    
    // Leer archivo Excel
    const rows = await readXlsxFile(filePath);
    
    // Saltar la primera fila (encabezados)
    const dataRows = rows.slice(1);
    
    let processedCount = 0;
    let errorCount = 0;
    
    // Procesar cada fila del Excel
    for (const row of dataRows) {
      try {
        const tipificacion = row[0] ? row[0].toString() : '';
        const producto = row[1] ? row[1].toString() : '';
        const cantidad = parseFloat(row[2]) || 0;
        const porcentaje = parseFloat(row[3]) || 0;

        if (!tipificacion || !producto) continue;

        // Insertar en la base de datos
        const query = `
          INSERT INTO t_Descuento_laboratorio (tipificacion, codpro, desde, porcentaje) 
          VALUES ('${tipificacion}', '${producto}', ${cantidad}, ${porcentaje})
        `;

        await executeQuery(query);
        processedCount++;
      } catch (rowError) {
        console.error('Error al procesar fila:', rowError);
        errorCount++;
      }
    }

    // Eliminar el archivo temporal después de procesarlo
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error al eliminar archivo temporal:', err);
    });
    
    res.json({ 
      success: true, 
      message: `Descuentos por laboratorio importados correctamente. Se procesaron ${processedCount} registros. Errores: ${errorCount}` 
    });
    
  } catch (error) {
    console.error('Error al importar descuentos por laboratorio:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al importar archivo: ' + error.message 
    });
  }
});

// Procesar tipificado (ejecutar procedimiento almacenado)
router.post('/procesar', async (req, res) => {
  try {
    const { laboratorio } = req.body;
    
    if (!laboratorio) {
      return res.status(400).json({ 
        success: false, 
        error: 'Debe especificar el laboratorio a procesar' 
      });
    }
    
    // Ejecutar procedimiento almacenado según el laboratorio
    let spName = '';
    
    if (laboratorio === 'Procter') {
      spName = 'sp_Procesar_Tipificacion_Procter';
    } else if (laboratorio === 'Haleon') {
      spName = 'sp_Procesar_Tipificacion_Haleon';
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Laboratorio no válido' 
      });
    }
    
    await executeQuery(`EXEC ${spName}`);
    
    res.json({ 
      success: true, 
      message: `Tipificación de ${laboratorio} procesada correctamente` 
    });
  } catch (error) {
    console.error('Error al procesar tipificación:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al procesar tipificación: ' + error.message 
    });
  }
});

// Vaciar tablas de tipificaciones
router.delete('/reset', async (req, res) => {
  try {
    await executeQuery('DELETE FROM t_Tipificaciones');
    await executeQuery('DELETE FROM t_Descuento_laboratorio');
    
    res.json({ 
      success: true, 
      message: 'Datos de tipificaciones y descuentos eliminados correctamente' 
    });
  } catch (error) {
    console.error('Error al resetear tipificaciones:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al resetear tipificaciones: ' + error.message 
    });
  }
});

module.exports = router; 