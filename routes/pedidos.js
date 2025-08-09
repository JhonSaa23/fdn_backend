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

// Obtener detalle completo de un pedido (cabecera)
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

// Obtener detalle completo de productos de un pedido
router.get('/:numero/productos', async (req, res) => {
  try {
    const pool = await getConnection();
    const { numero } = req.params;
    
    // Limpiar el número del pedido (eliminar espacios al inicio y final)
    const numeroLimpio = numero.trim();
    
    console.log(`🔍 Obteniendo productos del pedido: "${numeroLimpio}"`);

    // Primero verificar que el pedido existe
    const verificarPedidoQuery = `
      SELECT Numero, Estado FROM DoccabPed WHERE Numero = @numero
    `;
    
    const verificarResult = await pool.request()
      .input('numero', numeroLimpio)
      .query(verificarPedidoQuery);

    if (verificarResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    // Obtener todos los productos del pedido (solo datos de DocdetPed)
    const productosQuery = `
      SELECT 
        dp.Numero,
        dp.CodPro,
        dp.Unimed,
        dp.Cantidad,
        dp.Precio,
        dp.Descuento1,
        dp.Descuento2,
        dp.Descuento3,
        dp.Adicional,
        dp.Unidades,
        dp.Subtotal,
        dp.Paquete,
        dp.Editado,
        dp.Autoriza,
        dp.Nbonif
      FROM DocdetPed dp
      WHERE dp.numero = @numero
      ORDER BY dp.CodPro
    `;

    const productosResult = await pool.request()
      .input('numero', numeroLimpio)
      .query(productosQuery);

    console.log(`✅ Productos obtenidos exitosamente para pedido: ${numeroLimpio}`);
    console.log(`📊 Total de productos encontrados: ${productosResult.recordset.length}`);

    // Agregar información adicional a cada producto
    const productos = productosResult.recordset.map(producto => {
      // Calcular descuento total (suma de los 3 descuentos)
      const descuentoTotal = (producto.Descuento1 || 0) + (producto.Descuento2 || 0) + (producto.Descuento3 || 0);
      
      // Debug: Log del valor de Autoriza para cada producto
      console.log(`🔍 Producto ${producto.CodPro}: Autoriza = ${producto.Autoriza} (tipo: ${typeof producto.Autoriza})`);
      
      const requiereAutorizacion = producto.Autoriza === 1 || producto.Autoriza === true;
      
      return {
        ...producto,
        // Agregar campos calculados
        SubtotalCalculado: producto.Cantidad * producto.Precio,
        TotalConDescuento: (producto.Cantidad * producto.Precio) * (1 - descuentoTotal / 100),
        DescuentoTotal: descuentoTotal,
        RequiereAutorizacion: requiereAutorizacion,
        EstadoAutorizacion: requiereAutorizacion ? 'Requiere Autorización' : 'No Requiere Autorización'
      };
    });

    // Obtener resumen del pedido
    const resumenQuery = `
      SELECT 
        COUNT(*) as TotalProductos,
        SUM(Cantidad) as TotalCantidad,
        SUM(Cantidad * Precio) as Subtotal,
        SUM(Cantidad * Precio * (1 - (ISNULL(Descuento1, 0) + ISNULL(Descuento2, 0) + ISNULL(Descuento3, 0)) / 100)) as SubtotalConDescuento,
        SUM(CASE WHEN Autoriza = 1 OR Autoriza = 1 THEN 1 ELSE 0 END) as ProductosRequierenAutorizacion,
        SUM(CASE WHEN Autoriza = 0 OR Autoriza = 0 THEN 1 ELSE 0 END) as ProductosNoRequierenAutorizacion
      FROM DocdetPed 
      WHERE numero = @numero
    `;

    const resumenResult = await pool.request()
      .input('numero', numeroLimpio)
      .query(resumenQuery);

    const resumen = resumenResult.recordset[0];

    res.json({
      success: true,
      data: {
        numero: numeroLimpio,
        productos: productos,
        resumen: {
          totalProductos: resumen.TotalProductos,
          totalCantidad: resumen.TotalCantidad,
          subtotal: resumen.Subtotal,
          subtotalConDescuento: resumen.SubtotalConDescuento,
          productosRequierenAutorizacion: resumen.ProductosRequierenAutorizacion,
          productosNoRequierenAutorizacion: resumen.ProductosNoRequierenAutorizacion,
          porcentajeRequiereAutorizacion: resumen.TotalProductos > 0 ? 
            Math.round((resumen.ProductosRequierenAutorizacion / resumen.TotalProductos) * 100) : 0
        },
        pedido: verificarResult.recordset[0]
      },
      message: `Detalle de productos obtenido exitosamente para pedido ${numeroLimpio}`
    });

  } catch (error) {
    console.error('Error al obtener productos del pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los productos del pedido',
      details: error.message
    });
  }
});

