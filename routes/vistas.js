const express = require('express');
const { getConnection } = require('../database');
const sql = require('mssql');

const router = express.Router();

// =====================================================
// ENDPOINTS DE GESTIÓN DE VISTAS
// =====================================================

// Obtener todas las vistas del sistema
router.get('/vistas', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const result = await pool.request().execute('sp_ObtenerVistasSistema');

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error obteniendo vistas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo vistas del sistema'
    });
  }
});

// Obtener vistas permitidas para un usuario específico
router.get('/vistas/usuario/:idus', async (req, res) => {
  try {
    const { idus } = req.params;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('IDUS', sql.Int, idus)
      .execute('sp_ObtenerVistasUsuario');

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error obteniendo vistas del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo vistas del usuario'
    });
  }
});

// Obtener vistas disponibles para asignar a un usuario
router.get('/vistas/disponibles/:idus', async (req, res) => {
  try {
    const { idus } = req.params;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('IDUS', sql.Int, idus)
      .execute('sp_ObtenerVistasDisponibles');

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error obteniendo vistas disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo vistas disponibles'
    });
  }
});

// Asignar vista a usuario
router.post('/vistas/asignar', async (req, res) => {
  try {
    const { idus, idvista, asignadoPor } = req.body;
    
    if (!idus || !idvista) {
      return res.status(400).json({
        success: false,
        message: 'IDUS e IDVista son requeridos'
      });
    }

    const pool = await getConnection();
    
    const result = await pool.request()
      .input('IDUS', sql.Int, idus)
      .input('IDVista', sql.Int, idvista)
      .input('AsignadoPor', sql.VarChar, asignadoPor || null)
      .execute('sp_AsignarVistaUsuario');

    res.json({
      success: true,
      message: 'Vista asignada exitosamente'
    });
  } catch (error) {
    console.error('Error asignando vista:', error);
    res.status(500).json({
      success: false,
      message: 'Error asignando vista al usuario'
    });
  }
});

// Remover vista de usuario
router.delete('/vistas/remover', async (req, res) => {
  try {
    const { idus, idvista } = req.body;
    
    if (!idus || !idvista) {
      return res.status(400).json({
        success: false,
        message: 'IDUS e IDVista son requeridos'
      });
    }

    const pool = await getConnection();
    
    await pool.request()
      .input('IDUS', sql.Int, idus)
      .input('IDVista', sql.Int, idvista)
      .execute('sp_RemoverVistaUsuario');

    res.json({
      success: true,
      message: 'Vista removida exitosamente'
    });
  } catch (error) {
    console.error('Error removiendo vista:', error);
    res.status(500).json({
      success: false,
      message: 'Error removiendo vista del usuario'
    });
  }
});

// Actualizar permisos de usuario (múltiples vistas)
router.put('/vistas/usuario/:idus', async (req, res) => {
  try {
    const { idus } = req.params;
    const { vistas } = req.body; // Array de IDs de vistas
    
    if (!vistas || !Array.isArray(vistas)) {
      return res.status(400).json({
        success: false,
        message: 'Array de vistas es requerido'
      });
    }

    const pool = await getConnection();
    
    // Iniciar transacción
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Eliminar todas las vistas actuales del usuario
      await transaction.request()
        .input('IDUS', sql.Int, idus)
        .query('DELETE FROM UsuarioVistas WHERE IDUS = @IDUS');

      // Insertar las nuevas vistas
      for (const idvista of vistas) {
        await transaction.request()
          .input('IDUS', sql.Int, idus)
          .input('IDVista', sql.Int, idvista)
          .input('AsignadoPor', sql.VarChar, 'Sistema')
          .query(`
            INSERT INTO UsuarioVistas (IDUS, IDVista, AsignadoPor)
            VALUES (@IDUS, @IDVista, @AsignadoPor)
          `);
      }

      // Confirmar transacción
      await transaction.commit();

      res.json({
        success: true,
        message: 'Permisos de vistas actualizados exitosamente'
      });
    } catch (error) {
      // Revertir transacción en caso de error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error actualizando permisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando permisos de vistas'
    });
  }
});

module.exports = router;
