# Vista de Letras de Cambio

## Descripción
Esta vista permite gestionar las letras de cambio filtradas por vendedor, utilizando el `CodigoInterno` del sistema de usuarios.

## Archivos Creados

### 1. SQL Script: `CrearVistaLetras.sql`
- **Vista**: `VistaLetrasVendedor`
- **Procedimientos**: 
  - `sp_LetrasPorVendedor`
  - `sp_EstadisticasLetrasVendedor`
  - `sp_LetrasPorVendedorFiltradas`
  - `sp_EstadisticasLetrasVendedorFiltradas`
- **Registro en VistasSistema**: Ruta `/letras`

### 2. Backend Routes: `routes/letras.js`
- **Endpoints**:
  - `GET /api/letras` - Obtener todas las letras del vendedor
  - `GET /api/letras/estadisticas` - Estadísticas de letras
  - `GET /api/letras/estadisticas/filtradas` - Estadísticas con filtros por fechas
  - `GET /api/letras/filtradas` - Letras con filtros por fechas, estado y cliente
  - `GET /api/letras/:numero` - Detalle de letra específica

## Estructura de la Vista

### Campos de DocLetra
- `Numero` - Número de la letra
- `CodBanco` - Código del banco
- `Codclie` - Código del cliente
- `Vendedor` - Código interno del vendedor
- `Plazo` - Plazo en días
- `FecIni` - Fecha de inicio
- `FecVen` - Fecha de vencimiento
- `Monto` - Monto de la letra
- `Estado` - Estado (1=Pendiente, 2=Pagado, 3=Vencido)
- `FecCan` - Fecha de cancelación
- `MontoPagado` - Monto pagado
- `Banco` - Código del banco
- `Anulado` - Si está anulada

### Campos Adicionales
- `NombreCliente` - Nombre del cliente
- `DireccionCliente` - Dirección del cliente
- `TelefonoCliente` - Teléfono del cliente
- `NombreVendedor` - Nombre del vendedor
- `EmailVendedor` - Email del vendedor
- `CelularVendedor` - Celular del vendedor
- `EstadoDescripcion` - Descripción del estado
- `EsVencido` - Si está vencida
- `DiasPlazo` - Días de plazo
- `DiasParaVencer` - Días para vencer
- `SaldoPendiente` - Saldo pendiente

## Filtrado por Vendedor

La vista filtra automáticamente por el `CodigoInterno` del usuario autenticado:
- **UsersSystems.CodigoInterno** → **DocLetra.Vendedor**

## Estados de Letras

- **1**: Pendiente
- **2**: Pagado  
- **3**: Vencido

## Endpoints de la API

### Obtener Letras
```http
GET /api/letras
Authorization: Bearer <token>
```

### Estadísticas
```http
GET /api/letras/estadisticas
Authorization: Bearer <token>
```

### Letras Filtradas
```http
GET /api/letras/filtradas?estado=1&fechaInicio=2025-01-01&fechaFin=2025-12-31&cliente=nombre
Authorization: Bearer <token>
```

### Estadísticas Filtradas
```http
GET /api/letras/estadisticas/filtradas?fechaInicio=2025-01-01&fechaFin=2025-12-31&estado=1
Authorization: Bearer <token>
```

### Detalle de Letra
```http
GET /api/letras/20252807
Authorization: Bearer <token>
```

## Instalación

1. **Ejecutar el SQL**:
   ```sql
   -- Ejecutar el archivo CrearVistaLetras.sql en la base de datos
   ```

2. **Reiniciar el Backend**:
   ```bash
   # El backend ya tiene las rutas configuradas
   npm restart
   ```

3. **Verificar**:
   - La vista aparece en `VistasSistema` con ruta `/letras`
   - Los endpoints están disponibles en `/api/letras`

## Permisos

La vista respeta los permisos del sistema:
- Solo muestra letras del vendedor autenticado
- Requiere token de autenticación
- Filtra por `CodigoInterno` del usuario

## Índices Creados

- `IX_DocLetra_Vendedor_Estado` - Para consultas por vendedor y estado
- `IX_DocLetra_Cliente_Estado` - Para consultas por cliente y estado
