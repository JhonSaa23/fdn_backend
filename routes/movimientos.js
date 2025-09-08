const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('../database');
const dbService = require('../services/dbService');

// Función para generar el siguiente número en la secuencia
function generarSiguienteNumero(numeroActual) {
  try {
    // Limpiar el número actual (remover espacios y caracteres no deseados)
    const numeroLimpio = numeroActual.toString().trim();
    console.log('🧹 Número limpio:', numeroLimpio);
    
    // Buscar el patrón: prefijo-número (ej: 100-2697683)
    const match = numeroLimpio.match(/^(.+)-(\d+)$/);
    
    if (match) {
      const prefijo = match[1]; // "100"
      const numero = parseInt(match[2]); // 2697683
      
      console.log('📊 Prefijo:', prefijo, 'Número:', numero);
      
      // Generar el siguiente número
      const siguienteNumero = numero + 1;
      const siguienteNumeroFormateado = `${prefijo}-${siguienteNumero.toString().padStart(7, '0')}`;
      
      console.log('➡️ Siguiente número formateado:', siguienteNumeroFormateado);
      return siguienteNumeroFormateado;
    } else {
      // Si no coincide el patrón, intentar solo incrementar el número
      const numero = parseInt(numeroLimpio.replace(/\D/g, ''));
      if (!isNaN(numero)) {
        const siguienteNumero = numero + 1;
        return siguienteNumero.toString().padStart(7, '0');
      }
    }
    
    // Si no se puede procesar, devolver un número por defecto
    console.log('⚠️ No se pudo procesar el número, usando por defecto');
    return '100-0000001';
    
  } catch (error) {
    console.error('❌ Error al generar siguiente número:', error);
    return '100-0000001';
  }
}

// Generar nuevo número de movimiento
router.post('/generar-numero', async (req, res) => {
  try {
    console.log('🚀 Iniciando generación de número de movimiento...');
    const pool = await getConnection();
    
    // Ejecutar sp_Tablas_buscaxcuenta 352,1 para obtener el siguiente número
    console.log('📞 Ejecutando sp_Tablas_buscaxcuenta con parámetros: c1=352, c2=1');
    const result = await pool.request()
      .input('c1', 352)
      .input('c2', 1)
      .execute('sp_Tablas_buscaxcuenta');
    
    console.log('✅ Resultado del stored procedure:');
    console.log('- Recordset length:', result.recordset.length);
    console.log('- Recordset:', result.recordset);
    console.log('- ReturnValue:', result.returnValue);
    console.log('- Output:', result.output);
    
    if (result.recordset.length > 0) {
      const record = result.recordset[0];
      console.log('📋 Registro completo:', record);
      
      // Extraer el número actual del campo c_describe
      const numeroActual = record.c_describe || record.c_describe;
      console.log('🔢 Número actual extraído:', numeroActual);
      
      if (numeroActual) {
        // Generar el siguiente número en la secuencia
        const siguienteNumero = generarSiguienteNumero(numeroActual);
        console.log('🎯 Siguiente número generado:', siguienteNumero);
        
    res.json({
      success: true,
          numero: siguienteNumero,
          numeroActual: numeroActual,
          message: 'Número de movimiento generado correctamente'
        });
      } else {
        console.log('⚠️ No se pudo extraer número del campo c_describe');
        res.json({
          success: false,
          message: 'No se pudo extraer número del campo c_describe',
          debug: {
            recordset: result.recordset,
            record: record
          }
        });
      }
    } else {
      console.log('⚠️ El stored procedure no devolvió ningún registro');
      res.json({
        success: false,
        message: 'El stored procedure no devolvió ningún número de movimiento',
        debug: {
          recordset: result.recordset,
          returnValue: result.returnValue,
          output: result.output
        }
      });
    }
  } catch (error) {
    console.error('❌ Error al generar número de movimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar número de movimiento',
      error: error.message,
      stack: error.stack
    });
  }
});

// Obtener opciones de salida
router.get('/opciones-salida', async (req, res) => {
  try {
    console.log('🚀 Obteniendo opciones de salida...');
    const pool = await getConnection();
    
    // Ejecutar sp_tablas_Listar 9
    console.log('📞 Ejecutando sp_tablas_Listar con parámetro: codigo=9');
    const result = await pool.request()
      .input('codigo', 9)
      .execute('sp_tablas_Listar');
    
    console.log('✅ Resultado del stored procedure:');
    console.log('- Recordset length:', result.recordset.length);
    console.log('- Recordset:', result.recordset);
    
    const opciones = result.recordset.map(item => ({
      n_numero: item.n_numero,
      c_describe: item.c_describe,
      conversion: item.conversion
    }));
    
    console.log('📋 Opciones procesadas:', opciones);
    
    res.json({
      success: true,
      data: opciones,
      message: 'Opciones de salida obtenidas correctamente'
    });
  } catch (error) {
    console.error('❌ Error al obtener opciones de salida:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener opciones de salida',
      error: error.message
    });
  }
});

