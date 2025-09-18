# Ejemplos de Uso - Vista de Letras de Cambio

## Filtros Disponibles

### 1. Filtros por Fechas
- **`fechaInicio`**: Fecha de inicio (formato: YYYY-MM-DD)
- **`fechaFin`**: Fecha de fin (formato: YYYY-MM-DD)
- **`estado`**: Estado de la letra (1=Pendiente, 2=Pagado, 3=Vencido)
- **`cliente`**: Búsqueda por código o nombre del cliente

## Ejemplos de Consultas

### 1. Obtener todas las letras del vendedor
```http
GET /api/letras
Authorization: Bearer <token>
```

### 2. Letras de un rango de fechas específico
```http
GET /api/letras/filtradas?fechaInicio=2025-01-01&fechaFin=2025-03-31
Authorization: Bearer <token>
```

### 3. Letras pendientes de un mes específico
```http
GET /api/letras/filtradas?estado=1&fechaInicio=2025-01-01&fechaFin=2025-01-31
Authorization: Bearer <token>
```

### 4. Letras de un cliente específico
```http
GET /api/letras/filtradas?cliente=3290
Authorization: Bearer <token>
```

### 5. Letras vencidas en el último trimestre
```http
GET /api/letras/filtradas?estado=3&fechaInicio=2025-01-01&fechaFin=2025-03-31
Authorization: Bearer <token>
```

### 6. Estadísticas de un período específico
```http
GET /api/letras/estadisticas/filtradas?fechaInicio=2025-01-01&fechaFin=2025-12-31
Authorization: Bearer <token>
```

### 7. Estadísticas de letras pendientes
```http
GET /api/letras/estadisticas/filtradas?estado=1
Authorization: Bearer <token>
```

## Respuestas de la API

### Respuesta de Letras Filtradas
```json
{
  "success": true,
  "data": [
    {
      "Numero": "20252807",
      "CodBanco": "717-0761-7",
      "Codclie": "3290",
      "NombreCliente": "Cliente Ejemplo",
      "Vendedor": "08",
      "NombreVendedor": "Jhon Saavedra",
      "FecIni": "2025-06-20T00:00:00.000Z",
      "FecVen": "2025-09-20T00:00:00.000Z",
      "Monto": 1501.00,
      "Estado": 1,
      "EstadoDescripcion": "Pendiente",
      "SaldoPendiente": 1501.00,
      "EsVencido": 0,
      "DiasPlazo": 92,
      "DiasParaVencer": 45
    }
  ],
  "total": 1,
  "filtros": {
    "estado": "1",
    "fechaInicio": "2025-01-01",
    "fechaFin": "2025-12-31",
    "cliente": null
  }
}
```

### Respuesta de Estadísticas Filtradas
```json
{
  "success": true,
  "data": {
    "TotalLetras": 15,
    "LetrasPendientes": 8,
    "LetrasPagadas": 5,
    "LetrasVencidas": 2,
    "MontoTotal": 25000.00,
    "MontoPagado": 12000.00,
    "SaldoTotal": 13000.00,
    "PromedioDiasPlazo": 90,
    "FechaInicioMasAntigua": "2025-01-15T00:00:00.000Z",
    "FechaVencimientoMasReciente": "2025-12-31T00:00:00.000Z"
  },
  "filtros": {
    "fechaInicio": "2025-01-01",
    "fechaFin": "2025-12-31",
    "estado": null
  }
}
```

## Casos de Uso Comunes

### 1. Reporte Mensual
```http
GET /api/letras/filtradas?fechaInicio=2025-01-01&fechaFin=2025-01-31
```

### 2. Letras Vencidas
```http
GET /api/letras/filtradas?estado=3
```

### 3. Letras por Vencer (próximos 30 días)
```http
GET /api/letras/filtradas?fechaInicio=2025-01-01&fechaFin=2025-01-31
```

### 4. Análisis de Cliente
```http
GET /api/letras/filtradas?cliente=3290
```

### 5. Dashboard de Estadísticas
```http
GET /api/letras/estadisticas/filtradas?fechaInicio=2025-01-01&fechaFin=2025-12-31
```

## Notas Importantes

- **Fechas**: Usar formato ISO (YYYY-MM-DD)
- **Estados**: 1=Pendiente, 2=Pagado, 3=Vencido
- **Cliente**: Búsqueda por código o nombre (búsqueda parcial)
- **Autenticación**: Todos los endpoints requieren token JWT
- **Filtrado**: Los filtros son opcionales, se pueden combinar
- **Ordenamiento**: Las letras se ordenan por fecha de vencimiento (más reciente primero)
