const express = require('express');
const router = express.Router();
const path = require('path');
const readXlsxFile = require('read-excel-file/node');
const { executeQuery } = require('../database');
const { upload } = require('../utils/fileHandler');
const yadbf = require('yadbf');
const fs = require('fs');

// Función para rellenar con ceros a la izquierda
function zeroFill(value, length = 0) {
  return String(value).padStart(length, '0');
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
  
  // Si es un número (tipo Excel), intentar convertirlo a fecha
  if (typeof fecha === 'number') {
    try {
      // Convertir número de Excel a fecha JavaScript
      // Excel usa un sistema donde 1 = 1/1/1900, 2 = 2/1/1900, etc.
      // pero hay un error en Excel que considera incorrectamente que 1900 fue bisiesto
      const excelEpoch = new Date(1899, 11, 30);
      const fechaObj = new Date(excelEpoch.getTime() + fecha * 86400000);
      
      const año = fechaObj.getFullYear();
      const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaObj.getDate()).padStart(2, '0');
      
      return `${año}${mes}${dia}`;
    } catch (error) {
      console.log('Error al convertir número Excel a fecha:', error);
      return '';
    }
  }
  
  // Si la fecha tiene formato DD/MM/YYYY
  if (fechaStr.includes('/')) {
    const partes = fechaStr.split('/');
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
  
  // Si no se puede convertir, devolver una cadena vacía
  return '';
}

// Obtener todos los registros de Medifarma
router.get('/', async (req, res) => {
  try {
    // Modificar la consulta para obtener solo los primeros 100 registros
    const result = await executeQuery('SELECT TOP 100 * FROM Medifarma');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener registros de Medifarma:', error);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});

// Importar archivo Excel o DBF de Medifarma
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No se ha subido ningún archivo' 
      });
    }

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    // Verificar que el archivo existe y es accesible
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ 
        success: false, 
        error: 'El archivo subido no se encontró en el servidor' 
      });
    }

    // Procesar según el tipo de archivo
    if (fileExtension === '.dbf' || fileExtension === '.xlsx' || fileExtension === '.xls') {
      try {
        console.log('Iniciando procesamiento de archivo:', req.file.originalname);
        
        // Cargar datos directamente a la tabla Medifarma
        let totalRows = 0;
        
        if (fileExtension === '.dbf') {
          // Procesamiento específico para DBF
          totalRows = await procesarArchivoDBF(filePath);
        } else {
          // Procesamiento específico para Excel
          totalRows = await procesarArchivoExcel(filePath);
        }
        
        console.log(`Archivo procesado correctamente. Total filas procesadas: ${totalRows}`);
        
        // Ejecutar el procedimiento almacenado para completar el procesamiento
        console.log('Ejecutando procedimiento almacenado sp_Medifarma_importa2...');
        await executeQuery("EXEC sp_Medifarma_importa2");
        console.log('Procedimiento almacenado ejecutado con éxito');
        
        // Elimina el archivo temporal después de procesarlo
        try {
          fs.unlinkSync(filePath);
          console.log(`Archivo temporal eliminado: ${filePath}`);
        } catch (unlinkError) {
          console.error(`Error al eliminar archivo temporal: ${unlinkError.message}`);
        }
        
        return res.json({ 
          success: true, 
          message: `Archivo importado correctamente. Total filas: ${totalRows}`,
          totalRows: totalRows
        });
          
      } catch (fileError) {
        console.error('Error general al procesar archivo:', fileError);
        return res.status(500).json({ 
          success: false, 
          error: 'Error al procesar archivo: ' + fileError.message 
        });
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Formato de archivo no soportado. Use archivos .xlsx, .xls o .dbf' 
      });
    }
    
  } catch (error) {
    console.error('Error general al importar archivo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al importar archivo: ' + error.message 
    });
  }
});

