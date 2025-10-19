const express = require('express');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getConnection } = require('../database');
const { JWT_SECRET } = require('../middleware/auth');
const router = express.Router();

// =====================================================
// ENDPOINT: Login con DNI y contraseña
// =====================================================
router.post('/login', async (req, res) => {
  try {
    const { dni, password, mantenerSesion, ipAcceso, dispositivo } = req.body;
    
    console.log('🔐 [LOGIN] Datos recibidos:', {
      dni: dni ? dni.substring(0, 3) + '***' : 'undefined',
      hasPassword: !!password,
      passwordLength: password ? password.length : 0,
      mantenerSesion,
      ipAcceso,
      dispositivo: dispositivo ? dispositivo.substring(0, 50) + '...' : 'undefined'
    });

    // Validaciones básicas
    if (!dni || !password) {
      return res.status(400).json({
        success: false,
        message: 'DNI y contraseña son requeridos'
      });
    }

    // Validar formato del DNI
    if (!/^\d{8}$/.test(dni)) {
      return res.status(400).json({
        success: false,
        message: 'El DNI debe tener 8 dígitos'
      });
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const pool = await getConnection();

    // Buscar usuario por DNI
    const result = await pool.request()
      .input('dni', sql.VarChar, dni)
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
          PasswordHash,
          Activo,
          Bloqueado,
          IntentosFallidos,
          UltimoBloqueo
        FROM UsersSystems 
        WHERE DNI_RUC = @dni 
          AND Activo = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
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

    // Verificar si tiene contraseña configurada
    if (!usuario.PasswordHash) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no tiene contraseña configurada. Contacte al administrador'
      });
    }

    // Verificar contraseña
    console.log('🔐 [LOGIN] Verificando contraseña para usuario:', {
      idus: usuario.IDUS,
      dni: usuario.DNI_RUC,
      nombres: usuario.Nombres,
      hasPasswordHash: !!usuario.PasswordHash,
      passwordHashLength: usuario.PasswordHash ? usuario.PasswordHash.length : 0
    });
    
    const passwordMatch = await bcrypt.compare(password, usuario.PasswordHash);
    console.log('🔐 [LOGIN] Resultado de comparación de contraseña:', passwordMatch);
    
    if (!passwordMatch) {
      // Incrementar intentos fallidos
      const nuevosIntentos = (usuario.IntentosFallidos || 0) + 1;
      const bloquearUsuario = nuevosIntentos >= 5;
      
      await pool.request()
        .input('idus', sql.Int, usuario.IDUS)
        .input('intentosFallidos', sql.Int, nuevosIntentos)
        .input('bloqueado', sql.Bit, bloquearUsuario ? 1 : 0)
        .input('ultimoBloqueo', sql.DateTime, bloquearUsuario ? new Date() : null)
        .query(`
          UPDATE UsersSystems 
          SET IntentosFallidos = @intentosFallidos,
              Bloqueado = @bloqueado,
              UltimoBloqueo = @ultimoBloqueo,
              FechaModificacion = GETDATE()
          WHERE IDUS = @idus
        `);

      // Registrar intento fallido
      await pool.request()
        .input('idus', sql.Int, usuario.IDUS)
        .input('tipoAcceso', sql.VarChar, 'Login')
        .input('exitoso', sql.Bit, 0)
        .input('ipAcceso', sql.VarChar(45), (ipAcceso || '').substring(0, 45))
        .input('dispositivo', sql.VarChar(255), (dispositivo || '').substring(0, 255))
        .input('mensajeError', sql.VarChar, 'Contraseña incorrecta')
        .query(`
          INSERT INTO LogAccesos (IDUS, TipoAcceso, Exitoso, IPAcceso, Dispositivo, MensajeError)
          VALUES (@idus, @tipoAcceso, @exitoso, @ipAcceso, @dispositivo, @mensajeError)
        `);

      const mensajeError = bloquearUsuario 
        ? 'Usuario bloqueado por múltiples intentos fallidos' 
        : `Contraseña incorrecta. Intentos restantes: ${5 - nuevosIntentos}`;

      return res.status(401).json({
        success: false,
        message: mensajeError
      });
    }

    // Login exitoso - limpiar intentos fallidos
    await pool.request()
      .input('idus', sql.Int, usuario.IDUS)
      .input('intentosFallidos', sql.Int, 0)
      .input('bloqueado', sql.Bit, 0)
      .input('ultimoBloqueo', sql.DateTime, null)
      .query(`
        UPDATE UsersSystems 
        SET IntentosFallidos = @intentosFallidos,
            Bloqueado = @bloqueado,
            UltimoBloqueo = @ultimoBloqueo,
            FechaModificacion = GETDATE()
        WHERE IDUS = @idus
      `);

    // Calcular expiración de sesión
    const sesionExpira = new Date();
    if (mantenerSesion) {
      // Si marca "siempre activo", el token no expira
      sesionExpira.setFullYear(sesionExpira.getFullYear() + 10); // 10 años (prácticamente nunca)
    } else {
      // Token de 11 horas
      sesionExpira.setHours(sesionExpira.getHours() + 11);
    }

    // Actualizar usuario con nueva sesión
    console.log('🔐 [LOGIN] Actualizando datos de sesión en UsersSystems...');
    try {
      await pool.request()
        .input('idus', sql.Int, usuario.IDUS)
        .input('sesionActiva', sql.Bit, 1)
        .input('mantenerSesion', sql.Bit, mantenerSesion || 0)
        .input('sesionExpira', sql.DateTime, sesionExpira)
        .input('ultimoAcceso', sql.DateTime, new Date())
        .input('ipUltimoAcceso', sql.VarChar(45), (ipAcceso || '').substring(0, 45))
        .input('dispositivoActual', sql.VarChar(100), (dispositivo || '').substring(0, 100))
        .input('intentosFallidos', sql.Int, 0)
        .query(`
          UPDATE UsersSystems 
          SET SesionActiva = @sesionActiva,
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
      console.log('✅ [LOGIN] UsersSystems actualizado exitosamente');
    } catch (updateError) {
      console.log('❌ [LOGIN] Error actualizando UsersSystems:', updateError.message);
      throw updateError;
    }

    // Registrar login exitoso
    console.log('🔐 [LOGIN] Registrando login exitoso en LogAccesos...');
    try {
      await pool.request()
        .input('idus', sql.Int, usuario.IDUS)
        .input('tipoAcceso', sql.VarChar(50), 'Login')
        .input('exitoso', sql.Bit, 1)
        .input('ipAcceso', sql.VarChar(45), (ipAcceso || '').substring(0, 45))
        .input('dispositivo', sql.VarChar(100), (dispositivo || '').substring(0, 100))
        .query(`
          INSERT INTO LogAccesos (IDUS, TipoAcceso, Exitoso, IPAcceso, Dispositivo)
          VALUES (@idus, @tipoAcceso, @exitoso, @ipAcceso, @dispositivo)
        `);
      console.log('✅ [LOGIN] LogAccesos insertado exitosamente');
    } catch (logError) {
      console.log('⚠️ [LOGIN] Error en LogAccesos (continuando):', logError.message);
      // Continuar sin fallar si LogAccesos tiene problemas
    }

    // Generar token JWT
    const tokenPayload = {
      idus: usuario.IDUS,
      tipoUsuario: usuario.TipoUsuario,
      nombres: usuario.Nombres,
      CodigoInterno: usuario.CodigoInterno
    };

    // Configurar expiración del token
    const tokenExpiry = mantenerSesion ? '365d' : '11h'; // 365 días si mantiene sesión, 11 horas si no
    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: tokenExpiry
    });

    res.json({
      success: true,
      message: 'Login exitoso',
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
          sesionActiva: true,
          mantenerSesion: mantenerSesion || false,
          sesionExpira: sesionExpira,
          tokenExpiry: tokenExpiry
        }
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// ENDPOINT: Cambiar contraseña
// =====================================================
router.post('/cambiar-password', async (req, res) => {
  try {
    const { idus, passwordActual, passwordNueva, confirmarPassword } = req.body;

    // Validaciones
    if (!idus || !passwordActual || !passwordNueva || !confirmarPassword) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }

    if (passwordNueva !== confirmarPassword) {
      return res.status(400).json({
        success: false,
        message: 'Las contraseñas no coinciden'
      });
    }

    if (passwordNueva.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    const pool = await getConnection();

    // Obtener usuario actual
    const result = await pool.request()
      .input('idus', sql.Int, idus)
      .query('SELECT PasswordHash FROM UsersSystems WHERE IDUS = @idus');

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const usuario = result.recordset[0];

    // Verificar contraseña actual
    const passwordMatch = await bcrypt.compare(passwordActual, usuario.PasswordHash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    // Hashear nueva contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(passwordNueva, saltRounds);

    // Actualizar contraseña
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('passwordHash', sql.NVarChar, hashedPassword)
      .input('intentosFallidos', sql.Int, 0)
      .input('bloqueado', sql.Bit, 0)
      .input('ultimoBloqueo', sql.DateTime, null)
      .query(`
        UPDATE UsersSystems 
        SET PasswordHash = @passwordHash,
            IntentosFallidos = @intentosFallidos,
            Bloqueado = @bloqueado,
            UltimoBloqueo = @ultimoBloqueo,
            FechaModificacion = GETDATE()
        WHERE IDUS = @idus
      `);

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// ENDPOINT: Establecer contraseña inicial (para administradores)
// =====================================================
router.post('/establecer-password', async (req, res) => {
  try {
    const { idus, password } = req.body;

    // Validaciones
    if (!idus || !password) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario y contraseña son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const pool = await getConnection();

    // Verificar que el usuario existe
    const result = await pool.request()
      .input('idus', sql.Int, idus)
      .query('SELECT IDUS FROM UsersSystems WHERE IDUS = @idus');

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Hashear contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Actualizar contraseña
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('passwordHash', sql.NVarChar, hashedPassword)
      .input('intentosFallidos', sql.Int, 0)
      .input('bloqueado', sql.Bit, 0)
      .input('ultimoBloqueo', sql.DateTime, null)
      .query(`
        UPDATE UsersSystems 
        SET PasswordHash = @passwordHash,
            IntentosFallidos = @intentosFallidos,
            Bloqueado = @bloqueado,
            UltimoBloqueo = @ultimoBloqueo,
            FechaModificacion = GETDATE()
        WHERE IDUS = @idus
      `);

    res.json({
      success: true,
      message: 'Contraseña establecida exitosamente'
    });

  } catch (error) {
    console.error('Error estableciendo contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// =====================================================
// ENDPOINT: Para cambiar la contraseña de un usuario
// =====================================================
router.post('/cambiar-password', async (req, res) => {
  try {
    const { idus, passwordActual, passwordNueva, confirmarPassword } = req.body;

    if (!idus || !passwordActual || !passwordNueva || !confirmarPassword) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }

    if (passwordNueva !== confirmarPassword) {
      return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
    }

    if (passwordNueva.length < 6) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const pool = await getConnection();

    // Obtener la contraseña actual del usuario
    const result = await pool.request()
      .input('idus', sql.Int, idus)
      .query(`
        SELECT PasswordHash 
        FROM UsersSystems 
        WHERE IDUS = @idus
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const usuario = result.recordset[0];

    // Verificar la contraseña actual
    const passwordMatch = await bcrypt.compare(passwordActual, usuario.PasswordHash || '');
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta' });
    }

    // Hash de la nueva contraseña
    const hashedNewPassword = await bcrypt.hash(passwordNueva, 12);

    // Actualizar la contraseña
    await pool.request()
      .input('idus', sql.Int, idus)
      .input('passwordHash', sql.NVarChar, hashedNewPassword)
      .query(`
        UPDATE UsersSystems
        SET PasswordHash = @passwordHash,
            FechaModificacion = GETDATE()
        WHERE IDUS = @idus
      `);

    res.json({ success: true, message: 'Contraseña cambiada exitosamente' });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al cambiar contraseña' });
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

module.exports = router;
