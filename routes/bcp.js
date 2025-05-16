const express = require('express');
const router = express.Router();
const path = require('path');
const readXlsxFile = require('read-excel-file/node');
const { executeQuery } = require('../database');
const { upload } = require('../utils/fileHandler');
const fs = require('fs');
const sql = require('mssql');
const config = require('../config');

// Función para rellenar con ceros a la izquierda (similar a zero_fill en PHP)
function zeroFill(value, length = 0) {
  if (!value) return ''.padStart(length, '0');
  return value.toString().padStart(length, '0');
}

// Función para convertir formato de fecha de DD/MM/YYYY a YYYYMMDD
function formatearFecha(fecha) {
  if (!fecha) return '';
  
  // Si la fecha ya está en formato YYYYMMDD (8 dígitos numéricos), devolverla tal cual
  if (/^\d{8}$/.test(fecha)) {
    return fecha;
  }
  
  // Si la fecha tiene formato DD/MM/YYYY
  if (fecha.includes('/')) {
    const partes = fecha.split('/');
    if (partes.length === 3) {
      const dia = partes[0].padStart(2, '0');
      const mes = partes[1].padStart(2, '0');
      const año = partes[2];
      
      return `${año}${mes}${dia}`;
    }
  }
  
  // Si es un objeto Date de JavaScript o tiene el formato "Wed May 14 2025..."
  try {
    // Intentar parsear la fecha
    const dateObj = new Date(fecha);
    
    // Verificar si es una fecha válida
    if (!isNaN(dateObj.getTime())) {
      const año = dateObj.getFullYear();
      const mes = String(dateObj.getMonth() + 1).padStart(2, '0'); // +1 porque los meses van de 0-11
      const dia = String(dateObj.getDate()).padStart(2, '0');
      
      return `${año}${mes}${dia}`;
    }
  } catch (error) {
    console.log('Error al parsear fecha:', error);
  }
  
  // Si no se puede convertir, devolver la fecha original
  return fecha;
}

// Obtener todos los registros de BCP
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM t_movimiento');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener registros de BCP:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener registros: ' + error.message 
    });
  }
});

// Importar archivo Excel de BCP
router.post('/import', upload.single('file'), async (req, res) => {
  let pool = null;
  
  try {
    // Verificar que se haya subido un archivo
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se ha subido ningún archivo' 
      });
    }

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    console.log('Ruta del archivo:', filePath);
    
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'El archivo subido no se encuentra en el servidor'
      });
    }
    
    try {
      // Leer archivo Excel
      console.log('Leyendo archivo Excel...');
      const rows = await readXlsxFile(filePath);
      console.log(`Se encontraron ${rows.length} filas en el Excel`);
      
      // Saltar la primera fila (encabezados)
      const dataRows = rows.slice(1);
      
      // Crear una conexión a la base de datos que podamos reutilizar
      pool = await sql.connect(config.dbConfig);
      console.log('Conexión a base de datos establecida');
      
      let processedCount = 0;
      let errorCount = 0;
      
      // Vaciar tabla antes de importar
      await pool.request().query('DELETE FROM t_movimiento');
      console.log('Tabla t_movimiento vaciada correctamente');
      
      // Procesar cada fila del Excel
      for (const row of dataRows) {
        try {
          // Convertir fecha al formato YYYYMMDD
          const fechaOriginal = row[0] ? row[0].toString() : '';
          const fecha = formatearFecha(fechaOriginal);
          
          const fechaValuta = row[1] ? row[1].toString() : '';
          const descripcion = row[2] ? row[2].toString() : '';
          const monto = parseFloat(row[3] || 0);
          const sucursal = row[4] ? row[4].toString() : '';
          const opeNum = row[5] ? row[5].toString() : '';
          const opeHor = row[6] ? row[6].toString() : '';
          const usuario = row[7] ? row[7].toString() : '';
          const utc = row[8] ? row[8].toString() : '';
          const referencia = row[9] ? row[9].toString() : '';

          console.log(`Procesando fila: fecha=${fecha} (original: ${fechaOriginal}), monto=${monto}`);

          // Usar parámetros preparados en lugar de reemplazos de cadena
          const request = pool.request();
          request.input('fecha', sql.VarChar, fecha);
          request.input('fechaValuta', sql.VarChar, fechaValuta);
          request.input('descripcion', sql.VarChar, descripcion);
          request.input('monto', sql.Float, monto);
          request.input('sucursal', sql.VarChar, sucursal);
          request.input('opeNum', sql.VarChar, zeroFill(opeNum, 8));
          request.input('opeHor', sql.VarChar, opeHor);
          request.input('usuario', sql.VarChar, usuario);
          request.input('utc', sql.VarChar, zeroFill(utc, 4));
          request.input('referencia', sql.VarChar, referencia);

          const query = `
            INSERT INTO t_movimiento (
              Fecha, Fecha_valuta, Descripcion, Monto, Sucursal, 
              Ope_num, Ope_hor, Usuario, UTC, Referencia
            ) 
            VALUES (
              @fecha, @fechaValuta, @descripcion, @monto, @sucursal, 
              @opeNum, @opeHor, @usuario, @utc, @referencia
            )
          `;

          await request.query(query);
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
      
      // Obtener los datos importados para enviarlos en la respuesta
      const dataResult = await pool.request().query('SELECT * FROM t_movimiento');
      
      res.json({ 
        success: true, 
        message: `Archivo BCP importado correctamente. Se procesaron ${processedCount} registros. Errores: ${errorCount}`,
        data: dataResult.recordset
      });
    } catch (excelError) {
      console.error('Error al procesar el archivo Excel:', excelError);
      // Intentar leer el archivo como texto plano para depuración
      const fileContent = fs.readFileSync(filePath, 'utf8');
      console.log('Contenido del archivo:', fileContent.substring(0, 500) + '...');
      throw new Error('Error al procesar el archivo Excel: ' + excelError.message);
    }
    
  } catch (error) {
    console.error('Error al importar archivo BCP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al importar archivo: ' + error.message 
    });
  } finally {
    // Cerrar la conexión si está abierta
    if (pool) {
      try {
        await pool.close();
        console.log('Conexión a la base de datos cerrada');
      } catch (err) {
        console.error('Error al cerrar la conexión:', err);
      }
    }
  }
});

// Vaciar tabla de BCP
router.delete('/clear', async (req, res) => {
  try {
    await executeQuery('DELETE FROM t_movimiento');
    res.json({ 
      success: true, 
      message: 'Tabla BCP vaciada correctamente' 
    });
  } catch (error) {
    console.error('Error al vaciar tabla BCP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al vaciar tabla: ' + error.message 
    });
  }
});

// Subir a tabla de producción MovimientoBanco (usando stored procedure)
router.post('/upload-to-prod', async (req, res) => {
  try {
    console.log('Ejecutando stored procedure sp_voucher_importa2...');
    
    // EJECUTAR ÚNICAMENTE EL STORED PROCEDURE, sin ninguna validación adicional
    await executeQuery('EXEC sp_voucher_importa2');
    
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