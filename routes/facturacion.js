const express = require('express');
const router = express.Router();
const { getConnection } = require('../database');
const sql = require('mssql');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

// Configuración de Nubefact
const NUBEFACT_URL = 'https://api.nubefact.com/api/v1/28aba033-5473-4edd-89d8-a391f25d0603';
const NUBEFACT_TOKEN = 'd87736f8851d4683a23ace96a3e67fc3ace917c82f7f43779b4111cbe532d63c';

// Función para limpiar texto y evitar errores de Nubefact (caracteres invisibles, espacios múltiples, etc.)
function limpiarTexto(valor) {
  if (!valor) return "";
  return String(valor)
    .replace(/\s+/g, ' ') // Elimina espacios múltiples (tabs, newlines, espacios dobles)
    .replace(/[^a-zA-Z0-9ÁÉÍÓÚÜÑáéíóúüñ#\-,.\s]/g, '') // Elimina caracteres raros, mantiene letras, números, tildes, #, -, comas, puntos
    .trim()
    .toUpperCase();
}

// Función para limpiar descripción de productos (agrega espacios entre números y letras)
function limpiarDescripcion(valor) {
  if (!valor) return "";
  let texto = String(valor)
    .replace(/\s+/g, ' ') // Elimina espacios múltiples
    .replace(/([a-zA-Z])(\d)/g, '$1 $2') // Agrega espacio entre letra y número
    .replace(/(\d)([a-zA-Z])/g, '$1 $2') // Agrega espacio entre número y letra
    .replace(/[^a-zA-Z0-9ÁÉÍÓÚÜÑáéíóúüñ#\-,.\s]/g, '') // Elimina caracteres raros
    .trim();
  // Convertir a título (primera letra mayúscula, resto minúsculas) para mejor legibilidad
  return texto.split(' ').map(palabra => {
    if (palabra.length > 0) {
      return palabra[0].toUpperCase() + palabra.slice(1).toLowerCase();
    }
    return palabra;
  }).join(' ');
}

// Obtener facturas con filtros
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const { 
      doc_electronico,
      procesado,
      serie,
      numero,
      fechaDesde,
      fechaHasta
    } = req.query;

    let whereConditions = ['1=1'];
    
    if (doc_electronico) {
      whereConditions.push(`c.Doc_electronico LIKE @doc_electronico`);
    }
    
    if (procesado !== undefined && procesado !== '') {
      whereConditions.push(`c.Procesado = @procesado`);
    }
    
    if (serie) {
      whereConditions.push(`c.serie = @serie`);
    }
    
    if (numero) {
      whereConditions.push(`c.Numero LIKE @numero`);
    }
    
    if (fechaDesde) {
      whereConditions.push(`CAST(c.FechaEmision AS DATE) >= @fechaDesde`);
    }
    
    if (fechaHasta) {
      whereConditions.push(`CAST(c.FechaEmision AS DATE) <= @fechaHasta`);
    }

    const whereClause = whereConditions.join(' AND ');
    
    const query = `
      SELECT 
        c.Doc_electronico,
        c.Procesado,
        c.serie,
        c.Numero,
        c.FechaEmision,
        c.Moneda,
        c.MontoLetras,
        c.TotalIgv,
        c.TotalVenta,
        c.Gravadas,
        c.Exoneradas,
        c.Inafectas,
        c.Gratuitas,
        c.DescuentoGlobal,
        r.Nrodocumento,
        r.TipoDocumento,
        r.NombreLegal,
        r.Email
      FROM FE_FAC_CAB c
      LEFT JOIN FE_FAC_REC r ON c.Doc_electronico = r.Doc_Electronico
      WHERE ${whereClause}
      ORDER BY c.FechaEmision DESC
    `;

    const request = pool.request();
    
    if (doc_electronico) {
      request.input('doc_electronico', `%${doc_electronico}%`);
    }
    
    if (procesado !== undefined && procesado !== '') {
      request.input('procesado', parseInt(procesado));
    }
    
    if (serie) {
      request.input('serie', serie);
    }
    
    if (numero) {
      request.input('numero', `%${numero}%`);
    }
    
    if (fechaDesde) {
      request.input('fechaDesde', fechaDesde);
    }
    
    if (fechaHasta) {
      request.input('fechaHasta', fechaHasta);
    }

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (error) {
    console.error('Error obteniendo facturas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las facturas',
      details: error.message
    });
  }
});

// Obtener detalle completo de una factura
router.get('/:doc_electronico', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    const { doc_electronico } = req.params;
    
    // Obtener cabecera
    const cabeceraQuery = `
      SELECT * FROM FE_FAC_CAB WHERE Doc_electronico = @doc_electronico
    `;
    const cabeceraResult = await pool.request()
      .input('doc_electronico', doc_electronico)
      .query(cabeceraQuery);
    
    if (cabeceraResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Factura no encontrada'
      });
    }
    
    // Obtener detalles
    const detalleQuery = `
      SELECT * FROM FE_FAC_DET WHERE Doc_electronico = @doc_electronico ORDER BY Id
    `;
    const detalleResult = await pool.request()
      .input('doc_electronico', doc_electronico)
      .query(detalleQuery);
    
    // Obtener formas de pago
    const formaQuery = `
      SELECT * FROM FE_FAC_FORMA WHERE Doc_electronico = @doc_electronico
    `;
    const formaResult = await pool.request()
      .input('doc_electronico', doc_electronico)
      .query(formaQuery);
    
    // Obtener receptor
    const receptorQuery = `
      SELECT * FROM FE_FAC_REC WHERE Doc_Electronico = @doc_electronico
    `;
    const receptorResult = await pool.request()
      .input('doc_electronico', doc_electronico)
      .query(receptorQuery);
    
    res.json({
      success: true,
      data: {
        cabecera: cabeceraResult.recordset[0],
        detalles: detalleResult.recordset,
        formasPago: formaResult.recordset,
        receptor: receptorResult.recordset[0] || null
      }
    });

  } catch (error) {
    console.error('Error obteniendo detalle de factura:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el detalle de la factura',
      details: error.message
    });
  }
});

