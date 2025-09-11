const axios = require('axios');

// =====================================================
// CONTROLADOR PARA INTEGRACIÓN CON BOT DE WHATSAPP
// =====================================================

class WhatsAppController {
  constructor() {
    // URL del bot de WhatsApp (puerto 3008)
    this.botUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:3008';
    this.apiKey = process.env.WHATSAPP_API_KEY || 'default-key';
  }

  /**
   * Enviar código de verificación por WhatsApp
   * @param {string} numeroCelular - Número de celular (formato: 51916094798)
   * @param {string} codigo - Código de 6 dígitos
   * @param {string} nombreUsuario - Nombre del usuario
   * @returns {Promise<Object>} - Resultado del envío
   */
  async enviarCodigoVerificacion(numeroCelular, codigo, nombreUsuario) {
    try {

      // Formatear número si es necesario (agregar código de país si no lo tiene)
      const numeroFormateado = this.formatearNumero(numeroCelular);

      // Mensaje personalizado para el código
      const mensaje = `🔐 *Código de Verificación - Fármacos del Norte*

Hola ${nombreUsuario},

Tu código de verificación es: *${codigo}*

⏰ Este código expira en 1 minuto.

Si no solicitaste este código, ignora este mensaje.

---
*Sistema Interno Fármacos del Norte*`;

      // Llamar al bot de WhatsApp
      const response = await axios.post(`${this.botUrl}/v1/messages`, {
        number: numeroFormateado,
        message: mensaje
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 segundos timeout
      });

      // El bot devuelve "sended" si es exitoso
      if (response.data === 'sended' || response.status === 200) {
        return {
          success: true,
          message: 'Código enviado exitosamente',
          data: {
            numeroEnviado: numeroFormateado,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        throw new Error(response.data.message || 'Error desconocido del bot');
      }

    } catch (error) {
      console.error('❌ Error enviando código por WhatsApp:', error.message);
      
      // Si el bot no está disponible, simular envío para desarrollo
      if (error.code === 'ECONNREFUSED' || error.message.includes('timeout')) {
        return {
          success: true,
          message: 'Código simulado (bot no disponible)',
          data: {
            numeroEnviado: numeroCelular,
            codigo: codigo, // Solo para desarrollo
            timestamp: new Date().toISOString(),
            simulacion: true
          }
        };
      }

      return {
        success: false,
        message: 'Error enviando código por WhatsApp',
        error: error.message
      };
    }
  }

  /**
   * Verificar si un número está autorizado en el bot
   * @param {string} numeroCelular - Número de celular
   * @returns {Promise<Object>} - Estado de autorización
   */
  async verificarNumeroAutorizado(numeroCelular) {
    try {
      const numeroFormateado = this.formatearNumero(numeroCelular);

      // Usar el endpoint de authorized que sí existe en tu bot
      const response = await axios.post(`${this.botUrl}/v1/authorized`, {
        number: numeroFormateado,
        intent: 'check'
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return {
        success: true,
        autorizado: response.data.isAuthorized || false,
        data: response.data
      };

    } catch (error) {
      console.error('❌ Error verificando autorización:', error.message);
      return {
        success: false,
        autorizado: false,
        error: error.message
      };
    }
  }

  /**
   * Agregar número a la lista de autorizados del bot
   * @param {string} numeroCelular - Número de celular
   * @param {string} nombreUsuario - Nombre del usuario
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async agregarNumeroAutorizado(numeroCelular, nombreUsuario) {
    try {
      const numeroFormateado = this.formatearNumero(numeroCelular);

      // Usar el endpoint de authorized que sí existe en tu bot
      const response = await axios.post(`${this.botUrl}/v1/authorized`, {
        number: numeroFormateado,
        intent: 'add'
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        message: 'Número agregado exitosamente',
        data: response.data
      };

    } catch (error) {
      console.error('❌ Error agregando número autorizado:', error.message);
      return {
        success: false,
        message: 'Error agregando número autorizado',
        error: error.message
      };
    }
  }

  /**
   * Formatear número de celular para WhatsApp
   * @param {string} numero - Número original
   * @returns {string} - Número formateado
   */
  formatearNumero(numero) {
    // Remover espacios, guiones y paréntesis
    let numeroLimpio = numero.replace(/[\s\-\(\)]/g, '');
    
    // Si no tiene código de país, agregar 51 (Perú)
    if (!numeroLimpio.startsWith('51')) {
      numeroLimpio = '51' + numeroLimpio;
    }
    
    return numeroLimpio;
  }

  /**
   * Verificar estado del bot de WhatsApp
   * @returns {Promise<Object>} - Estado del bot
   */
  async verificarEstadoBot() {
    try {
      // Probar con un endpoint simple que sabemos que existe
      const response = await axios.get(`${this.botUrl}/`, {
        timeout: 5000
      });

      return {
        success: true,
        online: true,
        data: response.data
      };

    } catch (error) {
      console.error('❌ Bot de WhatsApp no disponible:', error.message);
      return {
        success: false,
        online: false,
        error: error.message
      };
    }
  }
}

module.exports = new WhatsAppController();