// Función auxiliar para procesar archivos DBF
async function procesarArchivoDBF(filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Procesando archivo DBF:', filePath);
      const fileStream = fs.createReadStream(filePath, { 
        highWaterMark: 64 * 1024 // 64KB chunks para mejor rendimiento
      });
      const dbfStream = new yadbf(fileStream, { encoding: 'utf8' });
      
      let processedCount = 0;
      const records = [];
      
      dbfStream.on('header', header => {
        console.log(`Cabecera DBF leída: ${header.fields.length} campos detectados`);
      });

      dbfStream.on('data', record => {
        records.push(record);
      });
      
      dbfStream.on('error', err => {
        console.error('Error al leer archivo DBF:', err);
        reject(err);
      });
      
      dbfStream.on('end', async () => {
        try {
          console.log(`Archivo DBF leído correctamente. ${records.length} registros encontrados`);
          
          // Procesar los registros por lotes
          const batchSize = 50;
          const totalBatches = Math.ceil(records.length / batchSize);
          
          for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIdx = batchIndex * batchSize;
            const endIdx = Math.min(startIdx + batchSize, records.length);
            const batchRecords = records.slice(startIdx, endIdx);
            
            // Crear un pool de conexión por lote
            const pool = await require('../database').connectDB();
            
            try {
              // Procesar cada registro en el lote actual
              for (const record of batchRecords) {
                // Aplicar transformaciones
                const canal = '';
                const ciudad = '0';
                
                // Formatear fechas
                let fecdes = '';
                let fechas = '';
                
                if (record.FECDES) {
                  fecdes = formatearFecha(record.FECDES);
                }
                
                if (record.FECHAS) {
                  fechas = formatearFecha(record.FECHAS);
                }
                
                // Normalizar campos
                const codprom = record.CODPROM || '';
                const desc_cab = record.DESC_CAB || '';
                const codoferta = zeroFill(record.CODOFERTA || '', 3);
                const desc_det = record.DESC_DET || '';
                const paquete = record.PAQUETE || '';
                const sol_com = record.SOL_COM || '';
                const descto = parseFloat(record.DESCTO || 0);
                const topeval = parseFloat(record.TOPE_VAL || 0);
                const flg_tip = record.FLG_TIP || '';
                const val_basi = parseFloat(record.VAL_BASI || 0);
                const codprod = String(record.CODPROD || '');
                const descrip = record.DESCRIP || '';
                const desde_la = parseFloat(record.DESDE_LA || 0);
                const desde_und = parseFloat(record.DESDE_UND || 0);
                const hasta_und = parseFloat(record.HASTA_UND || 0);
                const porcen = parseFloat(record.PORCEN || 0);
                const dsct_mif = parseFloat(record.DSCT_MIF || 0);
                const dsct_prv = parseFloat(record.DSCT_PRV || 0);
                const ind_uni = record.IND_UNI || '';
                const cod_bon = record.COD_BON ? String(record.COD_BON) : null;
                const can_bon = parseFloat(record.CAN_BON || 0);
                const descri = record.DESCRI || '';
                const ind_uni1 = record.IND_UNI1 || '';
                const cod_bo1 = record.COD_BO1 ? String(record.COD_BO1) : null;
                const can_bo1 = parseFloat(record.CAN_BO1 || 0);
                const ind_uni2 = record.IND_UNI2 || '';
                const cod_bo2 = record.COD_BO2 ? String(record.COD_BO2) : null;
                const can_bo2 = parseFloat(record.CAN_BO2 || 0);
                const ind_uni3 = record.IND_UNI3 || '';
                const cod_bo3 = record.COD_BO3 ? String(record.COD_BO3) : null;
                const can_bo3 = parseFloat(record.CAN_BO3 || 0);
                const ind_uni4 = record.IND_UNI4 || '';
                const cod_bo4 = record.COD_BO4 ? String(record.COD_BO4) : null;
                const can_bo4 = parseFloat(record.CAN_BO4 || 0);
                const ind_uni5 = record.IND_UNI5 || '';
                const cod_bo5 = record.COD_BO5 ? String(record.COD_BO5) : null;
                const can_bo5 = parseFloat(record.CAN_BO5 || 0);
                const multiplo = parseFloat(record.MULTIPLO || 0);
                const pasa = record.PASA || '';
                const des_bo1 = parseFloat(record.DES_BO1 || 0);
                const des_bo2 = parseFloat(record.DES_BO2 || 0);
                const des_bo3 = parseFloat(record.DES_BO3 || 0);
                const des_bo4 = parseFloat(record.DES_BO4 || 0);
                const des_bo5 = parseFloat(record.DES_BO5 || 0);
                const campana = record.CAMPANA || '';

                // Insertar en la base de datos
                const query = `
                  INSERT INTO Medifarma (
                    codprom, desc_cab, canal, fecdes, fechas, codoferta, desc_det,
                    ciudades, paquete, sol_com, descto, tope_val, flg_tip, val_basi,
                    codprod, descrip, desde_la, desde_und, hasta_und, porcen,
                    dsct_mif, dsct_prv, ind_uni, cod_bon, can_bon, descri,
                    ind_uni1, cod_bo1, can_bo1, ind_uni2, cod_bo2, can_bo2,
                    ind_uni3, cod_bo3, can_bo3, ind_uni4, cod_bo4, can_bo4,
                    ind_uni5, cod_bo5, can_bo5, multiplo, pasa,
                    des_bo1, des_bo2, des_bo3, des_bo4, des_bo5, campana
                  ) VALUES (
                    @codprom, @desc_cab, @canal, @fecdes, @fechas, @codoferta, @desc_det,
                    @ciudad, @paquete, @sol_com, @descto, @topeval, @flg_tip, @val_basi,
                    @codprod, @descrip, @desde_la, @desde_und, @hasta_und, @porcen,
                    @dsct_mif, @dsct_prv, @ind_uni, @cod_bon, @can_bon, @descri,
                    @ind_uni1, @cod_bo1, @can_bo1, @ind_uni2, @cod_bo2, @can_bo2,
                    @ind_uni3, @cod_bo3, @can_bo3, @ind_uni4, @cod_bo4, @can_bo4,
                    @ind_uni5, @cod_bo5, @can_bo5, @multiplo, @pasa,
                    @des_bo1, @des_bo2, @des_bo3, @des_bo4, @des_bo5, @campana
                  )
                `;
                
                const request = pool.request();
                request.input('codprom', codprom);
                request.input('desc_cab', desc_cab);
                request.input('canal', canal);
                request.input('fecdes', fecdes);
                request.input('fechas', fechas);
                request.input('codoferta', codoferta);
                request.input('desc_det', desc_det);
                request.input('ciudad', ciudad);
                request.input('paquete', paquete);
                request.input('sol_com', sol_com);
                request.input('descto', descto);
                request.input('topeval', topeval);
                request.input('flg_tip', flg_tip);
                request.input('val_basi', val_basi);
                request.input('codprod', codprod);
                request.input('descrip', descrip);
                request.input('desde_la', desde_la);
                request.input('desde_und', desde_und);
                request.input('hasta_und', hasta_und);
                request.input('porcen', porcen);
                request.input('dsct_mif', dsct_mif);
                request.input('dsct_prv', dsct_prv);
                request.input('ind_uni', ind_uni);
                request.input('cod_bon', cod_bon);
                request.input('can_bon', can_bon);
                request.input('descri', descri);
                request.input('ind_uni1', ind_uni1);
                request.input('cod_bo1', cod_bo1);
                request.input('can_bo1', can_bo1);
                request.input('ind_uni2', ind_uni2);
                request.input('cod_bo2', cod_bo2);
                request.input('can_bo2', can_bo2);
                request.input('ind_uni3', ind_uni3);
                request.input('cod_bo3', cod_bo3);
                request.input('can_bo3', can_bo3);
                request.input('ind_uni4', ind_uni4);
                request.input('cod_bo4', cod_bo4);
                request.input('can_bo4', can_bo4);
                request.input('ind_uni5', ind_uni5);
                request.input('cod_bo5', cod_bo5);
                request.input('can_bo5', can_bo5);
                request.input('multiplo', multiplo);
                request.input('pasa', pasa);
                request.input('des_bo1', des_bo1);
                request.input('des_bo2', des_bo2);
                request.input('des_bo3', des_bo3);
                request.input('des_bo4', des_bo4);
                request.input('des_bo5', des_bo5);
                request.input('campana', campana);
                
                await request.query(query);
                processedCount++;
              }
            } catch (batchError) {
              console.error('Error procesando lote de registros DBF:', batchError);
            } finally {
              const percentComplete = Math.round((processedCount / records.length) * 100);
              console.log(`Procesados ${processedCount} de ${records.length} registros (${percentComplete}%)`);
            }
          }
          
          console.log('Procesamiento DBF completado.');
          resolve(processedCount);
        } catch (error) {
          console.error('Error procesando registros DBF:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error inicializando procesamiento DBF:', error);
      reject(error);
    }
  });
}

