const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');
const ExcelJS = require('exceljs');

// Obtener datos de Ac Farma
router.get('/ac-farma', async (req, res) => {
  try {
    const query = 'SELECT * FROM v_Jhon_VenMin_ConDescuentos';
    const result = await executeQuery(query);
    
    res.json(result.recordset || []);
  } catch (error) {
    console.error('Error al obtener datos de Ac Farma:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Descargar Excel de Ac Farma
router.get('/ac-farma/excel', async (req, res) => {
  try {
    const query = 'SELECT * FROM v_Jhon_VenMin_ConDescuentos';
    const result = await executeQuery(query);
    const datos = result.recordset || [];

    // Crear workbook de Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ac Farma');

    if (datos.length > 0) {
      // Obtener las columnas de la primera fila
      const columnas = Object.keys(datos[0]);
      
      // Agregar encabezados
      worksheet.addRow(columnas);
      
      // Estilo para encabezados
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };

      // Agregar datos
      datos.forEach(fila => {
        const valores = columnas.map(columna => fila[columna]);
        worksheet.addRow(valores);
      });

      // Autoajustar ancho de columnas
      columnas.forEach((columna, index) => {
        worksheet.getColumn(index + 1).width = 15;
      });
    }

    // Configurar respuesta
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ac-farma-${new Date().toISOString().split('T')[0]}.xlsx"`);

    // Enviar archivo
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error al generar Excel de Ac Farma:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
