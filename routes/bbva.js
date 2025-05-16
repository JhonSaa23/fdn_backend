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

// Obtener todos los registros de BBVA
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM t_Movimiento1');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener registros de BBVA:', error);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});

// Importar archivo Excel de BBVA
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
        const codigo = row[0] || '';
        const descripcion = row[1] || '';
        const monto = parseFloat(row[2]) || 0;
        const pago = parseFloat(row[3]) || 0;
        const oficina = row[4] ? row[4].toString() : '';
        const movimiento = row[5] || '';
        const fecPag = row[6] || '';
        const fecProc = row[7] || '';
        const forma = row[8] || '';
        const canal = row[9] || '';

        // Insertar en la base de datos
        const query = `
          INSERT INTO t_Movimiento1 (
            Código, Descripcion, Monto, Pago, Oficina, 
            Movimiento, FecPag, FecProc, Forma, Canal
          ) 
          VALUES (
            @codigo, @descripcion, @monto, @pago, @oficina, 
            @movimiento, @fecPag, @fecProc, @forma, @canal
          )
        `;

        await executeQuery(query.replace(
          /@codigo|@descripcion|@monto|@pago|@oficina|@movimiento|@fecPag|@fecProc|@forma|@canal/g, 
          match => {
            switch(match) {
              case '@codigo': return `'${codigo}'`;
              case '@descripcion': return `'${descripcion.replace(/'/g, "''")}'`;
              case '@monto': return monto;
              case '@pago': return pago;
              case '@oficina': return `'${zeroFill(oficina, 4)}'`;
              case '@movimiento': return `'${movimiento}'`;
              case '@fecPag': return `'${fecPag}'`;
              case '@fecProc': return `'${fecProc}'`;
              case '@forma': return `'${forma}'`;
              case '@canal': return `'${canal}'`;
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
      message: `Archivo BBVA importado correctamente. Se procesaron ${processedCount} registros. Errores: ${errorCount}` 
    });
    
  } catch (error) {
    console.error('Error al importar archivo BBVA:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al importar archivo: ' + error.message 
    });
  }
});

// Vaciar tabla de BBVA
router.delete('/clear', async (req, res) => {
  try {
    await executeQuery('DELETE FROM t_Movimiento1');
    res.json({ 
      success: true, 
      message: 'Tabla BBVA vaciada correctamente' 
    });
  } catch (error) {
    console.error('Error al vaciar tabla BBVA:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al vaciar tabla: ' + error.message 
    });
  }
});

// Subir a tabla de producción MovimientoBanco (usando stored procedure)
router.post('/upload-to-prod', async (req, res) => {
  try {
    await executeQuery('EXEC sp_voucher_importa4');
    
    res.json({ 
      success: true, 
      message: 'Datos subidos a MovimientoBanco correctamente' 
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