// Función auxiliar para procesar archivos Excel
async function procesarArchivoExcel(filePath) {
  try {
    console.log('Procesando archivo Excel:', filePath);
    
    // Leer archivo Excel
    const rows = await readXlsxFile(filePath);
    
    // Saltar la primera fila (encabezados)
    const dataRows = rows.slice(1);
    
    console.log(`Total de filas en el archivo Excel: ${dataRows.length}`);
    
    let processedCount = 0;
    
    // Procesar cada fila
    for (const row of dataRows) {
      const codprom = row[0];
      const desc_cab = row[1];
      const canal = ''; // Vaciar columna canal como solicitado
      const fecdesOriginal = row[3];
      const fechasOriginal = row[4];
      // Formatear fechas al formato YYYYMMDD
      const fecdes = formatearFecha(fecdesOriginal);
      const fechas = formatearFecha(fechasOriginal);
      const codoferta = zeroFill(row[5], 3);
      const desc_det = row[6];
      const ciudad = '0'; // Establecer "0" en ciudades como solicitado
      const paquete = row[8];
      const sol_com = row[9];
      const descto = parseFloat(row[10] || 0);
      const topeval = parseFloat(row[11] || 0);
      const flg_tip = row[12];
      const val_basi = parseFloat(row[13] || 0);
      const codprod = String(row[14] || '');
      const descrip = row[15];
      const desde_la = parseFloat(row[16] || 0);
      const desde_und = parseFloat(row[17] || 0);
      const hasta_und = parseFloat(row[18] || 0);
      const porcen = parseFloat(row[19] || 0);
      const dsct_mif = parseFloat(row[20] || 0);
      const dsct_prv = parseFloat(row[21] || 0);
      const ind_uni = row[22];
      const cod_bon = row[23] ? String(row[23]) : null;
      const can_bon = parseFloat(row[24] || 0);
      const descri = row[25];
      const ind_uni1 = row[26];
      const cod_bo1 = row[27] ? String(row[27]) : null;
      const can_bo1 = parseFloat(row[28] || 0);
      const ind_uni2 = row[29];
      const cod_bo2 = row[30] ? String(row[30]) : null;
      const can_bo2 = parseFloat(row[31] || 0);
      const ind_uni3 = row[32];
      const cod_bo3 = row[33] ? String(row[33]) : null;
      const can_bo3 = parseFloat(row[34] || 0);
      const ind_uni4 = row[35];
      const cod_bo4 = row[36] ? String(row[36]) : null;
      const can_bo4 = parseFloat(row[37] || 0);
      const ind_uni5 = row[38];
      const cod_bo5 = row[39] ? String(row[39]) : null;
      const can_bo5 = parseFloat(row[40] || 0);
      const multiplo = parseFloat(row[41] || 0);
      const pasa = row[42];
      const des_bo1 = parseFloat(row[43] || 0);
      const des_bo2 = parseFloat(row[44] || 0);
      const des_bo3 = parseFloat(row[45] || 0);
      const des_bo4 = parseFloat(row[46] || 0);
      const des_bo5 = parseFloat(row[47] || 0);
      const campana = row[48];
      
      // Insertar en la base de datos
      const query = `
        INSERT INTO Medifarma (
          codprom, desc_cab, canal, fecdes, fechas, codoferta, desc_det,
          ciudades, paquete, sol_com, descto, tope_val, flg_tip, val_basi,
          codprod, descrip, desde_la, desde_und, hasta_und, porcen,
          dsct_mif, dsct_prv, ind_uni, cod_bon, can_bon, descri,
          ind_uni1, cod_bo1, can_bo1, ind_uni2, cod_bo2, can_bo2,
          ind_uni3, cod_bo3, can_bo3, ind_uni4, cod_bo4, can_bo4,
          ind_uni5, cod_bo5, can_bo5, multiplo, pasa,
          des_bo1, des_bo2, des_bo3, des_bo4, des_bo5, campana
        ) VALUES (
          @codprom, @desc_cab, @canal, @fecdes, @fechas, @codoferta, @desc_det,
          @ciudad, @paquete, @sol_com, @descto, @topeval, @flg_tip, @val_basi,
          @codprod, @descrip, @desde_la, @desde_und, @hasta_und, @porcen,
          @dsct_mif, @dsct_prv, @ind_uni, @cod_bon, @can_bon, @descri,
          @ind_uni1, @cod_bo1, @can_bo1, @ind_uni2, @cod_bo2, @can_bo2,
          @ind_uni3, @cod_bo3, @can_bo3, @ind_uni4, @cod_bo4, @can_bo4,
          @ind_uni5, @cod_bo5, @can_bo5, @multiplo, @pasa,
          @des_bo1, @des_bo2, @des_bo3, @des_bo4, @des_bo5, @campana
        )
      `;
      
      const pool = await require('../database').connectDB();
      const request = pool.request();
      
      // Agregar parámetros a la consulta
      request.input('codprom', codprom);
      request.input('desc_cab', desc_cab);
      request.input('canal', canal);
      request.input('fecdes', fecdes);
      request.input('fechas', fechas);
      request.input('codoferta', codoferta);
      request.input('desc_det', desc_det);
      request.input('ciudad', ciudad);
      request.input('paquete', paquete);
      request.input('sol_com', sol_com);
      request.input('descto', descto);
      request.input('topeval', topeval);
      request.input('flg_tip', flg_tip);
      request.input('val_basi', val_basi);
      request.input('codprod', codprod);
      request.input('descrip', descrip);
      request.input('desde_la', desde_la);
      request.input('desde_und', desde_und);
      request.input('hasta_und', hasta_und);
      request.input('porcen', porcen);
      request.input('dsct_mif', dsct_mif);
      request.input('dsct_prv', dsct_prv);
      request.input('ind_uni', ind_uni);
      request.input('cod_bon', cod_bon);
      request.input('can_bon', can_bon);
      request.input('descri', descri);
      request.input('ind_uni1', ind_uni1);
      request.input('cod_bo1', cod_bo1);
      request.input('can_bo1', can_bo1);
      request.input('ind_uni2', ind_uni2);
      request.input('cod_bo2', cod_bo2);
      request.input('can_bo2', can_bo2);
      request.input('ind_uni3', ind_uni3);
      request.input('cod_bo3', cod_bo3);
      request.input('can_bo3', can_bo3);
      request.input('ind_uni4', ind_uni4);
      request.input('cod_bo4', cod_bo4);
      request.input('can_bo4', can_bo4);
      request.input('ind_uni5', ind_uni5);
      request.input('cod_bo5', cod_bo5);
      request.input('can_bo5', can_bo5);
      request.input('multiplo', multiplo);
      request.input('pasa', pasa);
      request.input('des_bo1', des_bo1);
      request.input('des_bo2', des_bo2);
      request.input('des_bo3', des_bo3);
      request.input('des_bo4', des_bo4);
      request.input('des_bo5', des_bo5);
      request.input('campana', campana);
      
      await request.query(query);
      processedCount++;

      if (processedCount % 100 === 0) {
        console.log(`Procesados ${processedCount} registros`);
      }
    }
    
    console.log('Importación Excel completada. Registros procesados:', processedCount);
    return processedCount;
  } catch (error) {
    console.error('Error al procesar archivo Excel:', error);
    throw error;
  }
}

