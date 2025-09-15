const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const { getConnection } = require('../database');
const whatsappController = require('../controllers/whatsappController');
const { 
  checkFailedAttempts, 
  recordFailedAttempt, 
  clearFailedAttempts, 
  generateSecureCode,
  SECURITY_CONFIG 
} = require('../middleware/security');
const { JWT_SECRET } = require('../middleware/auth');
const router = express.Router();

// =====================================================
// ENDPOINT: Validar DNI/RUC y obtener datos del usuario
// =====================================================
router.post('/validar-documento', async (req, res) => {
  try {
    const { documento, tipoUsuario } = req.body;

    // Validar que el documento sea válido
    if (!documento || (documento.length !== 8 && documento.length !== 11)) {
      return res.status(400).json({
        success: false,
        message: 'Documento inválido. Debe tener 8 dígitos (DNI) o 11 dígitos (RUC)'
      });
    }

    // Validar que solo contenga números
    if (!/^\d+$/.test(documento)) {
      return res.status(400).json({
        success: false,
        message: 'El documento solo puede contener números'
      });
    }

    // Validar tipo de usuario
    if (!tipoUsuario || !['Admin', 'Trabajador'].includes(tipoUsuario)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de usuario inválido'
      });
    }

    // Buscar usuario en la base de datos
    const pool = await getConnection();
    const result = await pool.request()
      .input('documento', sql.VarChar, documento)
      .input('tipoUsuario', sql.VarChar, tipoUsuario)
      .query(`
        SELECT 
          IDUS,
          CodigoInterno,
          Nombres,
          DNI_RUC,
          NumeroCelular,
          Email,
          TipoUsuario,
          Rol,
          Activo,
          Bloqueado,
          IntentosFallidos
        FROM UsersSystems 
        WHERE DNI_RUC = @documento 
          AND TipoUsuario = @tipoUsuario
          AND Activo = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado o no tiene permisos para este tipo de acceso'
      });
    }

    const usuario = result.recordset[0];

    // Verificar si está bloqueado
    if (usuario.Bloqueado) {
      return res.status(403).json({
        success: false,
        message: 'Usuario bloqueado. Contacte al administrador'
      });
    }

    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Usuario encontrado',
      data: {
        idus: usuario.IDUS,
        codigoInterno: usuario.CodigoInterno,
        nombres: usuario.Nombres,
        dniRuc: usuario.DNI_RUC,
        numeroCelular: usuario.NumeroCelular,
        email: usuario.Email,
        tipoUsuario: usuario.TipoUsuario,
        rol: usuario.Rol,
        intentosFallidos: usuario.IntentosFallidos
      }
    });

  } catch (error) {
    console.error('Error validando documento:', error);
    
    // Determinar el tipo de error y proporcionar mensaje específico
    let errorMessage = 'Error interno del servidor';
    let statusCode = 500;
    
    if (error.code === 'ESOCKET' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'No se puede conectar con la base de datos. Verifique la conectividad de red.';
      statusCode = 503; // Service Unavailable
    } else if (error.code === 'ELOGIN') {
      errorMessage = 'Error de autenticación con la base de datos.';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Servidor de base de datos no encontrado.';
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: {
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

// =====================================================
// ENDPOINT: Generar y enviar código de verificación
// =====================================================
router.post('/enviar-codigo', checkFailedAttempts, async (req, res) => {
  try {
    const { idus, numeroCelular } = req.body;

    if (!idus || !numeroCelular) {
      return res.status(400).json({
        success: false,
        message: 'Datos incompletos'
      });
    }

    // Generar código de 6 dígitos más seguro
    const codigo = generateSecureCode();

    // Calcular fecha de expiración (1 minuto)
    const fechaExpira = new Date();
    fechaExpira.setTime(fechaExpira.getTime() + SECURITY_CONFIG.CODE_EXPIRY);

    const pool = await getConnection();

    // Limpiar códigos anteriores del usuario
    await pool.request()
      .input('idus', sql.Int, idus)
      .query('DELETE FROM CodigosTemporales WHERE IDUS = @idus');

    // Insertar nuevo código
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('codigo', sql.VarChar, codigo)
      .input('fechaExpira', sql.DateTime, fechaExpira)
      .query(`
        INSERT INTO CodigosTemporales (IDUS, Codigo, FechaExpira)
        VALUES (@idus, @codigo, @fechaExpira)
      `);

    // Registrar en log
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('tipoAcceso', sql.VarChar, 'CodigoEnviado')
      .input('codigoEnviado', sql.VarChar, codigo)
      .input('exitoso', sql.Bit, 1)
      .query(`
        INSERT INTO LogAccesos (IDUS, TipoAcceso, CodigoEnviado, Exitoso)
        VALUES (@idus, @tipoAcceso, @codigoEnviado, @exitoso)
      `);

    // Obtener datos del usuario para el mensaje
    const usuarioResult = await pool.request()
      .input('idus', sql.Int, idus)
      .query('SELECT Nombres FROM UsersSystems WHERE IDUS = @idus');
    
    const nombreUsuario = usuarioResult.recordset[0]?.Nombres || 'Usuario';

    // Enviar código por WhatsApp
    const whatsappResult = await whatsappController.enviarCodigoVerificacion(
      numeroCelular, 
      codigo, 
      nombreUsuario
    );

    if (!whatsappResult.success) {
      console.error('Error enviando por WhatsApp:', whatsappResult.message);
      // Continuar de todas formas, el código está guardado en BD
    }

    res.json({
      success: true,
      message: 'Código enviado exitosamente por WhatsApp',
      data: {
        expiraEn: fechaExpira,
        whatsapp: whatsappResult
      }
    });

  } catch (error) {
    console.error('Error enviando código:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// ENDPOINT: Verificar código y crear sesión
// =====================================================
router.post('/verificar-codigo', checkFailedAttempts, async (req, res) => {
  try {
    const { idus, codigo, mantenerSesion, ipAcceso, dispositivo } = req.body;

    if (!idus || !codigo) {
      return res.status(400).json({
        success: false,
        message: 'Datos incompletos'
      });
    }

    const pool = await getConnection();

    // Buscar código válido
    const result = await pool.request()
      .input('idus', sql.Int, idus)
      .input('codigo', sql.VarChar, codigo)
      .query(`
        SELECT * FROM CodigosTemporales 
        WHERE IDUS = @idus 
          AND Codigo = @codigo 
          AND Usado = 0 
          AND FechaExpira > GETDATE()
      `);

    if (result.recordset.length === 0) {
      // Registrar intento fallido en la base de datos
      await pool.request()
        .input('idus', sql.Int, idus)
        .input('tipoAcceso', sql.VarChar, 'CodigoVerificado')
        .input('codigoVerificado', sql.VarChar, codigo)
        .input('exitoso', sql.Bit, 0)
        .input('mensajeError', sql.VarChar, 'Código inválido o expirado')
        .query(`
          INSERT INTO LogAccesos (IDUS, TipoAcceso, CodigoVerificado, Exitoso, MensajeError)
          VALUES (@idus, @tipoAcceso, @codigoVerificado, @exitoso, @mensajeError)
        `);

      // Registrar intento fallido en el middleware de seguridad
      recordFailedAttempt(req);

      return res.status(400).json({
        success: false,
        message: 'Código inválido o expirado'
      });
    }

    // Marcar código como usado
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('codigo', sql.VarChar, codigo)
      .query(`
        UPDATE CodigosTemporales 
        SET Usado = 1, FechaUso = GETDATE()
        WHERE IDUS = @idus AND Codigo = @codigo
      `);

    // Generar código de acceso de 6 dígitos
    const codigoAcceso = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Calcular expiración del código de acceso (24 horas)
    const codigoAccesoExpira = new Date();
    codigoAccesoExpira.setHours(codigoAccesoExpira.getHours() + 24);

    // Calcular expiración de sesión
    const sesionExpira = new Date();
    if (mantenerSesion) {
      sesionExpira.setDate(sesionExpira.getDate() + 30); // 30 días
    } else {
      sesionExpira.setHours(sesionExpira.getHours() + 8); // 8 horas
    }

    // Actualizar usuario con nueva sesión
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('codigoAcceso', sql.VarChar, codigoAcceso)
      .input('codigoAccesoExpira', sql.DateTime, codigoAccesoExpira)
      .input('sesionActiva', sql.Bit, 1)
      .input('mantenerSesion', sql.Bit, mantenerSesion || 0)
      .input('sesionExpira', sql.DateTime, sesionExpira)
      .input('ultimoAcceso', sql.DateTime, new Date())
      .input('ipUltimoAcceso', sql.VarChar, ipAcceso || '')
      .input('dispositivoActual', sql.VarChar, dispositivo || '')
      .input('intentosFallidos', sql.Int, 0)
      .query(`
        UPDATE UsersSystems 
        SET CodigoAcceso = @codigoAcceso,
            CodigoAccesoExpira = @codigoAccesoExpira,
            SesionActiva = @sesionActiva,
            MantenerSesion = @mantenerSesion,
            SesionExpira = @sesionExpira,
            UltimoAcceso = @ultimoAcceso,
            IPUltimoAcceso = @ipUltimoAcceso,
            DispositivoActual = @dispositivoActual,
            IntentosFallidos = @intentosFallidos,
            Bloqueado = 0,
            FechaModificacion = GETDATE()
        WHERE IDUS = @idus
      `);

    // Registrar login exitoso
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('tipoAcceso', sql.VarChar, 'Login')
      .input('codigoVerificado', sql.VarChar, codigo)
      .input('exitoso', sql.Bit, 1)
      .input('ipAcceso', sql.VarChar, ipAcceso || '')
      .input('dispositivo', sql.VarChar, dispositivo || '')
      .query(`
        INSERT INTO LogAccesos (IDUS, TipoAcceso, CodigoVerificado, Exitoso, IPAcceso, Dispositivo)
        VALUES (@idus, @tipoAcceso, @codigoVerificado, @exitoso, @ipAcceso, @dispositivo)
      `);

    // Limpiar intentos fallidos exitosos
    clearFailedAttempts(req);

    // Obtener datos del usuario actualizado
    const usuarioResult = await pool.request()
      .input('idus', sql.Int, idus)
      .query(`
        SELECT 
          IDUS,
          CodigoInterno,
          Nombres,
          DNI_RUC,
          NumeroCelular,
          Email,
          TipoUsuario,
          Rol,
          CodigoAcceso,
          CodigoAccesoExpira,
          SesionActiva,
          MantenerSesion,
          SesionExpira
        FROM UsersSystems 
        WHERE IDUS = @idus
      `);

    const usuario = usuarioResult.recordset[0];

    // Generar token JWT
    const tokenPayload = {
      idus: usuario.IDUS,
      tipoUsuario: usuario.TipoUsuario,
      nombres: usuario.Nombres,
      CodigoInterno: usuario.CodigoInterno
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: mantenerSesion ? '7d' : '24h' // 7 días si mantiene sesión, 24 horas si no
    });

    res.json({
      success: true,
      message: 'Código verificado exitosamente',
      data: {
        token: token,
        usuario: {
          idus: usuario.IDUS,
          codigoInterno: usuario.CodigoInterno,
          nombres: usuario.Nombres,
          dniRuc: usuario.DNI_RUC,
          numeroCelular: usuario.NumeroCelular,
          email: usuario.Email,
          tipoUsuario: usuario.TipoUsuario,
          rol: usuario.Rol
        },
        sesion: {
          codigoAcceso: usuario.CodigoAcceso,
          codigoAccesoExpira: usuario.CodigoAccesoExpira,
          sesionActiva: usuario.SesionActiva,
          mantenerSesion: usuario.MantenerSesion,
          sesionExpira: usuario.SesionExpira
        }
      }
    });

  } catch (error) {
    console.error('Error verificando código:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// ENDPOINT: Verificar estado de la base de datos
// =====================================================
router.get('/db-status', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT 1 as test');
    
    res.json({
      success: true,
      message: 'Base de datos conectada correctamente',
      data: {
        connected: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error verificando estado de la base de datos:', error);
    
    res.status(503).json({
      success: false,
      message: 'Base de datos no disponible',
      data: {
        connected: false,
        error: {
          code: error.code,
          message: error.message
        },
        timestamp: new Date().toISOString()
      }
    });
  }
});

// =====================================================
// ENDPOINT: Verificar estado del bot de WhatsApp
// =====================================================
router.get('/bot-status', async (req, res) => {
  try {
    const botStatus = await whatsappController.verificarEstadoBot();
    
    res.json({
      success: true,
      message: 'Estado del bot obtenido',
      data: botStatus
    });
  } catch (error) {
    console.error('Error verificando estado del bot:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando estado del bot'
    });
  }
});

// =====================================================
// ENDPOINT: Verificar si un número está autorizado
// =====================================================
router.post('/verificar-numero', async (req, res) => {
  try {
    const { numeroCelular } = req.body;

    if (!numeroCelular) {
      return res.status(400).json({
        success: false,
        message: 'Número de celular requerido'
      });
    }

    const resultado = await whatsappController.verificarNumeroAutorizado(numeroCelular);
    
    res.json({
      success: true,
      message: 'Verificación completada',
      data: resultado
    });
  } catch (error) {
    console.error('Error verificando número:', error);
    res.status(500).json({
      success: false,
      message: 'Error verificando número'
    });
  }
});

// =====================================================
// ENDPOINT: Agregar número autorizado al bot
// =====================================================
router.post('/agregar-numero', async (req, res) => {
  try {
    const { numeroCelular, nombreUsuario } = req.body;

    if (!numeroCelular || !nombreUsuario) {
      return res.status(400).json({
        success: false,
        message: 'Número de celular y nombre de usuario requeridos'
      });
    }

    const resultado = await whatsappController.agregarNumeroAutorizado(numeroCelular, nombreUsuario);
    
    res.json({
      success: true,
      message: 'Número agregado exitosamente',
      data: resultado
    });
  } catch (error) {
    console.error('Error agregando número:', error);
    res.status(500).json({
      success: false,
      message: 'Error agregando número'
    });
  }
});

// =====================================================
// ENDPOINT: Cerrar sesión
// =====================================================
router.post('/logout', async (req, res) => {
  try {
    const { idus } = req.body;

    if (!idus) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario requerido'
      });
    }

    const pool = await getConnection();
    
    // Actualizar estado de sesión en la base de datos
    await pool.request()
      .input('idus', sql.Int, idus)
      .query(`
        UPDATE UsersSystems 
        SET SesionActiva = 0, 
            CodigoAcceso = NULL,
            CodigoAccesoExpira = NULL,
            CodigoAccesoDispositivo = NULL,
            UltimoAcceso = GETDATE()
        WHERE IDUS = @idus
      `);

    // Registrar logout en LogAccesos
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('tipoAcceso', sql.VarChar, 'Logout')
      .input('exitoso', sql.Bit, 1)
      .query(`
        INSERT INTO LogAccesos (IDUS, TipoAcceso, Exitoso)
        VALUES (@idus, @tipoAcceso, @exitoso)
      `);

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    console.error('Error cerrando sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error cerrando sesión'
    });
  }
});

// =====================================================
// ENDPOINTS DE GESTIÓN DE USUARIOS
// =====================================================

// Obtener todos los usuarios
router.get('/usuarios', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const result = await pool.request().query(`
      SELECT 
        IDUS, CodigoInterno, Nombres, DNI_RUC, NumeroCelular, Email,
        TipoUsuario, Rol, Permisos, Activo, Bloqueado, SesionActiva,
        UltimoAcceso, FechaCreacion, FechaModificacion
      FROM UsersSystems 
      ORDER BY FechaCreacion DESC
    `);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo usuarios'
    });
  }
});

// Crear nuevo usuario
router.post('/usuarios', async (req, res) => {
  try {
    const {
      CodigoInterno, Nombres, DNI_RUC, NumeroCelular, Email,
      TipoUsuario, Rol, Permisos, Activo, Bloqueado
    } = req.body;

    // Validaciones básicas
    if (!CodigoInterno || !Nombres || !DNI_RUC || !NumeroCelular || !Rol) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }

    // Validar DNI/RUC
    if (!/^(\d{8}|\d{11})$/.test(DNI_RUC)) {
      return res.status(400).json({
        success: false,
        message: 'DNI debe tener 8 dígitos o RUC 11 dígitos'
      });
    }

    // Validar número de celular
    if (!/^\d{9,15}$/.test(NumeroCelular)) {
      return res.status(400).json({
        success: false,
        message: 'Número de celular debe tener entre 9 y 15 dígitos'
      });
    }

    const pool = await getConnection();
    
    // Verificar si el DNI/RUC ya existe
    const existingUser = await pool.request()
      .input('dni_ruc', sql.VarChar, DNI_RUC)
      .query('SELECT IDUS FROM UsersSystems WHERE DNI_RUC = @dni_ruc');
    
    if (existingUser.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este DNI/RUC'
      });
    }

    // Verificar si el código interno ya existe
    const existingCode = await pool.request()
      .input('codigo', sql.VarChar, CodigoInterno)
      .query('SELECT IDUS FROM UsersSystems WHERE CodigoInterno = @codigo');
    
    if (existingCode.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este código interno'
      });
    }

    // Obtener el siguiente IDUS
    const maxIdResult = await pool.request().query('SELECT MAX(IDUS) as maxId FROM UsersSystems');
    const nextId = (maxIdResult.recordset[0].maxId || 0) + 1;

    // Insertar nuevo usuario
    await pool.request()
      .input('idus', sql.Int, nextId)
      .input('codigoInterno', sql.VarChar, CodigoInterno)
      .input('nombres', sql.VarChar, Nombres)
      .input('dni_ruc', sql.VarChar, DNI_RUC)
      .input('numeroCelular', sql.VarChar, NumeroCelular)
      .input('email', sql.VarChar, Email || null)
      .input('tipoUsuario', sql.VarChar, TipoUsuario || 'Trabajador')
      .input('rol', sql.VarChar, Rol)
      .input('permisos', sql.Text, Permisos || null)
      .input('activo', sql.Bit, Activo !== false)
      .input('bloqueado', sql.Bit, Bloqueado === true)
      .query(`
        INSERT INTO UsersSystems (
          IDUS, CodigoInterno, Nombres, DNI_RUC, NumeroCelular, Email,
          TipoUsuario, Rol, Permisos, Activo, Bloqueado
        ) VALUES (
          @idus, @codigoInterno, @nombres, @dni_ruc, @numeroCelular, @email,
          @tipoUsuario, @rol, @permisos, @activo, @bloqueado
        )
      `);

    res.json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: { IDUS: nextId }
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando usuario'
    });
  }
});

// Actualizar usuario
router.put('/usuarios/:idus', async (req, res) => {
  try {
    const { idus } = req.params;
    const {
      CodigoInterno, Nombres, DNI_RUC, NumeroCelular, Email,
      TipoUsuario, Rol, Permisos, Activo, Bloqueado
    } = req.body;

    // Validaciones básicas
    if (!CodigoInterno || !Nombres || !DNI_RUC || !NumeroCelular || !Rol) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }

    const pool = await getConnection();
    
    // Verificar si el usuario existe
    const existingUser = await pool.request()
      .input('idus', sql.Int, idus)
      .query('SELECT IDUS FROM UsersSystems WHERE IDUS = @idus');
    
    if (existingUser.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar si el DNI/RUC ya existe en otro usuario
    const existingDni = await pool.request()
      .input('dni_ruc', sql.VarChar, DNI_RUC)
      .input('idus', sql.Int, idus)
      .query('SELECT IDUS FROM UsersSystems WHERE DNI_RUC = @dni_ruc AND IDUS != @idus');
    
    if (existingDni.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe otro usuario con este DNI/RUC'
      });
    }

    // Verificar si el código interno ya existe en otro usuario
    const existingCode = await pool.request()
      .input('codigo', sql.VarChar, CodigoInterno)
      .input('idus', sql.Int, idus)
      .query('SELECT IDUS FROM UsersSystems WHERE CodigoInterno = @codigo AND IDUS != @idus');
    
    if (existingCode.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe otro usuario con este código interno'
      });
    }

    // Actualizar usuario
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('codigoInterno', sql.VarChar, CodigoInterno)
      .input('nombres', sql.VarChar, Nombres)
      .input('dni_ruc', sql.VarChar, DNI_RUC)
      .input('numeroCelular', sql.VarChar, NumeroCelular)
      .input('email', sql.VarChar, Email || null)
      .input('tipoUsuario', sql.VarChar, TipoUsuario || 'Trabajador')
      .input('rol', sql.VarChar, Rol)
      .input('permisos', sql.Text, Permisos || null)
      .input('activo', sql.Bit, Activo !== false)
      .input('bloqueado', sql.Bit, Bloqueado === true)
      .query(`
        UPDATE UsersSystems SET
          CodigoInterno = @codigoInterno,
          Nombres = @nombres,
          DNI_RUC = @dni_ruc,
          NumeroCelular = @numeroCelular,
          Email = @email,
          TipoUsuario = @tipoUsuario,
          Rol = @rol,
          Permisos = @permisos,
          Activo = @activo,
          Bloqueado = @bloqueado,
          FechaModificacion = GETDATE()
        WHERE IDUS = @idus
      `);

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando usuario'
    });
  }
});

// Eliminar usuario
router.delete('/usuarios/:idus', async (req, res) => {
  try {
    const { idus } = req.params;
    const pool = await getConnection();
    
    // Verificar si el usuario existe
    const existingUser = await pool.request()
      .input('idus', sql.Int, idus)
      .query('SELECT IDUS FROM UsersSystems WHERE IDUS = @idus');
    
    if (existingUser.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Eliminar usuario (cascade delete eliminará registros relacionados)
    await pool.request()
      .input('idus', sql.Int, idus)
      .query('DELETE FROM UsersSystems WHERE IDUS = @idus');

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando usuario'
    });
  }
});

module.exports = router;
