const express = require('express');
const router = express.Router();
const path = require('path');
const readXlsxFile = require('read-excel-file/node');
const { executeQuery } = require('../database');
const { upload } = require('../utils/fileHandler');
const fs = require('fs');
const sql = require('mssql');
const ExcelJS = require('exceljs'); // Importar ExcelJS a nivel de módulo
const XLSX = require('xlsx'); // Importar la biblioteca SheetJS/xlsx

const CLOSE_CONNECTION = process.env.CLOSE_CONNECTION !== 'false';

// Función para rellenar con ceros a la izquierda (similar a zero_fill en PHP)
function zeroFill(value, length = 0) {
  if (!value) return ''.padStart(length, '0');
  return value.toString().padStart(length, '0');
}

// Función para convertir formato de fecha de DD/MM/YYYY a YYYYMMDD
function formatearFecha(fecha) {
  if (!fecha) return '';
  
  // Convertir a string para asegurar que podemos usar métodos como includes
  let fechaStr = String(fecha);
  
  // Si la fecha ya está en formato YYYYMMDD (8 dígitos numéricos), devolverla tal cual
  if (/^\d{8}$/.test(fechaStr)) {
    return fechaStr;
  }
  
  // Si la fecha tiene formato DD/MM/YYYY
  if (fechaStr.includes('/')) {
    const partes = fechaStr.split('/');
    if (partes.length === 3) {
      // Trabajar directamente con los componentes de la fecha sin usar Date
      const dia = partes[0].padStart(2, '0');
      const mes = partes[1].padStart(2, '0');
      const año = partes[2];
      
      return `${año}${mes}${dia}`;
    }
  }
  
  // Si la fecha tiene formato DD-MM-YYYY o YYYY-MM-DD
  if (fechaStr.includes('-')) {
    const partes = fechaStr.split('-');
    if (partes.length === 3) {
      // Verificar si el primer componente es el año (YYYY-MM-DD)
      if (partes[0].length === 4) {
        const año = partes[0];
        const mes = partes[1].padStart(2, '0');
        const dia = partes[2].padStart(2, '0');
        return `${año}${mes}${dia}`;
      } else {
        // Formato DD-MM-YYYY
        const dia = partes[0].padStart(2, '0');
        const mes = partes[1].padStart(2, '0');
        const año = partes[2];
        return `${año}${mes}${dia}`;
      }
    }
  }
  
  // Formato de texto como "Wed May 14 2025"
  const regexFormatoLargo = /\w+\s+(\w+)\s+(\d+)\s+(\d+)/; // Día semana, Mes, Día, Año
  const matchLargo = fechaStr.match(regexFormatoLargo);
  if (matchLargo) {
    const meses = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    };
    
    const mes = meses[matchLargo[1]] || '01';
    const dia = String(parseInt(matchLargo[2])).padStart(2, '0');
    const año = matchLargo[3];
    
    return `${año}${mes}${dia}`;
  }
  
  // Si no se pudo convertir, devolver la fecha original
  console.log('Formato de fecha no reconocido:', fechaStr);
  return fechaStr;
}