// Obtener opciones por tipo (entrada=8, salida=9)
router.get('/opciones-tipo/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const codigoNum = parseInt(codigo);
    const tipo = codigoNum === 8 ? 'entrada' : 'salida';
    
    console.log(`🚀 Obteniendo opciones de ${tipo} con código ${codigo}...`);
    const pool = await getConnection();
    
    // Ejecutar sp_tablas_Listar con el código correspondiente
    console.log(`📞 Ejecutando sp_tablas_Listar con código ${codigo}`);
    const result = await pool.request()
      .input('codigo', codigoNum)
      .execute('sp_tablas_Listar');
    
    console.log(`✅ Resultado de sp_tablas_Listar para ${tipo}:`);
    console.log('- Recordset length:', result.recordset.length);
    console.log('- Recordset:', result.recordset);
    
    const opciones = result.recordset.map(item => ({
      n_numero: item.n_numero,
      c_describe: item.c_describe,
      conversion: item.conversion
    }));
    
    console.log(`📋 Opciones de ${tipo} mapeadas:`, opciones);
    
    res.json({
      success: true,
      data: opciones,
      message: `Opciones de ${tipo} obtenidas correctamente`
    });
  } catch (error) {
    console.error(`❌ Error al obtener opciones de tipo ${codigo}:`, error);
    res.status(500).json({
        success: false,
      message: `Error al obtener opciones de tipo ${codigo}`,
      error: error.message
    });
  }
});

// Buscar producto por código
router.get('/buscar-producto/:codpro', async (req, res) => {
  try {
    const { codpro } = req.params;
    console.log('🚀 Buscando producto con código:', codpro);
    const pool = await getConnection();
    
    // Ejecutar sp_Productos_buscaxcuenta
    console.log('📞 Ejecutando sp_Productos_buscaxcuenta con código:', codpro);
    const result = await pool.request()
      .input('producto', codpro)
      .execute('sp_Productos_buscaxcuenta');
    
    console.log('✅ Resultado de sp_Productos_buscaxcuenta:');
    console.log('- Recordset length:', result.recordset.length);
    console.log('- Recordset:', result.recordset);
    
    if (result.recordset.length > 0) {
      const producto = result.recordset[0];
      console.log('📋 Producto encontrado:', producto);
      
      // Ejecutar sp_productos_buscaSaldos1 para obtener saldos
      console.log('📞 Ejecutando sp_productos_buscaSaldos1 con código:', codpro);
      const saldosResult = await pool.request()
        .input('cod', codpro)
        .execute('sp_productos_buscaSaldos1');
      
      console.log('✅ Resultado de sp_productos_buscaSaldos1:');
      console.log('- Recordset length:', saldosResult.recordset.length);
      console.log('- Recordset:', saldosResult.recordset);
      
      // Log detallado de cada item para debugging
      saldosResult.recordset.forEach((item, index) => {
        console.log(`📋 Item ${index}:`, {
          almacen: item.almacen,
          nombre: item.nombre,
          saldo: item.saldo,
          lote: item.lote,
          Vencimiento: item.Vencimiento
        });
      });
      
      const saldos = saldosResult.recordset.map(item => ({
        codpro: codpro, // Usar el código del producto que se está buscando
        nombre: producto.nombre, // Usar el nombre del producto encontrado
        lote: item.lote, // El lote está en el campo 'lote'
        almacen: item.nombre, // El nombre del almacén está en el campo 'nombre'
        almacenNumero: item.almacen, // El número del almacén está en el campo 'almacen'
        stock: item.saldo, // El saldo está en el campo 'saldo'
        pCosto: producto.Costo, // Usar el costo del producto encontrado
        precioReal: producto.PventaMa, // Usar el precio del producto encontrado
        fechaVencimiento: item.Vencimiento || item.vencimiento
      }));
      
      res.json({
        success: true,
        data: {
          codpro: producto.CodPro || producto.codpro,
          nombre: producto.Nombre || producto.nombre,
          descripcion: producto.Descripcion || producto.descripcion,
          costo: producto.Costo || producto.costo,
          pventaMa: producto.PventaMa || producto.pventaMa
        },
        saldos: saldos,
        message: 'Producto encontrado correctamente'
      });
    } else {
      console.log('⚠️ Producto no encontrado');
      res.json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
  } catch (error) {
    console.error('❌ Error al buscar producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar producto',
      error: error.message,
      stack: error.stack
    });
  }
});

