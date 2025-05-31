// Script para probar la función formatearFecha
const formatearFecha = require('./routes/medifarma').formatearFecha;

// Probar con fecha en formato GMT string
const fechaGMT = 'Wed Apr 30 2025 19:00:00 GMT-0500 (hora estándar de Perú)';
console.log('Fecha original GMT:', fechaGMT);
console.log('Fecha formateada:', formatearFecha(fechaGMT));

// Probar con objeto Date
const fechaObj = new Date('2025-05-17T00:00:00.000Z');
console.log('\nFecha original Date:', fechaObj);
console.log('Fecha formateada:', formatearFecha(fechaObj));

// Probar con formato DD/MM/YYYY
const fechaSlash = '17/05/2025';
console.log('\nFecha original DD/MM/YYYY:', fechaSlash);
console.log('Fecha formateada:', formatearFecha(fechaSlash));

// Probar con formato YYYY-MM-DD
const fechaGuion = '2025-05-17';
console.log('\nFecha original YYYY-MM-DD:', fechaGuion);
console.log('Fecha formateada:', formatearFecha(fechaGuion));

// Probar con número Excel (43972 = 17/05/2025)
const fechaExcel = 45759; // Número de serie Excel para 17/05/2025
console.log('\nFecha original número Excel:', fechaExcel);
console.log('Fecha formateada:', formatearFecha(fechaExcel)); 