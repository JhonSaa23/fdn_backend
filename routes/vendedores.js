const express = require('express');
const router = express.Router();
const { executeQuery, sql } = require('../database');

// ===== GET: obtener todos los vendedores =====
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT 
        e.Codemp as CodVend,
        e.Nombre
      FROM Empleados e
      INNER JOIN clientes c ON e.Codemp = c.Vendedor
      WHERE c.Activo = 1
        AND e.Codemp IS NOT NULL
        AND e.Nombre IS NOT NULL
      ORDER BY e.Codemp
    `;

    const result = await executeQuery(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener vendedores:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// ===== GET: obtener clientes por vendedor =====
router.get('/clientes-por-vendedor/:codVendedor', async (req, res) => {
  try {
    const { codVendedor } = req.params;

    if (!codVendedor) {
      return res.status(400).json({ 
        error: 'Código de vendedor requerido' 
      });
    }

    const query = `
      SELECT 
        Codclie,
        tipoDoc,
        Documento,
        Razon,
        Direccion,
        Telefono1,
        Telefono2,
        Fax,
        Celular,
        Nextel,
        Maymin,
        Fecha,
        Zona,
        TipoNeg,
        TipoClie,
        Vendedor,
        Email,
        Limite,
        Activo
      FROM clientes
      WHERE Vendedor = @codVendedor
        AND Activo = 1
      ORDER BY Razon
    `;

    const result = await executeQuery(query, { codVendedor });
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener clientes por vendedor:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// ===== POST: cambiar vendedor masivo =====
router.post('/cambiar-vendedor-masivo', async (req, res) => {
  try {
    const { clientes, nuevoVendedor } = req.body;

    if (!clientes || !Array.isArray(clientes) || clientes.length === 0) {
      return res.status(400).json({ 
        error: 'Lista de clientes requerida' 
      });
    }

    if (!nuevoVendedor) {
      return res.status(400).json({ 
        error: 'Nuevo vendedor requerido' 
      });
    }

    // Convertir códigos de cliente a números
    const clientesNumericos = clientes.map(cliente => parseInt(cliente));
    const nuevoVendedorNumerico = parseInt(nuevoVendedor);

    // Verificar que el nuevo vendedor existe
    const vendedorQuery = `
      SELECT Codemp, Nombre 
      FROM Empleados 
      WHERE Codemp = ${nuevoVendedorNumerico}
    `;
    
    const vendedorResult = await executeQuery(vendedorQuery);
    
    if (vendedorResult.recordset.length === 0) {
      return res.status(400).json({ 
        error: 'El vendedor especificado no existe' 
      });
    }

    // Actualizar los clientes uno por uno para evitar problemas con múltiples valores
    let actualizados = 0;
    
    for (const codclie of clientesNumericos) {
      const updateQuery = `
        UPDATE clientes 
        SET Vendedor = ${nuevoVendedorNumerico}
        WHERE Activo = 1
          AND Codclie = ${codclie}
      `;

      const result = await executeQuery(updateQuery);
      actualizados += result.rowsAffected[0];
    }
    
    res.json({
      success: true,
      actualizados: actualizados,
      mensaje: `Se actualizaron ${actualizados} clientes exitosamente`
    });

  } catch (error) {
    console.error('Error al cambiar vendedor masivo:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

module.exports = router;
