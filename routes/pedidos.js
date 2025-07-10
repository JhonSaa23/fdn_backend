const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');

// Estados de pedidos para convertir números a descripciones
const estadosPedidos = {
  1: 'Crédito',
  2: 'Comercial', 
  3: 'Por Facturar',
  4: 'Facturado',
  5: 'Por Despachar',
  6: 'Embalado',
  7: 'Reparto',
  8: 'Entregado',
  9: 'No Atendido por falta de stock'
};

// Obtener pedidos con filtros
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Obtener parámetros de filtro
    const { 
      numero, 
      dia, 
      mes, 
      anio, 
      estado, 
      eliminado = '0' 
    } = req.query;

    // Construir query dinámicamente
    let whereConditions = ['d.Eliminado = @eliminado'];
    
    if (numero) {
      whereConditions.push('d.Numero LIKE @numero');
    }
    
    if (dia && mes && anio) {
      whereConditions.push('DAY(d.Fecha) = @dia AND MONTH(d.Fecha) = @mes AND YEAR(d.Fecha) = @anio');
    } else if (mes && anio) {
      whereConditions.push('MONTH(d.Fecha) = @mes AND YEAR(d.Fecha) = @anio');
    } else if (anio) {
      whereConditions.push('YEAR(d.Fecha) = @anio');
    }
    
    if (estado) {
      whereConditions.push('d.Estado = @estado');
    }

    const whereClause = whereConditions.join(' AND ');
    
    const query = `
      SELECT 
        d.Numero,
        d.Estado,
        d.CodClie,
        c.Razon,
        d.Fecha,
        d.Tipo,
        d.Direccion,
        d.Subtotal,
        d.Igv,
        d.Total,
        d.Moneda,
        d.Cambio,
        d.Vendedor,
        d.Dias,
        d.Condicion,
        d.Eliminado,
        d.Impreso,
        d.FecCre,
        d.FecPre,
        d.FecFac,
        d.FecOrd,
        d.FecDes,
        d.FecAte,
        d.FecClie,
        d.Observacion,
        d.ConLetra,
        d.Urgente,
        d.Representante
      FROM DoccabPed d
      LEFT JOIN clientes c ON d.CodClie = c.Codclie
      WHERE ${whereClause}
      ORDER BY d.Fecha DESC
    `;

    const request = pool.request();
    
    // Agregar parámetros
    request.input('eliminado', eliminado);
    
    if (numero) {
      request.input('numero', `%${numero}%`);
    }
    if (dia) {
      request.input('dia', parseInt(dia));
    }
    if (mes) {
      request.input('mes', parseInt(mes));
    }
    if (anio) {
      request.input('anio', parseInt(anio));
    }
    if (estado) {
      request.input('estado', parseInt(estado));
    }

    const result = await request.query(query);
    
    // Transformar los datos agregando descripción del estado
    const pedidos = result.recordset.map(pedido => ({
      ...pedido,
      EstadoDescripcion: estadosPedidos[pedido.Estado] || 'Estado Desconocido',
      NombreCliente: pedido.Razon || 'Cliente no encontrado'
    }));

    res.json({
      success: true,
      data: pedidos
    });

  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los pedidos',
      details: error.message
    });
  }
});

