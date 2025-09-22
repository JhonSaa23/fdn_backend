const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3023/api/pedido_app';
const TEST_DOCUMENT = '12345678'; // Documento de prueba
const TEST_PASSWORD = '123456'; // Contraseña de prueba

// Datos de prueba para crear un pedido
const pedidoTest = {
  numeroCorrelativo: 'Fdn-0000008', // Número que obtuvimos del correlativo
  clienteData: {
    Codclie: 1,
    Razon: 'Cliente de Prueba S.A.C.',
    Documento: '12345678',
    Direccion: 'Av. Test 123, Lima',
    Telefono: '987654321'
  },
  productos: [
    {
      codpro: '001',
      nombre_producto: 'Producto de Prueba 1',
      Pventa: 100.00,
      cantidad: 2,
      subtotal: 200.00,
      Desc1: 0,
      Desc2: 0,
      Desc3: 0,
      afecto: 1,
      esBonificacion: false,
      unimed: 1, // Unidad de medida
      adicional: 0, // Adicional
      unidad: 1, // Unidades
      paquete: 0, // Paquete
      autoriza: false, // Autorización
      nbonif: 2, // MISMO nbonif que su bonificación
      codprom: '', // Código promoción
      descab: '', // Descripción cabecera
      codofer: '', // Código oferta
      codaut: '' // Código autorización
    },
    {
      codpro: '002',
      nombre_producto: 'Producto de Prueba 2',
      Pventa: 50.00,
      cantidad: 1,
      subtotal: 50.00,
      Desc1: 10, // 10% descuento
      Desc2: 0,
      Desc3: 0,
      afecto: 1,
      esBonificacion: false,
      unimed: 1, // Unidad de medida
      adicional: 0, // Adicional
      unidad: 1, // Unidades
      paquete: 0, // Paquete
      autoriza: false, // Autorización
      nbonif: 0, // Sin bonificación
      codprom: '', // Código promoción
      descab: '', // Descripción cabecera
      codofer: '', // Código oferta
      codaut: '' // Código autorización
    },
    {
      codpro: '003',
      nombre_producto: 'Bonificación del Producto 1',
      Pventa: 25.00,
      cantidad: 1,
      subtotal: 0.00, // Las bonificaciones tienen subtotal 0
      Desc1: 100, // Las bonificaciones tienen 100% de descuento
      Desc2: 0,
      Desc3: 0,
      afecto: 1,
      esBonificacion: true, // ES BONIFICACIÓN
      unimed: 1, // Unidad de medida
      adicional: 0, // Adicional
      unidad: 1, // Unidades
      paquete: 0, // Paquete
      autoriza: false, // Autorización
      nbonif: 2, // MISMO nbonif que el producto principal (001)
      codprom: '', // Código promoción
      descab: '', // Descripción cabecera
      codofer: '', // Código oferta
      codaut: '' // Código autorización
    },
    {
      codpro: '004',
      nombre_producto: 'Producto de Prueba 3',
      Pventa: 75.00,
      cantidad: 1,
      subtotal: 75.00,
      Desc1: 0,
      Desc2: 0,
      Desc3: 0,
      afecto: 1,
      esBonificacion: false,
      unimed: 1, // Unidad de medida
      adicional: 0, // Adicional
      unidad: 1, // Unidades
      paquete: 0, // Paquete
      autoriza: false, // Autorización
      nbonif: 1, // NUEVO grupo de bonificación
      codprom: '', // Código promoción
      descab: '', // Descripción cabecera
      codofer: '', // Código oferta
      codaut: '' // Código autorización
    },
    {
      codpro: '005',
      nombre_producto: 'Bonificación del Producto 3',
      Pventa: 30.00,
      cantidad: 1,
      subtotal: 0.00, // Las bonificaciones tienen subtotal 0
      Desc1: 100, // Las bonificaciones tienen 100% de descuento
      Desc2: 0,
      Desc3: 0,
      afecto: 1,
      esBonificacion: true, // ES BONIFICACIÓN
      unimed: 1, // Unidad de medida
      adicional: 0, // Adicional
      unidad: 1, // Unidades
      paquete: 0, // Paquete
      autoriza: false, // Autorización
      nbonif: 1, // MISMO nbonif que el producto principal (004)
      codprom: '', // Código promoción
      descab: '', // Descripción cabecera
      codofer: '', // Código oferta
      codaut: '' // Código autorización
    }
  ],
  configuracion: {
    tipoDocumento: 1, // 1=Factura
    condicion: 1,
    observacion: 'Pedido de prueba desde test',
    urgente: false,
    estado: 2, // 2=Comercial
    igv: 18
  }
};

async function testCrearPedido() {
  try {
    console.log('🧪 [TEST-CREAR-PEDIDO] Iniciando prueba de creación de pedido...');
    
    // 1. Validar documento y obtener token
    console.log('🔐 [TEST-CREAR-PEDIDO] Validando documento...');
    const validateResponse = await axios.post(`${BASE_URL}/validar-documento`, {
      documento: TEST_DOCUMENT,
      password: TEST_PASSWORD
    });

    if (!validateResponse.data.success) {
      throw new Error(`Error validando documento: ${validateResponse.data.message}`);
    }

    const token = validateResponse.data.token;
    console.log('✅ [TEST-CREAR-PEDIDO] Documento validado, token obtenido');

    // 2. Crear pedido completo
    console.log('🛒 [TEST-CREAR-PEDIDO] Creando pedido completo...');
    console.log('📋 [TEST-CREAR-PEDIDO] Datos del pedido:');
    console.log('   - Número correlativo:', pedidoTest.numeroCorrelativo);
    console.log('   - Cliente:', pedidoTest.clienteData.Razon);
    console.log('   - Productos:', pedidoTest.productos.length);

    const crearResponse = await axios.post(
      `${BASE_URL}/crear-pedido`,
      pedidoTest,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (crearResponse.data.success) {
      console.log('✅ [TEST-CREAR-PEDIDO] Pedido creado exitosamente!');
      console.log('📊 [TEST-CREAR-PEDIDO] Detalles del pedido creado:');
      console.log('   - Número:', crearResponse.data.data.numeroPedido);
      console.log('   - Cliente:', crearResponse.data.data.cliente);
      console.log('   - Total productos:', crearResponse.data.data.totalProductos);
      console.log('   - Subtotal:', crearResponse.data.data.subtotal);
      console.log('   - IGV:', crearResponse.data.data.igv);
      console.log('   - Total:', crearResponse.data.data.total);
      console.log('   - Estado:', crearResponse.data.data.estado);
      console.log('   - Fecha:', crearResponse.data.data.fecha);
    } else {
      console.error('❌ [TEST-CREAR-PEDIDO] Error creando pedido:', crearResponse.data.error);
    }

  } catch (error) {
    console.error('❌ [TEST-CREAR-PEDIDO] Error en la prueba:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('📋 [TEST-CREAR-PEDIDO] Detalles del error:', error.response.data.details);
    }
  }
}

// Ejecutar prueba
testCrearPedido();
