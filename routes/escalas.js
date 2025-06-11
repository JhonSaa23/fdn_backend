const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database');

// Obtener laboratorios únicos para el filtro
router.get('/laboratorios', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT l.CodLab, l.Descripcion
      FROM dbo.Laboratorios AS l
      INNER JOIN dbo.Escalas AS e ON RTRIM(l.CodLab) = LEFT(e.CodPro, 2)
      ORDER BY l.Descripcion
    `;
    const result = await executeQuery(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener laboratorios:', error);
    res.status(500).json({ error: 'Error al obtener laboratorios' });
  }
});

// Consultar escalas con filtros
router.get('/', async (req, res) => {
  try {
    const { laboratorio, codpro, nombreProducto } = req.query;
    
    let whereConditions = [];
    let parameters = {};
    
    // Limpiar y validar parámetros
    if (laboratorio && laboratorio.trim() !== '') {
      whereConditions.push('l.CodLab = @laboratorio');
      parameters.laboratorio = laboratorio.trim();
    }
    
    if (codpro && codpro.trim() !== '') {
      whereConditions.push('e.CodPro LIKE @codpro');
      parameters.codpro = `%${codpro.trim()}%`;
    }
    
    if (nombreProducto && nombreProducto.trim() !== '') {
      whereConditions.push('p.Nombre LIKE @nombreProducto');
      parameters.nombreProducto = `%${nombreProducto.trim()}%`;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const query = `
      SELECT l.Descripcion AS Laboratorio, e.CodPro, p.Nombre, e.Rango1, 
             CASE WHEN e.Des11 > 0 THEN e.Des11 ELSE 0 END AS Des11, 
             CASE WHEN e.des12 > 0 THEN e.des12 ELSE 0 END AS des12, 
             CASE WHEN e.des13 > 0 THEN e.des13 ELSE 0 END AS des13, 
             e.Rango2, 
             CASE WHEN e.des21 > 0 THEN e.des21 ELSE 0 END AS des21, 
             CASE WHEN e.des22 > 0 THEN e.des22 ELSE 0 END AS des22, 
             CASE WHEN e.des23 > 0 THEN e.des23 ELSE 0 END AS des23, 
             e.Rango3, 
             CASE WHEN e.des31 > 0 THEN e.des31 ELSE 0 END AS des31, 
             CASE WHEN e.des32 > 0 THEN e.des32 ELSE 0 END AS des32, 
             CASE WHEN e.des33 > 0 THEN e.des33 ELSE 0 END AS des33, 
             e.Rango4, 
             CASE WHEN e.des41 > 0 THEN e.des41 ELSE 0 END AS des41, 
             CASE WHEN e.des42 > 0 THEN e.des42 ELSE 0 END AS des42, 
             CASE WHEN e.des43 > 0 THEN e.des43 ELSE 0 END AS des43, 
             e.Rango5, 
             CASE WHEN e.des51 > 0 THEN e.des51 ELSE 0 END AS des51, 
             CASE WHEN e.des52 > 0 THEN e.des52 ELSE 0 END AS des52, 
             CASE WHEN e.des53 > 0 THEN e.des53 ELSE 0 END AS des53
      FROM dbo.Escalas AS e 
      INNER JOIN dbo.Productos AS p ON p.CodPro = e.CodPro 
      INNER JOIN dbo.Laboratorios AS l ON RTRIM(l.CodLab) = LEFT(e.CodPro, 2)
      ${whereClause}
      ORDER BY l.Descripcion, p.Nombre
    `;
    
    // Usar executeQuery con parámetros
    const result = await executeQuery(query, parameters);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al consultar escalas:', error);
    res.status(500).json({ error: 'Error al consultar escalas' });
  }
});

// Actualizar escala
router.put('/:codpro', async (req, res) => {
    try {
      const { codpro } = req.params;
      const {
        rango1, des11, des12, des13,
        rango2, des21, des22, des23,
        rango3, des31, des32, des33,
        rango4, des41, des42, des43,
        rango5, des51, des52, des53
      } = req.body;
  
      const query = `
        UPDATE dbo.Escalas 
        SET Rango1 = @rango1, Des11 = @des11, des12 = @des12, des13 = @des13,
            Rango2 = @rango2, des21 = @des21, des22 = @des22, des23 = @des23,
            Rango3 = @rango3, des31 = @des31, des32 = @des32, des33 = @des33,
            Rango4 = @rango4, des41 = @des41, des42 = @des42, des43 = @des43,
            Rango5 = @rango5, des51 = @des51, des52 = @des52, des53 = @des53
        WHERE CodPro = @codpro
      `;
  
      // Modificación aquí: Aplicar la lógica para transformar 0 a -9.00
      const parameters = {
        codpro: codpro,
        rango1: rango1 || 0,
        
        // Lógica para descuentos: Si el valor es 0, guarda -9.00. De lo contrario, guarda el valor o 0 si es nulo.
        des11: des11 === 0 ? -9.00 : (des11 || 0),
        des12: des12 === 0 ? -9.00 : (des12 || 0),
        des13: des13 === 0 ? -9.00 : (des13 || 0),
  
        rango2: rango2 || 0,
        des21: des21 === 0 ? -9.00 : (des21 || 0),
        des22: des22 === 0 ? -9.00 : (des22 || 0),
        des23: des23 === 0 ? -9.00 : (des23 || 0),
  
        rango3: rango3 || 0,
        des31: des31 === 0 ? -9.00 : (des31 || 0),
        des32: des32 === 0 ? -9.00 : (des32 || 0),
        des33: des33 === 0 ? -9.00 : (des33 || 0),
  
        rango4: rango4 || 0,
        des41: des41 === 0 ? -9.00 : (des41 || 0),
        des42: des42 === 0 ? -9.00 : (des42 || 0),
        des43: des43 === 0 ? -9.00 : (des43 || 0),
  
        rango5: rango5 || 0,
        des51: des51 === 0 ? -9.00 : (des51 || 0),
        des52: des52 === 0 ? -9.00 : (des52 || 0),
        des53: des53 === 0 ? -9.00 : (des53 || 0)
      };
      
      const result = await executeQuery(query, parameters);
      
      if (result.rowsAffected[0] > 0) {
        res.json({ success: true, message: 'Escala actualizada correctamente' });
      } else {
        res.status(404).json({ error: 'No se encontró la escala para actualizar' });
      }
    } catch (error) {
      console.error('Error al actualizar escala:', error);
      res.status(500).json({ error: 'Error al actualizar escala' });
    }
  });
// Eliminar escala
router.delete('/:codpro', async (req, res) => {
  try {
    const { codpro } = req.params;
    
    const query = 'DELETE FROM dbo.Escalas WHERE CodPro = @codpro';
    
    const request = executeQuery(query);
    request.input('codpro', codpro);
    
    const result = await request;
    
    if (result.rowsAffected[0] > 0) {
      res.json({ success: true, message: 'Escala eliminada correctamente' });
    } else {
      res.status(404).json({ error: 'No se encontró la escala para eliminar' });
    }
  } catch (error) {
    console.error('Error al eliminar escala:', error);
    res.status(500).json({ error: 'Error al eliminar escala' });
  }
});

module.exports = router; 