// Función para procesar las fechas en formato 2025-05-17T00:00:00.000Z a formato YYYYMMDD
function procesarFechaExcel(fechaObj) {
  // Si es un objeto Date o fecha ISO
  if (fechaObj instanceof Date || (typeof fechaObj === 'string' && fechaObj.includes('T'))) {
    try {
      // Para evitar problemas de zona horaria, parseamos la fecha manualmente
      let anio, mes, dia;
      
      if (typeof fechaObj === 'string') {
        // Si es una fecha ISO como "2025-05-17T00:00:00.000Z"
        const match = fechaObj.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          anio = match[1];
          mes = match[2];
          dia = match[3];
          // Ya tenemos los componentes, no hace falta usar Date
          return `${anio}${mes}${dia}`;
        }
      }
      
      // Si llegamos aquí, es porque no pudimos extraer los componentes directamente
      // Usamos UTC para evitar problemas de zona horaria
      const fecha = fechaObj instanceof Date ? fechaObj : new Date(fechaObj);
      anio = fecha.getUTCFullYear();
      mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      dia = String(fecha.getUTCDate()).padStart(2, '0');
      
      // Formato YYYYMMDD
      return `${anio}${mes}${dia}`;
    } catch (error) {
      console.error('Error al procesar fecha:', error);
      return '';
    }
  }
  
  // Si es objeto con value (formato de ExcelJS)
  if (fechaObj && typeof fechaObj === 'object' && fechaObj.value) {
    if (fechaObj.value instanceof Date) {
      const fecha = fechaObj.value;
      // Usamos métodos UTC para evitar problemas de zona horaria
      const anio = fecha.getUTCFullYear();
      const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getUTCDate()).padStart(2, '0');
      return `${anio}${mes}${dia}`;
    } else if (typeof fechaObj.value === 'string' && fechaObj.value.includes('-')) {
      // Si es un string ISO como "2025-05-17"
      const match = fechaObj.value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const anio = match[1];
        const mes = match[2];
        const dia = match[3];
        return `${anio}${mes}${dia}`;
      }
    }
    return String(fechaObj.value);
  }
  
  // Si es string con formato DD/MM/YYYY o DD-MM-YYYY
  if (typeof fechaObj === 'string') {
    // Con slashes
    if (fechaObj.includes('/')) {
      const partes = fechaObj.split('/');
      if (partes.length === 3) {
        const dia = partes[0].padStart(2, '0');
        const mes = partes[1].padStart(2, '0');
        const anio = partes[2];
        return `${anio}${mes}${dia}`;
      }
    }
    
    // Con guiones
    if (fechaObj.includes('-')) {
      const partes = fechaObj.split('-');
      if (partes.length === 3) {
        // Verificar si es YYYY-MM-DD o DD-MM-YYYY
        if (partes[0].length === 4) {
          // YYYY-MM-DD
          const anio = partes[0];
          const mes = partes[1].padStart(2, '0');
          const dia = partes[2].padStart(2, '0');
          return `${anio}${mes}${dia}`;
        } else {
          // DD-MM-YYYY
          const dia = partes[0].padStart(2, '0');
          const mes = partes[1].padStart(2, '0');
          const anio = partes[2];
          return `${anio}${mes}${dia}`;
        }
      }
    }
    
    return fechaObj;
  }
  
  // Si no se pudo procesar, devolvemos cadena vacía
  return '';
}