// Obtener saldos de un producto
router.get('/saldos-producto/:codpro', async (req, res) => {
  try {
    const { codpro } = req.params;
    const pool = await getConnection();
    
    // Ejecutar sp_productos_buscaSaldos1
    const result = await pool.request()
      .input('cod', codpro)
      .execute('sp_productos_buscaSaldos1');
    
    const saldos = result.recordset.map(item => ({
      codpro: codpro, // Usar el código del producto que se está buscando
      nombre: '', // Este endpoint no tiene acceso al nombre del producto
      lote: item.lote, // El lote está en el campo 'lote'
      almacen: item.nombre, // El nombre del almacén está en el campo 'nombre'
      almacenNumero: item.almacen, // El número del almacén está en el campo 'almacen'
      stock: item.saldo, // El saldo está en el campo 'saldo'
      pCosto: 0, // Este endpoint no tiene acceso al costo
      precioReal: 0, // Este endpoint no tiene acceso al precio
      fechaVencimiento: item.Vencimiento || item.vencimiento
    }));
    
    res.json({
      success: true,
      data: saldos
    });
  } catch (error) {
    console.error('Error al obtener saldos del producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener saldos del producto',
      error: error.message
    });
  }
});

// Verificar bloqueo de producto
router.get('/verificar-bloqueo/:codpro/:almacen', async (req, res) => {
  try {
    const { codpro, almacen } = req.params;
    const pool = await getConnection();
    
    // Ejecutar sp_bloqueo_cuenta
    const result = await pool.request()
      .input('codpro', codpro)
      .input('alma', parseInt(almacen))
      .execute('sp_bloqueo_cuenta');
    
    // Si el resultado es 0, no está bloqueado. Si es 1, está bloqueado
    const bloqueado = result.recordset.length > 0 && 
      result.recordset[0].cuenta === 1;
    
    res.json({
      success: true,
      bloqueado: bloqueado
    });
  } catch (error) {
    console.error('Error al verificar bloqueo:', error);
    res.status(500).json({
        success: false,
      message: 'Error al verificar bloqueo del producto',
      error: error.message
    });
  }
});

// Obtener saldos específicos por almacén y lote
router.get('/saldos-almacen-lote/:codpro/:almacen/:lote', async (req, res) => {
  try {
    const { codpro, almacen, lote } = req.params;
    const pool = await getConnection();
    
    // Ejecutar sp_productos_SaldosAlmaLote
    const result = await pool.request()
      .input('codpro', codpro)
      .input('almacen', parseInt(almacen))
      .input('lote', lote)
      .execute('sp_productos_SaldosAlmaLote');
    
    const saldos = result.recordset.map(item => ({
      codpro: item.CodPro || item.codpro,
      nombre: item.Nombre || item.nombre,
      lote: item.Lote || item.lote,
      almacen: item.Almacen || item.almacen,
      stock: item.Stock || item.stock || item.Cantidad || item.cantidad,
      pCosto: item.PCosto || item.pCosto || item.Costo || item.costo,
      precioReal: item.PrecioReal || item.precioReal || item.Precio || item.precio,
      fechaVencimiento: item.FechaVencimiento || item.fechaVencimiento || item.Vencimiento || item.vencimiento
    }));
    
    res.json({
        success: true,
      data: saldos
    });
  } catch (error) {
    console.error('Error al obtener saldos por almacén y lote:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener saldos por almacén y lote',
      error: error.message
    });
  }
});


// Verificar bloqueo de producto (solo código)
router.get('/verificar-bloqueo-producto/:codpro', async (req, res) => {
  try {
    const { codpro } = req.params;
    console.log('🚀 Verificando bloqueo de producto:', codpro);
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('codpro', codpro)
      .input('alma', 1) // Usar almacén 1 por defecto
      .execute('sp_bloqueo_cuenta');
    
    console.log('✅ Resultado de verificación de bloqueo de producto:', result.recordset);
    
    const bloqueado = result.recordset.length > 0 && 
      result.recordset[0].cuenta === 1;
    
    res.json({
      success: true,
      bloqueado: bloqueado,
      message: bloqueado ? 'Producto bloqueado' : 'Producto disponible'
    });
  } catch (error) {
    console.error('❌ Error al verificar bloqueo de producto:', error);
    res.status(500).json({ 
        success: false,
      message: 'Error al verificar bloqueo de producto',
      error: error.message
    });
  }
});