// Enviar factura a Nubefact
router.post('/:doc_electronico/enviar', authenticateToken, async (req, res) => {
  try {
    const pool = await getConnection();
    // Limpiar el doc_electronico (eliminar espacios y decodificar URL)
    let { doc_electronico } = req.params;
    doc_electronico = decodeURIComponent(doc_electronico).trim();
    
    // Obtener todos los datos de la factura
    const cabeceraQuery = `
      SELECT * FROM FE_FAC_CAB WHERE Doc_electronico = @doc_electronico
    `;
    const cabeceraResult = await pool.request()
      .input('doc_electronico', doc_electronico)
      .query(cabeceraQuery);
    
    if (cabeceraResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Factura no encontrada'
      });
    }
    
    const cabecera = cabeceraResult.recordset[0];
    
    // Verificar si ya está procesada
    if (cabecera.Procesado === 1) {
      return res.status(400).json({
        success: false,
        error: 'La factura ya ha sido procesada'
      });
    }
    
    // Obtener detalles
    const detalleQuery = `
      SELECT * FROM FE_FAC_DET WHERE Doc_electronico = @doc_electronico ORDER BY Id
    `;
    const detalleResult = await pool.request()
      .input('doc_electronico', doc_electronico)
      .query(detalleQuery);
    
    // Obtener formas de pago
    const formaQuery = `
      SELECT * FROM FE_FAC_FORMA WHERE Doc_electronico = @doc_electronico
    `;
    const formaResult = await pool.request()
      .input('doc_electronico', doc_electronico)
      .query(formaQuery);
    
    // Obtener receptor
    const receptorQuery = `
      SELECT * FROM FE_FAC_REC WHERE Doc_Electronico = @doc_electronico
    `;
    const receptorResult = await pool.request()
      .input('doc_electronico', doc_electronico)
      .query(receptorQuery);
    
    if (receptorResult.recordset.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se encontró información del receptor'
      });
    }
    
    const receptor = receptorResult.recordset[0];
    const detalles = detalleResult.recordset;
    const formasPago = formaResult.recordset;
    
    // ========================================================================
    // MAPEO DIRECTO DE CAMPOS BD → NUBEFACT
    // Todos los datos vienen de la base de datos
    // ========================================================================
    
    // Función para formatear fecha a DD-MM-YYYY (formato Nubefact)
    const formatearFechaNubefact = (fecha) => {
      if (!fecha) return "";
      try {
        const f = new Date(fecha);
        const dia = String(f.getDate()).padStart(2, '0');
        const mes = String(f.getMonth() + 1).padStart(2, '0');
        const anio = f.getFullYear();
        return `${dia}-${mes}-${anio}`;
      } catch (e) {
        return "";
      }
    };
    
    // ========================================================================
    // DATOS DE FE_FAC_CAB (Cabecera)
    // ========================================================================
    const serieLimpia = (cabecera.serie || "").trim();
    const numeroLimpio = parseInt(cabecera.Numero) || 0;
    
    // ========================================================================
    // FECHA DE EMISIÓN: SIEMPRE DEBE SER HOY
    // SUNAT rechaza automáticamente si la fecha no es la fecha actual
    // ========================================================================
    const hoy = new Date();
    const diaHoy = String(hoy.getDate()).padStart(2, '0');
    const mesHoy = String(hoy.getMonth() + 1).padStart(2, '0');
    const anioHoy = hoy.getFullYear();
    const fechaEmision = `${diaHoy}-${mesHoy}-${anioHoy}`;  // Formato DD-MM-YYYY (HOY)
    
    // ========================================================================
    // DATOS DE FE_FAC_REC (Receptor/Cliente)
    // ========================================================================
    const tipoDocCliente = parseInt(receptor.TipoDocumento) || 6;
    const nroDocCliente = (receptor.Nrodocumento || "").trim();
    const nombreCliente = limpiarTexto(receptor.NombreLegal);
    const direccionCliente = limpiarTexto(receptor.direccion);
    const emailCliente = (receptor.Email || "").trim();
    const ubigeoCliente = (receptor.Ubigeo || "").trim();
    const dptoCliente = limpiarTexto(receptor.dpto);
    const provinciaCliente = limpiarTexto(receptor.Provincia);
    const distritoCliente = limpiarTexto(receptor.Distrito);
    
    // Validaciones básicas
    if (!serieLimpia || numeroLimpio === 0) {
      return res.status(400).json({
        success: false,
        error: 'La factura no tiene serie o número válido'
      });
    }
    
    if (!nroDocCliente || !nombreCliente) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos del cliente (RUC o Nombre)'
      });
    }
    
    if (detalles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'La factura no tiene items'
      });
    }
    
    // Fecha de vencimiento de FE_FAC_FORMA.Vencimiento
    let fechaVencimiento = "";
    if (formasPago.length > 0 && formasPago[0].Vencimiento) {
      fechaVencimiento = formatearFechaNubefact(formasPago[0].Vencimiento);
    }
    
    // ========================================================================
    // TOTALES DE FE_FAC_CAB - TODO DIRECTO DE LA BD
    // ========================================================================
    const totalGravada = parseFloat(cabecera.Gravadas || 0);
    const totalExonerada = parseFloat(cabecera.Exoneradas || 0);
    const totalInafecta = parseFloat(cabecera.Inafectas || 0);
    const totalGratuita = parseFloat(cabecera.Gratuitas || 0);
    const totalIgv = parseFloat(cabecera.TotalIgv || 0);
    const totalVenta = parseFloat(cabecera.TotalVenta || 0);
    const descuentoGlobal = parseFloat(cabecera.DescuentoGlobal || 0);
    
    // ========================================================================
    // CONSTRUIR JSON PARA NUBEFACT
    // ========================================================================
    const documentoNubefact = {
      operacion: "generar_comprobante",
      tipo_de_comprobante: 1,                                    // 1=Factura
      serie: serieLimpia,                                        // FE_FAC_CAB.serie
      numero: numeroLimpio,                                      // FE_FAC_CAB.Numero
      sunat_transaction: 1,                                      // 1=Venta interna
      cliente_tipo_de_documento: tipoDocCliente,                 // FE_FAC_REC.TipoDocumento
      cliente_numero_de_documento: nroDocCliente,                // FE_FAC_REC.Nrodocumento
      cliente_denominacion: nombreCliente,                       // FE_FAC_REC.NombreLegal
      cliente_direccion: direccionCliente,                       // FE_FAC_REC.direccion
      cliente_email: emailCliente,                               // FE_FAC_REC.Email
      cliente_email_1: "",
      cliente_email_2: "",
      fecha_de_emision: fechaEmision,                            // FE_FAC_CAB.FechaEmision (formato DD-MM-YYYY)
      fecha_de_vencimiento: fechaVencimiento,                    // FE_FAC_FORMA.Vencimiento
      moneda: 1,                                                 // 1=PEN
      porcentaje_de_igv: 18.00,
      descuento_global: descuentoGlobal > 0 ? descuentoGlobal : "",
      total_gravada: totalGravada > 0 ? totalGravada : "",       // FE_FAC_CAB.Gravadas
      total_exonerada: totalExonerada > 0 ? totalExonerada : "", // FE_FAC_CAB.Exoneradas
      total_inafecta: totalInafecta > 0 ? totalInafecta : "",    // FE_FAC_CAB.Inafectas
      total_gratuita: totalGratuita > 0 ? totalGratuita : "",    // FE_FAC_CAB.Gratuitas
      total_igv: totalIgv,                                       // FE_FAC_CAB.TotalIgv
      total: totalVenta,                                         // FE_FAC_CAB.TotalVenta
      enviar_automaticamente_a_la_sunat: true,
      enviar_automaticamente_al_cliente: emailCliente ? true : false,
      
      // ========================================================================
      // ITEMS - MAPEO SEGÚN TIPO DE IMPUESTO
      // ========================================================================
      // TipoImpuesto en BD:
      //   10 = Gravado (tipo_de_igv = 1)
      //   15 = Inafecto - Retiro por publicidad / Bonificación gratuita (tipo_de_igv = 15)
      //   20 = Exonerado (tipo_de_igv = 8)
      //
      // Para items GRATUITOS (TipoImpuesto = 15, TipoPrecio = 02):
      //   - valor_unitario = 0 (precio gratis)
      //   - precio_unitario = PrecioReferencial (valor referencial)
      //   - igv = 0
      //   - total = 0
      //
      // Para items GRAVADOS (TipoImpuesto = 10, TipoPrecio = 01):
      //   - valor_unitario = PrecioUnitario (sin IGV)
      //   - precio_unitario = valor_unitario * 1.18
      //   - igv = Impuesto (de BD)
      //   - total = TotalVenta (de BD)
      // ========================================================================
      items: detalles.map((detalle) => {
        const tipoImpuestoBD = parseInt(detalle.TipoImpuesto || 10);
        const tipoPrecioBD = (detalle.TipoPrecio || "01").toString().trim();
        const cantidad = parseFloat(detalle.cantidad || 0);
        
        // Determinar si es item gratuito
        // TipoPrecio = "02" o TipoImpuesto = 15 indica gratuito
        const esGratuito = tipoPrecioBD === "02" || tipoImpuestoBD === 15;
        
        let tipoIgvNubefact;
        let valorUnitario;
        let precioUnitario;
        let igvMonto;
        let subtotal;
        let total;
        
        if (esGratuito) {
          // ========== ITEM GRATUITO / BONIFICACIÓN ==========
          // tipo_de_igv = 15 (Inafecto - Retiro por publicidad)
          // 
          // REGLA NUBEFACT/SUNAT (error 3105):
          // - El total NO puede ser 0, debe tener el VALOR REFERENCIAL
          // - SUNAT necesita saber cuánto hubiera costado el producto
          // - El item lleva el valor referencial, y también va en total_gratuita
          //
          tipoIgvNubefact = 15;
          // Usar PrecioReferencial como valor referencial
          const precioRef = parseFloat(detalle.PrecioReferencial || 0);
          valorUnitario = precioRef;                                      // Valor referencial
          precioUnitario = precioRef;                                     // Valor referencial (sin IGV para inafecto)
          subtotal = Math.round(precioRef * cantidad * 100) / 100;        // Valor referencial total
          igvMonto = 0;                                                   // Sin IGV (es inafecto)
          total = subtotal;                                               // Total = valor referencial (NO puede ser 0)
        } else if (tipoImpuestoBD === 10 || tipoImpuestoBD === 1) {
          // ========== ITEM GRAVADO ==========
          // tipo_de_igv = 1 (Gravado - Operación Onerosa)
          tipoIgvNubefact = 1;
          valorUnitario = parseFloat(detalle.PrecioUnitario || 0);      // FE_FAC_DET.PrecioUnitario
          precioUnitario = Math.round(valorUnitario * 1.18 * 1000000) / 1000000;  // valor_unitario * 1.18
          subtotal = Math.round(valorUnitario * cantidad * 100) / 100;  // valor_unitario * cantidad
          igvMonto = parseFloat(detalle.Impuesto || 0);                 // FE_FAC_DET.Impuesto
          total = Math.round((subtotal + igvMonto) * 100) / 100;        // subtotal + igv
        } else if (tipoImpuestoBD === 20 || tipoImpuestoBD === 8) {
          // ========== ITEM EXONERADO ==========
          // tipo_de_igv = 8 (Exonerado - Operación Onerosa)
          tipoIgvNubefact = 8;
          valorUnitario = parseFloat(detalle.PrecioUnitario || 0);
          precioUnitario = valorUnitario;                               // Sin IGV
          subtotal = Math.round(valorUnitario * cantidad * 100) / 100;
          igvMonto = 0;
          total = subtotal;
        } else {
          // ========== OTROS (Inafecto) ==========
          tipoIgvNubefact = 9;
          valorUnitario = parseFloat(detalle.PrecioUnitario || 0);
          precioUnitario = valorUnitario;
          subtotal = Math.round(valorUnitario * cantidad * 100) / 100;
          igvMonto = 0;
          total = subtotal;
        }
        
        return {
          unidad_de_medida: (detalle.UnidadMedida || "NIU").trim().toUpperCase(),
          codigo: limpiarTexto(detalle.codigoItem),
          descripcion: limpiarDescripcion(detalle.descripcion),
          cantidad: cantidad,
          valor_unitario: valorUnitario,
          precio_unitario: precioUnitario,
          descuento: "",                                                // No enviar descuento
          subtotal: subtotal,
          tipo_de_igv: tipoIgvNubefact,
          igv: igvMonto,
          total: total
        };
      }),
      
      condiciones_de_pago: formasPago.length > 0 && formasPago[0].FormaPago === "Credito" ? "Credito" : "Contado",
      medio_de_pago: formasPago.length > 0 && formasPago[0].FormaPago === "Credito" ? "Credito" : "Efectivo"
    };
    
    // ========================================================================
    // VENTA AL CRÉDITO - DATOS DE FE_FAC_FORMA
    // ========================================================================
    const esCredito = formasPago.length > 0 && formasPago[0].FormaPago === "Credito";
    
    if (esCredito && formasPago.length > 0) {
      documentoNubefact.venta_al_credito = formasPago.map((forma, index) => {
        return {
          cuota: index + 1,
          fecha_de_pago: formatearFechaNubefact(forma.Vencimiento),      // FE_FAC_FORMA.Vencimiento
          importe: parseFloat(forma.Monto || 0)                          // FE_FAC_FORMA.Monto
        };
      });
    }
    
    // Enviar a Nubefact
    console.log('📤 Enviando factura a Nubefact:', doc_electronico);
    console.log('📋 Items:', JSON.stringify(documentoNubefact.items, null, 2));
    console.log('📋 Datos completos:', JSON.stringify(documentoNubefact, null, 2));
    
    const nubefactResponse = await axios.post(
      NUBEFACT_URL,
      documentoNubefact,
      {
        headers: {
          'Authorization': `Token token="${NUBEFACT_TOKEN}"`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Respuesta de Nubefact:', nubefactResponse.data);
    
    // Actualizar el estado de procesado en la base de datos
    const updateQuery = `
      UPDATE FE_FAC_CAB 
      SET Procesado = 1 
      WHERE Doc_electronico = @doc_electronico
    `;
    await pool.request()
      .input('doc_electronico', doc_electronico)
      .query(updateQuery);
    
    // También actualizar en las tablas de detalle, forma y receptor
    await pool.request()
      .input('doc_electronico', doc_electronico)
      .query('UPDATE FE_FAC_DET SET procesado = 1 WHERE Doc_electronico = @doc_electronico');
    
    await pool.request()
      .input('doc_electronico', doc_electronico)
      .query('UPDATE FE_FAC_REC SET Procesado = 1 WHERE Doc_Electronico = @doc_electronico');
    
    res.json({
      success: true,
      message: 'Factura enviada exitosamente a Nubefact',
      data: {
        nubefact_response: nubefactResponse.data,
        doc_electronico: doc_electronico
      }
    });

  } catch (error) {
    console.error('Error enviando factura a Nubefact:', error);
    
    // Si es un error de axios, incluir más detalles
    if (error.response) {
      console.error('Respuesta de error de Nubefact:', error.response.data);
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Error al enviar factura a Nubefact',
        details: error.response.data || error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error al enviar factura a Nubefact',
      details: error.message
    });
  }
});

module.exports = router;

