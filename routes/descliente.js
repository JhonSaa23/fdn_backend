const express = require('express');
const router = express.Router();
const path = require('path');
const readXlsxFile = require('read-excel-file/node');
const { executeQuery } = require('../database');
const { upload } = require('../utils/fileHandler');
const fs = require('fs');

// Función para rellenar con ceros a la izquierda (similar a zero_fill en PHP)
function zeroFill(value, length = 0) {
  return value.toString().padStart(length, '0');
}

// Obtener todos los registros de Descuento por Cliente
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Imp_desclie');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener registros de Descuento por Cliente:', error);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});

// Importar archivo Excel de Descuento por Cliente
router.post('/import', upload.single('file'), async (req, res) => {
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
        const ruclie = row[0] || '';
        const producto = row[1] ? row[1].toString() : '';
        const descuento1 = parseFloat(row[2]) || 0;
        const descuento2 = parseFloat(row[3]) || 0;
        const descuento3 = parseFloat(row[4]) || 0;
        const remplazo = parseFloat(row[5]) || 0;

        // Insertar en la base de datos
        const query = `
          INSERT INTO Imp_desclie (
            RUCLIE, PRODUCTO, DESCUENTO1, DESCUENTO2, DESCUENTO3, REMPLAZO
          ) 
          VALUES (
            @ruclie, @producto, @descuento1, @descuento2, @descuento3, @remplazo
          )
        `;

        await executeQuery(query.replace(
          /@ruclie|@producto|@descuento1|@descuento2|@descuento3|@remplazo/g, 
          match => {
            switch(match) {
              case '@ruclie': return `'${ruclie}'`;
              case '@producto': return `'${zeroFill(producto, 5)}'`;
              case '@descuento1': return descuento1;
              case '@descuento2': return descuento2;
              case '@descuento3': return descuento3;
              case '@remplazo': return remplazo;
            }
          }
        ));

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
      message: `Archivo Descuento por Cliente importado correctamente. Se procesaron ${processedCount} registros. Errores: ${errorCount}` 
    });
    
  } catch (error) {
    console.error('Error al importar archivo Descuento por Cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al importar archivo: ' + error.message 
    });
  }
});

// Vaciar tabla de Descuento por Cliente
router.delete('/clear', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Imp_desclie');
    res.json({ 
      success: true, 
      message: 'Tabla Descuento por Cliente vaciada correctamente' 
    });
  } catch (error) {
    console.error('Error al vaciar tabla Descuento por Cliente:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al vaciar tabla: ' + error.message 
    });
  }
});

// Subir a tabla de producción Desclie (usando stored procedure)
router.post('/upload-to-prod', async (req, res) => {
  try {
    await executeQuery('EXEC sp_Desclie_importa2');
    
    res.json({ 
      success: true, 
      message: 'Datos subidos a Desclie correctamente' 
    });
  } catch (error) {
    console.error('Error al subir a producción:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al subir a producción: ' + error.message 
    });
  }
});

module.exports = router; 