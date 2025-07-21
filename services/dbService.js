const { getConnection, sql } = require('../database');

// Función para ejecutar procedimientos almacenados
exports.executeProcedure = async (procedureName, parameters = []) => {
    try {
        const connection = await getConnection();
        const request = connection.request();
        
        // Agregar parámetros al request
        parameters.forEach(param => {
            request.input(param.name, param.type, param.value);
        });
        
        const result = await request.execute(procedureName);
        return result;
    } catch (error) {
        console.error(`Error ejecutando procedimiento ${procedureName}:`, error);
        throw error;
    }
};

// Función para ejecutar consultas SQL directas
exports.executeQuery = async (query, parameters = []) => {
    try {
        const connection = await getConnection();
        const request = connection.request();
        
        // Agregar parámetros al request
        parameters.forEach(param => {
            request.input(param.name, param.type, param.value);
        });
        
        const result = await request.query(query);
        return result;
    } catch (error) {
        console.error('Error ejecutando consulta:', error);
        throw error;
    }
};

// NUEVOS MÉTODOS PARA TRANSACCIONES

// Inicia una transacción y devuelve el objeto de conexión/transacción
exports.beginTransaction = async () => {
    try {
        const connection = await getConnection();
        const transaction = new sql.Transaction(connection);
        await transaction.begin();
        console.log('Transacción iniciada.');
        return transaction;
    } catch (error) {
        console.error('Error al iniciar transacción:', error);
        throw error;
    }
};

// Ejecuta un procedimiento dentro de una transacción existente
exports.executeProcedureInTransaction = async (transaction, procedureName, parameters = []) => {
    try {
        const request = new sql.Request(transaction);
        
        // Agregar parámetros al request
        parameters.forEach(param => {
            request.input(param.name, param.type, param.value);
        });
        
        const result = await request.execute(procedureName);
        return result;
    } catch (error) {
        console.error(`Error ejecutando procedimiento ${procedureName} en transacción:`, error);
        throw error;
    }
};

// Ejecuta una consulta SQL directa dentro de una transacción existente
exports.executeQueryInTransaction = async (transaction, query, parameters = []) => {
    try {
        const request = new sql.Request(transaction);
        
        // Agregar parámetros al request
        parameters.forEach(param => {
            request.input(param.name, param.type, param.value);
        });
        
        const result = await request.query(query);
        return result;
    } catch (error) {
        console.error('Error ejecutando consulta en transacción:', error);
        throw error;
    }
};

// Confirma la transacción
exports.commitTransaction = async (transaction) => {
    try {
        await transaction.commit();
        console.log('Transacción confirmada.');
    } catch (error) {
        console.error('Error al confirmar transacción:', error);
        throw error;
    }
};

// Revierte la transacción
exports.rollbackTransaction = async (transaction) => {
    try {
        await transaction.rollback();
        console.log('Transacción revertida.');
    } catch (error) {
        console.error('Error al revertir transacción:', error);
        throw error;
    }
}; 