// Registrar movimiento completo
router.post('/registrar', async (req, res) => {
  let transaction;
  
  try {
    const { numeroMovimiento, fechaMovimiento, tipoMovimiento, opcionSalida, productos } = req.body;
    
    console.log('🚀 Iniciando registro de movimiento completo:');
    console.log('- Número:', numeroMovimiento);
    console.log('- Fecha:', fechaMovimiento);
    console.log('- Tipo:', tipoMovimiento);
    console.log('- Opción:', opcionSalida);
    console.log('- Productos:', productos.length);
    
    // Iniciar transacción con timeout extendido
    console.log('🔄 Iniciando transacción...');
    transaction = await dbService.beginTransaction();
    console.log('✅ Transacción iniciada correctamente');
    
    // 1. sp_productos_buscaSaldosX - Verificar saldos de cada producto
    console.log('📋 Paso 1: Verificando saldos de productos...');
    for (const producto of productos) {
      console.log(`🔍 Verificando saldo para producto ${producto.codpro}, lote ${producto.lote}, almacén ${producto.almacenNumero}`);
      
      const saldoParams = [
        { name: 'cod', type: sql.Char(10), value: producto.codpro },
        { name: 'lote', type: sql.Char(15), value: producto.lote },
        { name: 'alma', type: sql.Int, value: producto.almacenNumero }
      ];
      
      console.log(`⏳ Ejecutando sp_productos_buscaSaldosX para ${producto.codpro}...`);
      const saldoResult = await dbService.executeProcedureInTransaction(transaction, 'sp_productos_buscaSaldosX', saldoParams);
      console.log(`✅ sp_productos_buscaSaldosX completado para ${producto.codpro}`);
      
      console.log(`🔍 Resultado de sp_productos_buscaSaldosX para ${producto.codpro}:`);
      console.log('- Recordset length:', saldoResult.recordset.length);
      console.log('- Recordset completo:', JSON.stringify(saldoResult.recordset, null, 2));
      
      if (saldoResult.recordset.length === 0) {
        throw new Error(`No se encontró saldo para producto ${producto.codpro}, lote ${producto.lote}, almacén ${producto.almacenNumero}`);
      }
      
      const saldoDisponible = saldoResult.recordset[0].saldo;
      console.log(`📊 Saldo disponible: ${saldoDisponible}, Cantidad solicitada: ${producto.cantidad}`);
      
      if (saldoDisponible < producto.cantidad) {
        throw new Error(`Stock insuficiente para producto ${producto.codpro}, lote ${producto.lote}. Disponible: ${saldoDisponible}, Solicitado: ${producto.cantidad}`);
      }
      
      console.log(`✅ Stock verificado: ${saldoDisponible} unidades disponibles`);
    }
    
    // 2. sp_Movimientos_cab_insertar - Crear cabecera del movimiento
    console.log('📋 Paso 2: Creando cabecera del movimiento...');
    const cabeceraParams = [
      { name: 'Docu', type: sql.Char(20), value: numeroMovimiento },
      { name: 'fec', type: sql.SmallDateTime, value: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)) },
      { name: 'Observa', type: sql.Char(100), value: `Movimiento ${tipoMovimiento} - ${opcionSalida?.c_describe || 'Sin descripción'}` }
    ];
    
    console.log('⏳ Ejecutando sp_Movimientos_cab_insertar...');
    await dbService.executeProcedureInTransaction(transaction, 'sp_Movimientos_cab_insertar', cabeceraParams);
    console.log('✅ sp_Movimientos_cab_insertar completado');
    console.log('✅ Cabecera creada correctamente');
    
    // 3. sp_Movimientos_insertar - Insertar cada producto
    console.log('📋 Paso 3: Insertando productos en el movimiento...');
    for (const producto of productos) {
      console.log(`📦 Insertando producto: ${producto.codpro}, cantidad: ${producto.cantidad}`);
      
      // Calcular stock resultante para salidas
      let stockResultante = producto.stock;
      if (producto.movin === 2) { // Salida
        stockResultante = producto.stock - producto.cantidad;
        console.log(`📊 Cálculo de stock para SALIDA: ${producto.stock} - ${producto.cantidad} = ${stockResultante}`);
      } else if (producto.movin === 1) { // Entrada
        stockResultante = producto.stock + producto.cantidad;
        console.log(`📊 Cálculo de stock para ENTRADA: ${producto.stock} + ${producto.cantidad} = ${stockResultante}`);
      }
      
      console.log(`⏳ Ejecutando sp_Movimientos_insertar para ${producto.codpro}...`);
      const fechaLocal = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000));
      console.log(`📅 Fecha que se envía a sp_Movimientos_insertar:`, fechaLocal);
      
      const movimientoParams = [
        { name: 'Docu', type: sql.Char(20), value: numeroMovimiento },
        { name: 'fec', type: sql.SmallDateTime, value: fechaLocal },
        { name: 'cod', type: sql.Char(10), value: producto.codpro },
        { name: 'lote', type: sql.Char(15), value: producto.lote },
        { name: 'vence', type: sql.SmallDateTime, value: new Date(producto.fechaVencimiento) },
        { name: 'movimiento', type: sql.Int, value: producto.movin },
        { name: 'clase', type: sql.Int, value: producto.clase },
        { name: 'cantidad', type: sql.Decimal(9,2), value: producto.cantidad },
        { name: 'costo', type: sql.Money, value: producto.pCosto },
        { name: 'venta', type: sql.Money, value: producto.precioReal },
        { name: 'stock', type: sql.Decimal(9,2), value: stockResultante }, // Stock resultante calculado
        { name: 'alma', type: sql.Int, value: producto.almacenNumero }
      ];
      
      await dbService.executeProcedureInTransaction(transaction, 'sp_Movimientos_insertar', movimientoParams);
      console.log(`✅ sp_Movimientos_insertar completado para ${producto.codpro}`);
      console.log(`✅ Producto ${producto.codpro} insertado correctamente`);
    }
    
    // 4. sp_Transacciones_Insertar - Registrar transacciones
    console.log('📋 Paso 4: Registrando transacciones...');
    for (const producto of productos) {
      const transaccionParams = [
        { name: 'documento', type: sql.Char(20), value: numeroMovimiento },
        { name: 'tipodoc', type: sql.Int, value: 10 }, // TipoDoc para movimientos internos
        { name: 'fecha', type: sql.SmallDateTime, value: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)) },
        { name: 'idpro', type: sql.Char(10), value: producto.codpro },
        { name: 'lote', type: sql.Char(15), value: producto.lote },
        { name: 'Almacen', type: sql.Int, value: producto.almacenNumero },
        { name: 'tipo', type: sql.Int, value: producto.movin },
        { name: 'clase', type: sql.Int, value: producto.clase },
        { name: 'cantidad', type: sql.Decimal(9,2), value: producto.cantidad },
        { name: 'costo', type: sql.Money, value: producto.pCosto },
        { name: 'venta', type: sql.Money, value: producto.precioReal },
        { name: 'stock', type: sql.Decimal(9,2), value: producto.stock },
        { name: 'cosr', type: sql.Money, value: producto.pCosto }, // Costo real (usando pCosto)
        { name: 'nume', type: sql.Int, value: 0 } // Output parameter
      ];
      
      console.log(`⏳ Ejecutando sp_Transacciones_Insertar para ${producto.codpro}...`);
      await dbService.executeProcedureInTransaction(transaction, 'sp_Transacciones_Insertar', transaccionParams);
      console.log(`✅ sp_Transacciones_Insertar completado para ${producto.codpro}`);
    }
    
    console.log('✅ Transacciones registradas correctamente');
    
    // 5. sp_Productos_Actualiza - Actualizar inventario
    console.log('📋 Paso 5: Actualizando inventario...');
    for (const producto of productos) {
      console.log(`📦 Actualizando inventario para producto: ${producto.codpro}`);
      
      const actualizaParams = [
        { name: 'id', type: sql.Char(10), value: producto.codpro },
        { name: 'tipo', type: sql.Int, value: producto.movin },
        { name: 'canti', type: sql.Decimal(9,2), value: producto.cantidad },
        { name: 'ncosto', type: sql.Money, value: producto.pCosto },
        { name: 'nprecioM', type: sql.Money, value: producto.precioReal },
        { name: 'nprecion', type: sql.Money, value: producto.precioReal },
        { name: 'alma', type: sql.Int, value: producto.almacenNumero },
        { name: 'lote', type: sql.Char(15), value: producto.lote },
        { name: 'vencimiento', type: sql.SmallDateTime, value: new Date(producto.fechaVencimiento) }
      ];
      
      console.log(`⏳ Ejecutando sp_Productos_Actualiza para ${producto.codpro}...`);
      await dbService.executeProcedureInTransaction(transaction, 'sp_Productos_Actualiza', actualizaParams);
      console.log(`✅ sp_Productos_Actualiza completado para ${producto.codpro}`);
      console.log(`✅ Inventario actualizado para producto ${producto.codpro}`);
    }
    
    // 6. sp_ProduMal_insertar - Registrar productos malogrados (solo si es salida)
    if (tipoMovimiento === 'salida') {
      console.log('📋 Paso 6: Registrando productos malogrados...');
      for (const producto of productos) {
        const malogradoParams = [
          { name: 'prod', type: sql.Char(10), value: producto.codpro },
          { name: 'lote', type: sql.Char(15), value: producto.lote },
          { name: 'vence', type: sql.SmallDateTime, value: new Date(producto.fechaVencimiento) },
          { name: 'unidades', type: sql.Decimal(9,2), value: producto.cantidad },
          { name: 'feca', type: sql.SmallDateTime, value: new Date(fechaMovimiento) }
        ];
        
        console.log(`⏳ Ejecutando sp_ProduMal_insertar para ${producto.codpro}...`);
        await dbService.executeProcedureInTransaction(transaction, 'sp_ProduMal_insertar', malogradoParams);
        console.log(`✅ sp_ProduMal_insertar completado para ${producto.codpro}`);
        console.log(`✅ Producto malogrado registrado: ${producto.codpro}`);
      }
    }
    
    // 7. sp_Accountig_inserta - Registrar en auditoría
    console.log('📋 Paso 7: Registrando en auditoría...');
    const auditoriaParams = [
      { name: 'fecha', type: sql.SmallDateTime, value: new Date() },
      { name: 'operador', type: sql.Char(200), value: 'Administrador' },
      { name: 'usuarioSO', type: sql.Char(20), value: 'X' },
      { name: 'maquina', type: sql.Char(50), value: 'SERVER' },
      { name: 'opcion', type: sql.Char(100), value: 'Movimiento del Almacen' },
      { name: 'accion', type: sql.Char(100), value: 'Registrar Movimiento' },
      { name: 'formulario', type: sql.Char(100), value: 'frmMovimiento1' },
      { name: 'detalle', type: sql.Char(100), value: numeroMovimiento }
    ];
    
    console.log('⏳ Ejecutando sp_Accountig_inserta...');
    await dbService.executeProcedureInTransaction(transaction, 'sp_Accountig_inserta', auditoriaParams);
    console.log('✅ sp_Accountig_inserta completado');
    console.log('✅ Registro de auditoría completado');
    
    // 8. sp_Tablas_modificar - Actualizar contador
    console.log('📋 Paso 8: Actualizando contador de documentos...');
    const contadorParams = [
      { name: 'Cod', type: sql.Int, value: 352 },
      { name: 'des1', type: sql.Char(40), value: 'Numero Mov-Interno' },
      { name: 'codl', type: sql.Int, value: 1 },
      { name: 'des2', type: sql.Char(40), value: numeroMovimiento },
      { name: 'conv', type: sql.Decimal(9,2), value: 0.00 },
      { name: 'afecto', type: sql.Bit, value: 0 }
    ];
    
    console.log('⏳ Ejecutando sp_Tablas_modificar...');
    await dbService.executeProcedureInTransaction(transaction, 'sp_Tablas_modificar', contadorParams);
    console.log('✅ sp_Tablas_modificar completado');
    console.log('✅ Contador actualizado correctamente');
    
    // Confirmar transacción
    console.log('🔄 Confirmando transacción...');
    await dbService.commitTransaction(transaction);
    console.log('✅ Transacción confirmada exitosamente');
    
    console.log('🎉 Movimiento registrado exitosamente');
    
    res.json({
      success: true,
      message: 'Movimiento registrado correctamente',
      numeroMovimiento: numeroMovimiento
    });
    
  } catch (error) {
    console.error('❌ Error al registrar movimiento:', error);
    
    // Revertir transacción
    if (transaction) {
      try {
        await dbService.rollbackTransaction(transaction);
      } catch (rollbackError) {
        console.error('❌ Error al hacer rollback:', rollbackError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error al registrar movimiento',
      error: error.message
    });
  }
});

module.exports = router; 