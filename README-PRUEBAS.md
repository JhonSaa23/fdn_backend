# 🧪 Scripts de Prueba Completa

## Problemas Resueltos ✅
1. **CORS**: Configuración completa para ngrok y Render
2. **Error 500**: Endpoint insertar-cabecera corregido
3. **Validaciones**: Manejo robusto de errores
4. **Logging**: Debugging detallado

## Scripts Disponibles

### 1. `obtener-token-real.js` 🔑
```bash
node obtener-token-real.js
```
**Propósito**: Obtener un token válido automáticamente
**Funciona**: Intenta diferentes credenciales y obtiene token real

### 2. `test-insertar-cabecera.js` 🧪
```bash
node test-insertar-cabecera.js
```
**Propósito**: Prueba completa de todo el sistema
**Incluye**:
- ✅ Obtención automática de token
- ✅ Prueba de inserción de cabecera
- ✅ Prueba de validaciones
- ✅ Prueba de endpoints relacionados
- ✅ Prueba de flujo completo (cabecera + detalle)

### 3. `test-cors-ngrok.js` 🌐
```bash
node test-cors-ngrok.js
```
**Propósito**: Verificar conectividad CORS con ngrok

## Instrucciones de Uso

### Opción 1: Automática (Recomendada)
```bash
# 1. Obtener token automáticamente
node obtener-token-real.js

# 2. Ejecutar todas las pruebas
node test-insertar-cabecera.js
```

### Opción 2: Manual
```bash
# 1. Obtener token del navegador
# - Ve a tu aplicación web
# - Inicia sesión
# - Abre F12 → Console
# - Busca: "🔍 [AXIOS] Authorization header set: Bearer..."
# - Copia el token después de "Bearer "

# 2. Editar test-insertar-cabecera.js
# - Reemplaza 'REEMPLAZA_CON_TU_TOKEN_REAL' con tu token

# 3. Ejecutar pruebas
node test-insertar-cabecera.js
```

## Qué Prueba Cada Script

### 🔑 Obtención de Token
- Intenta diferentes credenciales
- Maneja código de verificación
- Obtiene token válido

### 🧪 Pruebas de Endpoint
- **Inserción de cabecera**: Con datos válidos
- **Validaciones**: Campos requeridos, fechas inválidas
- **Endpoints relacionados**: Listar, buscar, estructura
- **Flujo completo**: Cabecera + detalle + verificación

### 🌐 Pruebas de CORS
- Peticiones básicas
- Preflight requests (OPTIONS)
- Headers de CORS
- Conectividad con ngrok

## Resultados Esperados

### ✅ CORS Funcionando
```
'access-control-allow-origin': '*',
'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
'access-control-allow-headers': 'Content-Type, Authorization, ngrok-skip-browser-warning...'
```

### ✅ Endpoint Funcionando
```
✅ Respuesta exitosa: { success: true, message: 'Cabecera de guía de canje insertada correctamente' }
```

### ✅ Validaciones Funcionando
```
✅ Validación funcionó correctamente: Faltan datos requeridos: docu, feca, Prov son obligatorios
```

### ✅ Flujo Completo Funcionando
```
✅ Cabecera insertada: { success: true, numero: 'FF01-123456' }
✅ Detalle insertado: { success: true }
✅ Verificación exitosa: { success: true, data: {...} }
🎉 ¡Flujo completo exitoso!
```

## Troubleshooting

### Token Inválido
```
❌ Error: Token inválido
```
**Solución**: Ejecutar `node obtener-token-real.js` para obtener token válido

### CORS Error
```
❌ Error: No 'Access-Control-Allow-Origin' header
```
**Solución**: Reiniciar el backend para aplicar cambios de CORS

### Error 500
```
❌ Error: Error al insertar cabecera de guía de canje
```
**Solución**: Verificar logs del backend para detalles específicos

## Logs del Backend
Los logs ahora incluyen información detallada:
```
🔄 [INSERTAR CABECERA] Iniciando proceso...
📋 [INSERTAR CABECERA] Datos recibidos: {...}
✅ [INSERTAR CABECERA] Inserción exitosa
```

## Estado del Sistema
- ✅ **CORS**: Configurado correctamente
- ✅ **Endpoint insertar-cabecera**: Corregido y funcionando
- ✅ **Validaciones**: Implementadas
- ✅ **Logging**: Mejorado
- ✅ **Scripts de prueba**: Completos

¡El sistema está listo para usar! 🚀