// Autorizar pedido (ejecutar procedimiento almacenado)
router.post('/autorizar/:numero', async (req, res) => {
  console.log(`🚀 INICIO - Autorizando pedido: ${req.params.numero}`);
  try {
    const pool = await getConnection();
    const { numero } = req.params;
    
    // Limpiar el número del pedido (eliminar espacios al inicio y final)
    const numeroLimpio = numero.trim();
    
    console.log(`🚀 INICIO - Autorizando pedido: "${numeroLimpio}"`);

    // Primero verificar que el pedido existe y está en estado 1 (Crédito)
    const verificarQuery = `
      SELECT Estado, Observacion FROM DoccabPed WHERE Numero = @numero
    `;
    
    const verificarResult = await pool.request()
      .input('numero', numeroLimpio)
      .query(verificarQuery);

    if (verificarResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    const pedido = verificarResult.recordset[0];
    const estadoActual = pedido.Estado;
    
    if (estadoActual !== 1) {
      return res.status(400).json({
        success: false,
        error: 'El pedido no está en estado de crédito (estado 1)',
        estadoActual: estadosPedidos[estadoActual] || 'Estado Desconocido'
      });
    }

    // Verificar el estado del campo "Autoriza" en el detalle del pedido
    console.log(`🔍 Verificando estado de autorización en detalle del pedido: ${numeroLimpio}`);
    const verificarAutorizacionQuery = `
      SELECT Autoriza FROM DocdetPed WHERE numero = @numero
    `;
    
    const autorizacionResult = await pool.request()
      .input('numero', numeroLimpio)
      .query(verificarAutorizacionQuery);

    if (autorizacionResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró detalle del pedido'
      });
    }

    // Determinar el estado final basado en el campo Autoriza
    const detalles = autorizacionResult.recordset;
    const tieneProductosParaAutorizar = detalles.some(detalle => detalle.Autoriza === 1);
    
    let estadoFinal;
    let mensajeEstado;
    
    if (tieneProductosParaAutorizar) {
      // Si algún producto tiene Autoriza = 1, pasar a estado 2 (Comercial)
      estadoFinal = 2;
      mensajeEstado = 'Comercial';
      console.log(`📋 Pedido ${numeroLimpio} tiene productos que requieren autorización. Pasando a estado Comercial (2)`);
    } else {
      // Si ningún producto tiene Autoriza = 1, pasar directamente a estado 3 (Por Facturar)
      estadoFinal = 3;
      mensajeEstado = 'Por Facturar';
      console.log(`📋 Pedido ${numeroLimpio} no tiene productos que requieran autorización. Pasando directamente a estado Por Facturar (3)`);
    }

    // Ejecutar el procedimiento almacenado para autorizar el crédito
    console.log(`🔄 Ejecutando autorización para pedido: ${numeroLimpio} hacia estado ${estadoFinal} (${mensajeEstado})`);
    const autorizarQuery = `
      EXEC sp_pedidoVenta_autorizaC
        @nume = @numero,
        @estado = 1,
        @nestado = @estadoFinal
    `;

    await pool.request()
      .input('numero', numeroLimpio)
      .input('estadoFinal', estadoFinal)
      .query(autorizarQuery);
    console.log(`✅ Autorización ejecutada exitosamente para pedido: ${numeroLimpio} hacia estado ${estadoFinal}`);

    // Agregar observación del pedido usando sp_pedidoVenta_autorizaC1
    if (pedido.Observacion && pedido.Observacion.trim() !== '') {
      console.log(`📝 Agregando observación para pedido: ${numeroLimpio}`);
      console.log(`📝 Observación: "${pedido.Observacion.trim()}"`);
      
      const observacionQuery = `
        EXEC sp_pedidoVenta_autorizaC1
          @nume = @numero,
          @observa = @observacion
      `;

      await pool.request()
        .input('numero', numeroLimpio)
        .input('observacion', pedido.Observacion.trim())
        .query(observacionQuery);
      console.log(`✅ Observación agregada exitosamente para pedido: ${numeroLimpio}`);
    } else {
      console.log(`ℹ️ No hay observación para agregar en pedido: ${numeroLimpio}`);
    }

    // Insertar registro en la tabla de auditoría
    console.log(`📊 Insertando registro en auditoría para pedido: ${numeroLimpio}`);
    const auditoriaQuery = `
      INSERT INTO t_accountig (Fecha, Operador, UsuarioSO, Maquina, Opcion, Accion, Formulario, Detalle)
      VALUES (GETDATE(), @operador, @usuarioSO, @maquina, @opcion, @accion, @formulario, @detalle)
    `;

    await pool.request()
      .input('operador', 'Administrador')
      .input('usuarioSO', 'X')
      .input('maquina', 'SERVER')
      .input('opcion', 'Ventas-Autoriza Creditos')
      .input('accion', 'Registrar autorización de crédito')
      .input('formulario', 'frmAutoCred')
      .input('detalle', numeroLimpio)
      .query(auditoriaQuery);
    console.log(`✅ Registro de auditoría insertado exitosamente para pedido: ${numeroLimpio}`);
    console.log(`📊 Datos de auditoría: Operador=Administrador, Opcion=Ventas-Autoriza Creditos, Accion=Registrar autorización de crédito, Formulario=frmAutoCred, Detalle=${numeroLimpio}`);

    console.log(`🎉 FINALIZADO - Autorización completada para pedido: ${numeroLimpio}`);
    res.json({
      success: true,
      message: `Pedido ${numeroLimpio} autorizado correctamente. Estado cambiado de Crédito a ${mensajeEstado}.`,
      estadoFinal: estadoFinal,
      estadoFinalDescripcion: mensajeEstado,
      tieneProductosParaAutorizar: tieneProductosParaAutorizar
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

// Eliminar pedido
router.delete('/:numero', async (req, res) => {
  try {
    const pool = await getConnection();
    const { numero } = req.params;
    
    // Limpiar el número del pedido (eliminar espacios al inicio y final)
    const numeroLimpio = numero.trim();

    // Primero verificar que el pedido existe
    const verificarQuery = `
      SELECT Estado, CodClie FROM DoccabPed WHERE Numero = @numero
    `;
    
    const verificarResult = await pool.request()
      .input('numero', numeroLimpio)
      .query(verificarQuery);

    if (verificarResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    const pedido = verificarResult.recordset[0];

    // Ejecutar el procedimiento almacenado para eliminar el pedido
    console.log(`🗑️ Ejecutando eliminación para pedido: ${numero}`);
    const eliminarQuery = `
      EXEC sp_PedidosVentas_elimina @nume = @numero
    `;

    await pool.request()
      .input('numero', numero)
      .query(eliminarQuery);
    console.log(`✅ Eliminación ejecutada exitosamente para pedido: ${numero}`);

    // Insertar registro en la tabla de auditoría
    console.log(`📊 Insertando registro en auditoría para eliminación de pedido: ${numero}`);
    const auditoriaQuery = `
      INSERT INTO t_accountig (Fecha, Operador, UsuarioSO, Maquina, Opcion, Accion, Formulario, Detalle)
      VALUES (GETDATE(), @operador, @usuarioSO, @maquina, @opcion, @accion, @formulario, @detalle)
    `;

    const detalle = `${numero}->Cliente:${pedido.CodClie}`;
    console.log(`📊 Detalle de eliminación: ${detalle}`);
    
    await pool.request()
      .input('operador', 'Administrador')
      .input('usuarioSO', 'X')
      .input('maquina', 'SERVER')
      .input('opcion', 'Ventas-Pedido de Ventas')
      .input('accion', 'Eliminar Pedido de ventas')
      .input('formulario', 'frmPedidosVentas')
      .input('detalle', detalle)
      .query(auditoriaQuery);
    console.log(`✅ Registro de auditoría de eliminación insertado exitosamente para pedido: ${numero}`);
    console.log(`📊 Datos de auditoría: Operador=Administrador, Opcion=Ventas-Pedido de Ventas, Accion=Eliminar Pedido de ventas, Formulario=frmPedidosVentas, Detalle=${detalle}`);

    res.json({
      success: true,
      message: `Pedido ${numero} eliminado correctamente`
    });

  } catch (error) {
    console.error('Error al eliminar pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar el pedido',
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