// Obtener pedidos del mes actual con estado crédito por defecto
router.get('/default', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Obtener fecha actual
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1; // getMonth() devuelve 0-11
    const anioActual = fechaActual.getFullYear();

    const query = `
      SELECT 
        d.Numero,
        d.Estado,
        d.CodClie,
        c.Razon,
        d.Fecha,
        d.Tipo,
        d.Direccion,
        d.Subtotal,
        d.Igv,
        d.Total,
        d.Moneda,
        d.Cambio,
        d.Vendedor,
        d.Dias,
        d.Condicion,
        d.Eliminado,
        d.Impreso,
        d.FecCre,
        d.FecPre,
        d.FecFac,
        d.FecOrd,
        d.FecDes,
        d.FecAte,
        d.FecClie,
        d.Observacion,
        d.ConLetra,
        d.Urgente,
        d.Representante
      FROM DoccabPed d
      LEFT JOIN clientes c ON d.CodClie = c.Codclie
      WHERE MONTH(d.Fecha) = @mes 
        AND YEAR(d.Fecha) = @anio 
        AND d.Estado = 1 
        AND d.Eliminado = 0
      ORDER BY d.Fecha DESC
    `;

    const result = await pool.request()
      .input('mes', mesActual)
      .input('anio', anioActual)
      .query(query);

    // Transformar los datos agregando descripción del estado
    const pedidos = result.recordset.map(pedido => ({
      ...pedido,
      EstadoDescripcion: estadosPedidos[pedido.Estado] || 'Estado Desconocido',
      NombreCliente: pedido.Razon || 'Cliente no encontrado'
    }));

    res.json({
      success: true,
      data: pedidos,
      filtros: {
        mes: mesActual,
        anio: anioActual,
        estado: 1,
        eliminado: 0
      }
    });

  } catch (error) {
    console.error('Error al obtener pedidos por defecto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los pedidos por defecto',
      details: error.message
    });
  }
});

// Obtener detalle completo de un pedido
router.get('/:numero', async (req, res) => {
  try {
    const pool = await getConnection();
    const { numero } = req.params;

    const query = `
      SELECT 
        d.*,
        c.Razon,
        c.Direccion as DireccionCliente,
        c.Telefono1 as TelefonoCliente
      FROM DoccabPed d
      LEFT JOIN clientes c ON d.CodClie = c.Codclie
      WHERE d.Numero = @numero
    `;

    const result = await pool.request()
      .input('numero', numero)
      .query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    const pedido = result.recordset[0];
    
    // Agregar descripción del estado
    pedido.EstadoDescripcion = estadosPedidos[pedido.Estado] || 'Estado Desconocido';
    pedido.NombreCliente = pedido.Razon || 'Cliente no encontrado';

    res.json({
      success: true,
      data: pedido
    });

  } catch (error) {
    console.error('Error al obtener detalle del pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el detalle del pedido',
      details: error.message
    });
  }
});

// Autorizar pedido (ejecutar procedimiento almacenado)
router.post('/autorizar/:numero', async (req, res) => {
  try {
    const pool = await getConnection();
    const { numero } = req.params;

    // Primero verificar que el pedido existe y está en estado 1 (Crédito)
    const verificarQuery = `
      SELECT Estado FROM DoccabPed WHERE Numero = @numero
    `;
    
    const verificarResult = await pool.request()
      .input('numero', numero)
      .query(verificarQuery);

    if (verificarResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    const estadoActual = verificarResult.recordset[0].Estado;
    
    if (estadoActual !== 1) {
      return res.status(400).json({
        success: false,
        error: 'El pedido no está en estado de crédito (estado 1)',
        estadoActual: estadosPedidos[estadoActual] || 'Estado Desconocido'
      });
    }

    // Ejecutar el procedimiento almacenado
    const query = `
      EXEC sp_pedidoVenta_autorizaC
        @nume = @numero,
        @estado = 1,
        @nestado = 2
    `;

    await pool.request()
      .input('numero', numero)
      .query(query);

    res.json({
      success: true,
      message: `Pedido ${numero} autorizado correctamente. Estado cambiado de Crédito a Comercial.`
    });

  } catch (error) {
    console.error('Error al autorizar pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al autorizar el pedido',
      details: error.message
    });
  }
});

// Obtener lista de estados disponibles
router.get('/utils/estados', (req, res) => {
  try {
    const estados = Object.entries(estadosPedidos).map(([codigo, descripcion]) => ({
      codigo: parseInt(codigo),
      descripcion
    }));

    res.json({
      success: true,
      data: estados
    });
  } catch (error) {
    console.error('Error al obtener estados:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los estados'
    });
  }
});

module.exports = router; 