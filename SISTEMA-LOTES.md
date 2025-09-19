# 🚀 Sistema de Procesamiento por Lotes

## Problema Resuelto ✅
ngrok free se satura con más de 300 peticiones individuales de inserción de productos. El sistema de lotes optimiza las peticiones procesando productos en grupos de 20 con delays controlados.

## Características del Sistema

### 📦 Procesamiento por Lotes
- **Tamaño de lote**: 20 productos por lote
- **Delay entre productos**: 2 segundos (configurable)
- **Delay entre lotes**: 5 segundos (configurable)
- **Procesamiento secuencial**: Un producto a la vez dentro del lote

### ⏱️ Control de Tiempo
- **Entre productos**: 2 segundos por defecto
- **Entre lotes**: 5 segundos por defecto
- **Configurable**: Puedes ajustar los delays según necesites

### 📊 Monitoreo Detallado
- **Progreso por lote**: Tracking individual de cada lote
- **Estadísticas globales**: Resumen completo del procesamiento
- **Manejo de errores**: Continuación del proceso aunque fallen algunos productos
- **Logging detallado**: Información completa en consola

## Nuevo Endpoint

### `POST /api/guias-canje/insertar-detalles-lote`

#### Request Body
```json
{
  "num": "FF01-000839",
  "productos": [
    {
      "idpro": "00910",
      "lote": "2104203",
      "vence": "2025-10-30T17:49:00.000Z",
      "cantidad": "1",
      "guia": "SIN REF",
      "referencia": "SIN REF",
      "tipodoc": "NN"
    },
    // ... más productos
  ],
  "delayEntreProductos": 2000,  // Opcional: 2 segundos por defecto
  "delayEntreLotes": 5000       // Opcional: 5 segundos por defecto
}
```

#### Response
```json
{
  "success": true,
  "message": "Procesamiento por lotes completado",
  "resultados": {
    "totalProductos": 45,
    "totalLotes": 3,
    "productosProcesados": 45,
    "productosExitosos": 43,
    "productosConError": 2,
    "errores": [
      {
        "lote": 2,
        "producto": 5,
        "idpro": "00915",
        "error": "Producto no encontrado"
      }
    ],
    "lotes": [
      {
        "numeroLote": 1,
        "productosEnLote": 20,
        "productosProcesados": 20,
        "productosExitosos": 20,
        "productosConError": 0,
        "errores": []
      }
      // ... más lotes
    ]
  }
}
```

## Ejemplo de Uso

### Desde el Frontend
```javascript
// En lugar de hacer 45 peticiones individuales:
const productos = [
  { idpro: "00910", lote: "2104203", vence: "2025-10-30T17:49:00.000Z", cantidad: "1", guia: "SIN REF", referencia: "SIN REF", tipodoc: "NN" },
  { idpro: "00911", lote: "2104204", vence: "2025-10-30T17:49:00.000Z", cantidad: "2", guia: "SIN REF", referencia: "SIN REF", tipodoc: "NN" },
  // ... 43 productos más
];

// Hacer UNA sola petición:
const response = await axios.post('/api/guias-canje/insertar-detalles-lote', {
  num: 'FF01-000839',
  productos: productos,
  delayEntreProductos: 2000,  // 2 segundos entre productos
  delayEntreLotes: 5000       // 5 segundos entre lotes
});
```

### Tiempo Estimado
- **45 productos** = 3 lotes (20, 20, 5)
- **Tiempo entre productos**: 44 × 2s = 88s
- **Tiempo entre lotes**: 2 × 5s = 10s
- **Total estimado**: ~98 segundos (1.6 minutos)

## Logs del Sistema

### Durante el Procesamiento
```
🚀 [LOTE] Iniciando procesamiento por lotes...
📋 [LOTE] Total productos: 45
⏱️ [LOTE] Delay entre productos: 2000ms
⏱️ [LOTE] Delay entre lotes: 5000ms
📦 [LOTE] Productos divididos en 3 lotes de máximo 20 productos

🔄 [LOTE 1/3] Procesando 20 productos...
📦 [LOTE 1] Producto 1/20: 00910
🔄 [INDIVIDUAL] Insertando producto: 00910
✅ [INDIVIDUAL] Producto insertado: 00910
⏱️ [LOTE 1] Esperando 2000ms...
📦 [LOTE 1] Producto 2/20: 00911
...

✅ [LOTE 1] Completado: 20/20 exitosos
⏱️ [LOTES] Esperando 5000ms entre lotes...

🔄 [LOTE 2/3] Procesando 20 productos...
...

🎉 [LOTE] Procesamiento completo: 43/45 productos exitosos
```

## Ventajas del Sistema

### ✅ Optimización de ngrok
- **Una sola petición** en lugar de 45 individuales
- **Menos saturación** de ngrok free
- **Mayor estabilidad** en la conexión

### ✅ Control de Tiempo
- **Delays configurables** según necesidades
- **Procesamiento controlado** para evitar sobrecarga
- **Tiempo estimado** calculable

### ✅ Robustez
- **Manejo de errores** individual por producto
- **Continuación del proceso** aunque fallen algunos productos
- **Logging detallado** para debugging

### ✅ Escalabilidad
- **Funciona con cualquier cantidad** de productos
- **División automática** en lotes de 20
- **Configuración flexible** de delays

## Testing

### Script de Prueba
```bash
node test-sistema-lotes.js
```

### Pruebas Incluidas
- ✅ Procesamiento de 45 productos (3 lotes)
- ✅ Cálculo de tiempo estimado
- ✅ Manejo de errores
- ✅ Estadísticas detalladas
- ✅ Logging completo

## Compatibilidad

### ✅ Mantiene Compatibilidad
- **Endpoint individual** sigue funcionando: `/api/guias-canje/insertar-detalle`
- **Misma estructura** de datos
- **Misma validación** de productos

### ✅ Nuevo Endpoint
- **Endpoint de lotes**: `/api/guias-canje/insertar-detalles-lote`
- **Funcionalidad adicional** sin romper lo existente
- **Configuración opcional** de delays

## Implementación en Frontend

### Migración Gradual
1. **Mantener** el endpoint individual para casos simples
2. **Usar** el endpoint de lotes para múltiples productos
3. **Configurar** delays según necesidades de ngrok

### Ejemplo de Implementación
```javascript
// Detectar si hay múltiples productos
if (productos.length > 1) {
  // Usar endpoint de lotes
  await axios.post('/api/guias-canje/insertar-detalles-lote', {
    num: numeroGuia,
    productos: productos,
    delayEntreProductos: 2000,
    delayEntreLotes: 5000
  });
} else {
  // Usar endpoint individual
  await axios.post('/api/guias-canje/insertar-detalle', productos[0]);
}
```

## Estado del Sistema
- ✅ **Endpoint de lotes**: Implementado y funcionando
- ✅ **Control de delays**: Configurable
- ✅ **Manejo de errores**: Robusto
- ✅ **Logging detallado**: Completo
- ✅ **Testing**: Scripts de prueba incluidos
- ✅ **Compatibilidad**: Mantiene endpoint individual

¡El sistema está listo para optimizar el procesamiento de productos y evitar la saturación de ngrok! 🚀