// Obtener todos los registros de BCP
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM t_movimiento');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener registros de BCP:', error);
    res.status(500).json({ error: 'Error al obtener registros' });
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
      // Leer archivo Excel - Usamos opciones para conservar los valores originales
      console.log('Leyendo archivo Excel...');
      
      // Verificar extensión del archivo
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      let rows = [];
      
      if (fileExtension === '.xlsx') {
        // Usar ExcelJS para archivos XLSX
        try {
          console.log('Leyendo archivo XLSX con ExcelJS...');
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(filePath);
          
          // Asegurarnos de que el workbook tenga hojas
          if (!workbook.worksheets || workbook.worksheets.length === 0) {
            throw new Error('El archivo Excel no contiene hojas de trabajo');
          }
          
          const worksheet = workbook.getWorksheet(1);
          if (!worksheet) {
            throw new Error('No se pudo encontrar la primera hoja de trabajo en el archivo Excel');
          }
          
          // Extraer todas las filas
          worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            rows.push(row.values);
          });
        } catch (readError) {
          console.error('Error al leer archivo XLSX con ExcelJS:', readError);
          throw new Error('Error al leer archivo XLSX: ' + readError.message);
        }
      } else if (fileExtension === '.xls') {
        // Usar xlsx (SheetJS) para archivos XLS (mayor compatibilidad con formatos antiguos)
        try {
          console.log('Leyendo archivo XLS con xlsx (SheetJS)...');
          
          // Leer el archivo con SheetJS
          const workbook = XLSX.readFile(filePath, {
            type: 'binary',
            cellDates: true,
            cellNF: false,
            cellText: false
          });
          
          // Obtener la primera hoja
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            throw new Error('El archivo XLS no contiene hojas de trabajo');
          }
          
          const worksheet = workbook.Sheets[sheetName];
          
          // Convertir a JSON para facilitar el procesamiento
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: true,
            dateNF: 'yyyy-mm-dd'
          });
          
          if (!jsonData || jsonData.length === 0) {
            throw new Error('El archivo XLS está vacío o no contiene datos válidos');
          }
          
          console.log(`Datos extraídos con SheetJS: ${jsonData.length} filas`);
          
          // Transformar para mantener el mismo formato que el resultado de ExcelJS
          // (ExcelJS usa un array que empieza en índice 1)
          for (const row of jsonData) {
            const transformedRow = [undefined]; // índice 0 vacío para mantener compatibilidad
            for (let i = 0; i < row.length; i++) {
              transformedRow.push(row[i]); // añadir valores con índice desplazado
            }
            rows.push(transformedRow);
          }
        } catch (readError) {
          console.error('Error al leer archivo XLS con SheetJS:', readError);
          throw new Error('Error al leer archivo XLS: ' + readError.message);
        }
      } else {
        // Si no es un formato reconocido, lanzar error
        throw new Error('Formato de archivo no soportado. Use archivos .xlsx o .xls');
      }
      
      console.log(`Se encontraron ${rows.length} filas en el Excel`);
      
      // Saltar la primera fila (encabezados)
      const dataRows = rows.slice(1);
      
      // Crear una conexión a la base de datos que podamos reutilizar
      pool = await sql.connect({
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        options: {
          encrypt: process.env.DB_ENCRYPT === 'true',
          enableArithAbort: process.env.DB_ENABLE_ARITH_ABORT === 'true',
          trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
          connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 30000,
          requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 30000
        },
        pool: {
          max: parseInt(process.env.DB_POOL_MAX) || 10,
          min: parseInt(process.env.DB_POOL_MIN) || 0,
          idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
          acquireTimeoutMillis: 30000
        }
      });
      console.log('Conexión a base de datos establecida');
      
      let processedCount = 0;
      let errorCount = 0;
      
      // Vaciar tabla antes de importar
      await pool.request().query('DELETE FROM t_movimiento');
      console.log('Tabla t_movimiento vaciada correctamente');
      
      // Procesar cada fila del Excel
      for (const row of dataRows) {
        try {
          // Procesar fechas
          const fechaOriginal = row[1]; // ExcelJS inicia en índice 1
          console.log('Fecha original:', fechaOriginal);
          
          // Usar la nueva función para procesamiento de fechas
          const fechaFormateada = procesarFechaExcel(fechaOriginal);
          console.log('Fecha formateada:', fechaFormateada);
          
          // Procesar fecha valuta
          const fechaValutaOriginal = row[2]; // ExcelJS inicia en índice 1
          console.log('FechaValuta original:', fechaValutaOriginal);
          const fechaValuta = procesarFechaExcel(fechaValutaOriginal);
          console.log('FechaValuta formateada:', fechaValuta);
          
          // Si la fecha está vacía, no procesamos la fila
          if (!fechaFormateada) {
            console.error('Error: Fecha no válida', fechaOriginal);
            errorCount++;
            continue;
          }
          
          // Procesar el resto de campos
          const descripcion = row[3] ? (typeof row[3] === 'object' ? row[3].value : row[3]).toString() : '';
          const monto = parseFloat(typeof row[4] === 'object' ? row[4].value : row[4] || 0);
          const sucursal = row[5] ? (typeof row[5] === 'object' ? row[5].value : row[5]).toString() : '';
          const opeNum = row[6] ? (typeof row[6] === 'object' ? row[6].value : row[6]).toString() : '';
          const opeHor = row[7] ? (typeof row[7] === 'object' ? row[7].value : row[7]).toString() : '';
          const usuario = row[8] ? (typeof row[8] === 'object' ? row[8].value : row[8]).toString() : '';
          const utc = row[9] ? (typeof row[9] === 'object' ? row[9].value : row[9]).toString() : '';
          const referencia = row[10] ? (typeof row[10] === 'object' ? row[10].value : row[10]).toString() : '';

          // Usar parámetros preparados en lugar de reemplazos de cadena
          const request = pool.request();
          request.input('fecha', sql.VarChar, fechaFormateada);
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
    // Cerrar la conexión si está abierta y la configuración lo permite
    if (pool && CLOSE_CONNECTION) {
      try {
        await pool.close();
        console.log('Conexión a la base de datos cerrada');
      } catch (err) {
        console.error('Error al cerrar la conexión:', err);
      }
    } else if (pool) {
      console.log('La conexión a la base de datos permanece abierta');
    }
  }
});

// Vaciar tabla BCP
router.delete('/clear', async (req, res) => {
  try {
    await executeQuery('DELETE FROM t_movimiento');
    res.json({ success: true, message: 'Tabla t_movimiento vaciada correctamente' });
  } catch (error) {
    console.error('Error al vaciar tabla BCP:', error);
    res.status(500).json({ success: false, error: 'Error al vaciar tabla' });
  }
});

// Subir a producción
router.post('/upload-to-prod', async (req, res) => {
  try {
    await executeQuery('EXEC sp_voucher_importa2');
    res.json({ success: true, message: 'Datos subidos a producción correctamente' });
  } catch (error) {
    console.error('Error al subir a producción:', error);
    res.status(500).json({ success: false, error: 'Error al subir a producción' });
  }
});

module.exports = router;