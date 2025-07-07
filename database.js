const sql = require('mssql');

// Configuración del pool de conexiones
const poolConfig = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        enableArithAbort: process.env.DB_ENABLE_ARITH_ABORT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 30000,
        requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 30000
    },
    pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        min: parseInt(process.env.DB_POOL_MIN) || 0,
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
        acquireTimeoutMillis: 30000
    }
};

let pool = null;

const getConnection = async () => {
    try {
        if (!pool) {
            pool = await new sql.ConnectionPool(poolConfig).connect();
            console.log('Conexión a la base de datos establecida');
            
            // Manejar desconexiones
            pool.on('error', async err => {
                console.error('Error en la conexión de la base de datos:', err);
                await closePool();
            });
        }
        return pool;
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error);
        pool = null;
        throw error;
    }
};

const closePool = async () => {
    try {
        if (pool) {
            await pool.close();
            pool = null;
            console.log('Pool de conexiones cerrado');
        }
    } catch (error) {
        console.error('Error al cerrar el pool:', error);
        pool = null;
    }
};

// Función para ejecutar consultas con reintentos
async function executeQuery(query, params = {}, maxRetries = 3) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            const connection = await getConnection();
            const request = connection.request();
            
            // Agregar parámetros si existen
            if (params && typeof params === 'object') {
                Object.entries(params).forEach(([key, value]) => {
                    if (value !== null && value !== undefined) {
                        // Determinar el tipo SQL basado en el valor
                        if (typeof value === 'number') {
                            if (Number.isInteger(value)) {
                                request.input(key, sql.Int, value);
                            } else {
                                request.input(key, sql.Decimal(18,2), value);
                            }
                        } else if (value instanceof Date) {
                            request.input(key, sql.DateTime, value);
                        } else if (typeof value === 'boolean') {
                            request.input(key, sql.Bit, value);
                        } else {
                            // Detectar si es una fecha en formato ISO completo
                            const dateRegexISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
                            // Detectar si es una fecha en formato simple
                            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                            
                            if (dateRegexISO.test(value.toString()) || dateRegex.test(value.toString())) {
                                // Convertir string de fecha a Date object
                                const dateValue = new Date(value.toString());
                                request.input(key, sql.DateTime, dateValue);
                            } else {
                                // Para strings normales, incluimos valores vacíos también
                                request.input(key, sql.VarChar, value.toString());
                            }
                        }
                    }
                });
            }

            const result = await request.query(query);
            return result;
        } catch (error) {
            attempts++;
            console.error(`Intento ${attempts} fallido:`, error);
            
            if (error.code === 'ECONNCLOSED' || error.code === 'ECONNRESET') {
                await closePool(); // Forzar recreación del pool
                if (attempts === maxRetries) {
                    throw new Error('No se pudo establecer la conexión después de múltiples intentos');
                }
                // Esperar antes de reintentar
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            } else {
                throw error; // Si es otro tipo de error, lo lanzamos inmediatamente
            }
        }
    }
}

// Manejar el cierre de conexiones cuando la aplicación se detiene
process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closePool();
    process.exit(0);
});

module.exports = {
    getConnection,
    closePool,
    sql,
    executeQuery
}; 