// Vaciar tabla de Medifarma
router.delete('/clear', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Medifarma');
    res.json({ 
      success: true, 
      message: 'Tabla Medifarma vaciada correctamente'
    });
  } catch (error) {
    console.error('Error al vaciar tabla:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al vaciar tabla: ' + error.message 
    });
  }
});

// Subir a tabla de producción MedifarmaProd
router.post('/upload-to-prod', async (req, res) => {
  try {
    await executeQuery(`
      INSERT INTO MedifarmaProd
      SELECT * FROM Medifarma
    `);
    
    res.json({ 
      success: true, 
      message: 'Datos subidos a MedifarmaProd correctamente'
    });
  } catch (error) {
    console.error('Error al subir a producción:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al subir a producción: ' + error.message 
    });
  }
});

// Importar archivo Excel de Medifarma (solo previsualización, sin insertar en BD)
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No se ha subido ningún archivo' 
      });
    }

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    // Solo permitir archivos Excel para previsualización
    if (fileExtension !== '.xlsx' && fileExtension !== '.xls') {
      return res.status(400).json({ 
        success: false, 
        error: 'Formato de archivo no soportado. Use archivos .xlsx o .xls para previsualización' 
      });
    }

    console.log('Previsualizando archivo Excel:', req.file.originalname);
    
    // Utilizar ExcelJS para streaming (más eficiente que read-excel-file)
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    let rows = [];
    try {
      if (fileExtension === '.xlsx') {
        await workbook.xlsx.readFile(filePath);
      } else {
        await workbook.xls.readFile(filePath);
      }
      
      const worksheet = workbook.getWorksheet(1); // Primera hoja
      
      // Limitar a 50 filas para previsualización (excluir la primera fila de encabezados)
      let rowCount = 0;
      const previewLimit = 50;
      
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // Saltar la primera fila (encabezados)
        if (rowNumber === 1) return;
        
        if (rowCount >= previewLimit) return;
        
        const valores = row.values;
        // ExcelJS usa índices basados en 1, ajustamos al formato esperado
        const rowData = {};
        
        // Aplicar las transformaciones requeridas
        // Canal vacío y ciudades = 0
        rowData.codprom = valores[1] || '';
        rowData.desc_cab = valores[2] || '';
        rowData.canal = ''; // Vaciar columna canal como solicitado
        
        // Formatear fechas
        const fecdesOriginal = valores[4];
        const fechasOriginal = valores[5];
        rowData.fecdes = formatearFecha(fecdesOriginal);
        rowData.fechas = formatearFecha(fechasOriginal);
        
        rowData.codoferta = zeroFill(valores[6] || '', 3);
        rowData.desc_det = valores[7] || '';
        rowData.ciudades = '0'; // Establecer "0" en ciudades como solicitado
        rowData.paquete = valores[9] || '';
        rowData.sol_com = valores[10] || '';
        rowData.descto = parseFloat(valores[11] || 0);
        rowData.tope_val = parseFloat(valores[12] || 0);
        rowData.flg_tip = valores[13] || '';
        rowData.val_basi = parseFloat(valores[14] || 0);
        rowData.codprod = String(valores[15] || '');
        rowData.descrip = valores[16] || '';
        rowData.desde_la = parseFloat(valores[17] || 0);
        rowData.desde_und = parseFloat(valores[18] || 0);
        rowData.hasta_und = parseFloat(valores[19] || 0);
        rowData.porcen = parseFloat(valores[20] || 0);
        rowData.dsct_mif = parseFloat(valores[21] || 0);
        rowData.dsct_prv = parseFloat(valores[22] || 0);
        rowData.ind_uni = valores[23] || '';
        rowData.cod_bon = valores[24] ? String(valores[24]) : null;
        rowData.can_bon = parseFloat(valores[25] || 0);
        rowData.descri = valores[26] || '';
        rowData.ind_uni1 = valores[27] || '';
        rowData.cod_bo1 = valores[28] ? String(valores[28]) : null;
        rowData.can_bo1 = parseFloat(valores[29] || 0);
        rowData.ind_uni2 = valores[30] || '';
        rowData.cod_bo2 = valores[31] ? String(valores[31]) : null;
        rowData.can_bo2 = parseFloat(valores[32] || 0);
        rowData.ind_uni3 = valores[33] || '';
        rowData.cod_bo3 = valores[34] ? String(valores[34]) : null;
        rowData.can_bo3 = parseFloat(valores[35] || 0);
        rowData.ind_uni4 = valores[36] || '';
        rowData.cod_bo4 = valores[37] ? String(valores[37]) : null;
        rowData.can_bo4 = parseFloat(valores[38] || 0);
        rowData.ind_uni5 = valores[39] || '';
        rowData.cod_bo5 = valores[40] ? String(valores[40]) : null;
        rowData.can_bo5 = parseFloat(valores[41] || 0);
        rowData.multiplo = parseFloat(valores[42] || 0);
        rowData.pasa = valores[43] || '';
        rowData.des_bo1 = parseFloat(valores[44] || 0);
        rowData.des_bo2 = parseFloat(valores[45] || 0);
        rowData.des_bo3 = parseFloat(valores[46] || 0);
        rowData.des_bo4 = parseFloat(valores[47] || 0);
        rowData.des_bo5 = parseFloat(valores[48] || 0);
        rowData.campana = valores[49] || '';
        
        rows.push(rowData);
        rowCount++;
      });
      
      // Almacenar la ruta del archivo en una variable de sesión o caché
      // para que podamos recuperarla cuando el usuario elija "Subir"
      const sessionId = Date.now().toString();
      global.fileCache = global.fileCache || {};
      global.fileCache[sessionId] = {
        filePath,
        fileName: req.file.originalname,
        timestamp: Date.now()
      };
      
      // Limpiar archivos de caché antiguos (más de 1 hora)
      const oneHourAgo = Date.now() - 3600000;
      Object.keys(global.fileCache).forEach(key => {
        if (global.fileCache[key].timestamp < oneHourAgo) {
          const oldFilePath = global.fileCache[key].filePath;
          if (fs.existsSync(oldFilePath)) {
            try {
              fs.unlinkSync(oldFilePath);
              console.log(`Archivo temporal eliminado: ${oldFilePath}`);
            } catch (err) {
              console.error(`Error eliminando archivo temporal: ${err.message}`);
            }
          }
          delete global.fileCache[key];
        }
      });
      
      console.log(`Previsualización completada. Mostrando ${rows.length} registros.`);
      
      return res.json({
        success: true,
        message: `Previsualización completada. Total de registros: ${rowCount}`,
        sessionId,
        data: rows,
        totalRows: worksheet.rowCount - 1 // Total real excluyendo encabezados
      });
      
    } catch (excelError) {
      console.error('Error al procesar archivo Excel para previsualización:', excelError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al procesar archivo Excel: ' + excelError.message 
      });
    }
  } catch (error) {
    console.error('Error general al previsualizar archivo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al previsualizar archivo: ' + error.message 
    });
  }
});

