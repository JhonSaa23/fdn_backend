const express = require('express');
const router = express.Router();
const path = require('path');
const readXlsxFile = require('read-excel-file/node');
const { executeQuery } = require('../database');
const { upload } = require('../utils/fileHandler');

// Función para rellenar con ceros a la izquierda
function zeroFill(value, length = 0) {
  return String(value).padStart(length, '0');
}

// Obtener todos los registros de Medifarma
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Medifarma');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener registros de Medifarma:', error);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
});

// Importar archivo Excel de Medifarma
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    }

    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    
    // Leer archivo Excel
    const rows = await readXlsxFile(filePath);
    
    // Saltar la primera fila (encabezados)
    const dataRows = rows.slice(1);
    
    let processedCount = 0;
    
    // Procesar cada fila
    for (const row of dataRows) {
      const codprom = row[0];
      const desc_cab = row[1];
      const canal = row[2];
      const fecdes = row[3];
      const fechas = row[4];
      const codoferta = zeroFill(row[5], 3);
      const desc_det = row[6];
      const ciudad = row[7];
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
    }
    
    res.json({ 
      success: true, 
      message: `Archivo importado correctamente. Se procesaron ${processedCount} registros.`
    });
    
  } catch (error) {
    console.error('Error al importar archivo:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al importar archivo: ' + error.message 
    });
  }
});

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

module.exports = router; 