// Subir el archivo a la base de datos después de previsualización
router.post('/upload', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || !global.fileCache || !global.fileCache[sessionId]) {
      return res.status(400).json({ 
        success: false,
        error: 'No se encontró el archivo previamente importado o la sesión expiró. Por favor, vuelva a importar el archivo.' 
      });
    }
    
    const { filePath, fileName } = global.fileCache[sessionId];
    const fileExtension = path.extname(fileName).toLowerCase();
    
    if (!fs.existsSync(filePath)) {
      delete global.fileCache[sessionId];
      return res.status(400).json({ 
        success: false,
        error: 'El archivo temporal ya no existe. Por favor, vuelva a importar el archivo.' 
      });
    }
    
    console.log(`Iniciando carga a base de datos de: ${fileName}`);
    
    // Usar ExcelJS para procesar el archivo
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    if (fileExtension === '.xlsx') {
      await workbook.xlsx.readFile(filePath);
    } else if (fileExtension === '.xls') {
      await workbook.xls.readFile(filePath);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Formato de archivo no soportado. Use archivos .xlsx o .xls' 
      });
    }
    
    const worksheet = workbook.getWorksheet(1); // Primera hoja
    
    // Establecer una única conexión antes de iterar (mejor rendimiento)
    const pool = await require('../database').connectDB();
    
    // Preparar la consulta una sola vez (mejor rendimiento)
    const query = `
      INSERT INTO Medifarma (
        codprom, desc_cab, canal, fecdes, fechas, codoferta, desc_det,
        ciudades, paquete, sol_com, descto, tope_val, flg_tip, val_basi,
        codprod, descrip, desde_la, desde_und, hasta_und, porcen,
        dsct_mif, dsct_prv, ind_uni, cod_bon, can_bon, descri,
        ind_uni1, cod_bo1, can_bo1, ind_uni2, cod_bo2, can_bo2,
        ind_uni3, cod_bo3, can_bo3, ind_uni4, cod_bo4, can_bo4,
        ind_uni5, cod_bo5, can_bo5, multiplo, pasa,
        des_bo1, des_bo2, des_bo3, des_bo4, des_bo5, campana
      ) VALUES (
        @codprom, @desc_cab, @canal, @fecdes, @fechas, @codoferta, @desc_det,
        @ciudad, @paquete, @sol_com, @descto, @topeval, @flg_tip, @val_basi,
        @codprod, @descrip, @desde_la, @desde_und, @hasta_und, @porcen,
        @dsct_mif, @dsct_prv, @ind_uni, @cod_bon, @can_bon, @descri,
        @ind_uni1, @cod_bo1, @can_bo1, @ind_uni2, @cod_bo2, @can_bo2,
        @ind_uni3, @cod_bo3, @can_bo3, @ind_uni4, @cod_bo4, @can_bo4,
        @ind_uni5, @cod_bo5, @can_bo5, @multiplo, @pasa,
        @des_bo1, @des_bo2, @des_bo3, @des_bo4, @des_bo5, @campana
      )
    `;
    
    let processedCount = 0;
    let errorCount = 0;
    
    // Procesar fila por fila
    // Este enfoque es más eficiente que cargar todas las filas en memoria
    for (let i = 2; i <= worksheet.rowCount; i++) { // Empezar desde 2 para saltar encabezados
      const row = worksheet.getRow(i);
      const valores = row.values;
      
      // Si la fila está vacía, continuar con la siguiente
      if (!valores || valores.length <= 1) continue;
      
      try {
        // Aplicar transformaciones
        const codprom = valores[1] || '';
        const desc_cab = valores[2] || '';
        const canal = ''; // Vaciar columna canal
        
        // Formatear fechas
        const fecdesOriginal = valores[4];
        const fechasOriginal = valores[5];
        const fecdes = formatearFecha(fecdesOriginal);
        const fechas = formatearFecha(fechasOriginal);
        
        const codoferta = zeroFill(valores[6] || '', 3);
        const desc_det = valores[7] || '';
        const ciudad = '0'; // Establecer "0" en ciudades
        const paquete = valores[9] || '';
        const sol_com = valores[10] || '';
        const descto = parseFloat(valores[11] || 0);
        const topeval = parseFloat(valores[12] || 0);
        const flg_tip = valores[13] || '';
        const val_basi = parseFloat(valores[14] || 0);
        const codprod = String(valores[15] || '');
        const descrip = valores[16] || '';
        const desde_la = parseFloat(valores[17] || 0);
        const desde_und = parseFloat(valores[18] || 0);
        const hasta_und = parseFloat(valores[19] || 0);
        const porcen = parseFloat(valores[20] || 0);
        const dsct_mif = parseFloat(valores[21] || 0);
        const dsct_prv = parseFloat(valores[22] || 0);
        const ind_uni = valores[23] || '';
        const cod_bon = valores[24] ? String(valores[24]) : null;
        const can_bon = parseFloat(valores[25] || 0);
        const descri = valores[26] || '';
        const ind_uni1 = valores[27] || '';
        const cod_bo1 = valores[28] ? String(valores[28]) : null;
        const can_bo1 = parseFloat(valores[29] || 0);
        const ind_uni2 = valores[30] || '';
        const cod_bo2 = valores[31] ? String(valores[31]) : null;
        const can_bo2 = parseFloat(valores[32] || 0);
        const ind_uni3 = valores[33] || '';
        const cod_bo3 = valores[34] ? String(valores[34]) : null;
        const can_bo3 = parseFloat(valores[35] || 0);
        const ind_uni4 = valores[36] || '';
        const cod_bo4 = valores[37] ? String(valores[37]) : null;
        const can_bo4 = parseFloat(valores[38] || 0);
        const ind_uni5 = valores[39] || '';
        const cod_bo5 = valores[40] ? String(valores[40]) : null;
        const can_bo5 = parseFloat(valores[41] || 0);
        const multiplo = parseFloat(valores[42] || 0);
        const pasa = valores[43] || '';
        const des_bo1 = parseFloat(valores[44] || 0);
        const des_bo2 = parseFloat(valores[45] || 0);
        const des_bo3 = parseFloat(valores[46] || 0);
        const des_bo4 = parseFloat(valores[47] || 0);
        const des_bo5 = parseFloat(valores[48] || 0);
        const campana = valores[49] || '';
        
        // Usar el mismo request para cada ejecución
        const request = pool.request();
        
        // Agregar parámetros a la consulta
        request.input('codprom', codprom);
        request.input('desc_cab', desc_cab);
        request.input('canal', canal);
        request.input('fecdes', fecdes);
        request.input('fechas', fechas);
        request.input('codoferta', codoferta);
        request.input('desc_det', desc_det);
        request.input('ciudad', ciudad);
        request.input('paquete', paquete);
        request.input('sol_com', sol_com);
        request.input('descto', descto);
        request.input('topeval', topeval);
        request.input('flg_tip', flg_tip);
        request.input('val_basi', val_basi);
        request.input('codprod', codprod);
        request.input('descrip', descrip);
        request.input('desde_la', desde_la);
        request.input('desde_und', desde_und);
        request.input('hasta_und', hasta_und);
        request.input('porcen', porcen);
        request.input('dsct_mif', dsct_mif);
        request.input('dsct_prv', dsct_prv);
        request.input('ind_uni', ind_uni);
        request.input('cod_bon', cod_bon);
        request.input('can_bon', can_bon);
        request.input('descri', descri);
        request.input('ind_uni1', ind_uni1);
        request.input('cod_bo1', cod_bo1);
        request.input('can_bo1', can_bo1);
        request.input('ind_uni2', ind_uni2);
        request.input('cod_bo2', cod_bo2);
        request.input('can_bo2', can_bo2);
        request.input('ind_uni3', ind_uni3);
        request.input('cod_bo3', cod_bo3);
        request.input('can_bo3', can_bo3);
        request.input('ind_uni4', ind_uni4);
        request.input('cod_bo4', cod_bo4);
        request.input('can_bo4', can_bo4);
        request.input('ind_uni5', ind_uni5);
        request.input('cod_bo5', cod_bo5);
        request.input('can_bo5', can_bo5);
        request.input('multiplo', multiplo);
        request.input('pasa', pasa);
        request.input('des_bo1', des_bo1);
        request.input('des_bo2', des_bo2);
        request.input('des_bo3', des_bo3);
        request.input('des_bo4', des_bo4);
        request.input('des_bo5', des_bo5);
        request.input('campana', campana);
        
        // Ejecutar consulta
        await request.query(query);
        processedCount++;
        
        // Mostrar progreso cada 100 filas
        if (processedCount % 100 === 0) {
          console.log(`Procesados ${processedCount} registros`);
        }
      } catch (rowError) {
        console.error(`Error procesando fila ${i}:`, rowError);
        errorCount++;
        // Continuar con el siguiente registro a pesar del error
      }
    }
    
    console.log(`Inserción completada. Registros insertados: ${processedCount}, Errores: ${errorCount}`);
    
    try {
      // Ejecutar el procedimiento almacenado para completar el procesamiento
      console.log('Ejecutando procedimiento almacenado sp_Medifarma_importa2...');
      await executeQuery("EXEC sp_Medifarma_importa2");
      console.log('Procedimiento almacenado ejecutado con éxito');
    } catch (spError) {
      console.error('Error ejecutando procedimiento almacenado:', spError);
      return res.status(500).json({
        success: false,
        error: 'Error ejecutando procedimiento almacenado: ' + spError.message,
        insertedRows: processedCount,
        errorRows: errorCount
      });
    }
    
    // Elimina el archivo temporal y la entrada de caché
    try {
      fs.unlinkSync(filePath);
      console.log(`Archivo temporal eliminado: ${filePath}`);
      delete global.fileCache[sessionId];
    } catch (unlinkError) {
      console.error(`Error al eliminar archivo temporal: ${unlinkError.message}`);
    }
    
    return res.json({
      success: true,
      message: 'Subida completada',
      inserted: processedCount,
      errors: errorCount
    });
    
  } catch (error) {
    console.error('Error general en la carga a base de datos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error en la carga a base de datos: ' + error.message 
    });
  }
});

module.exports = router; 