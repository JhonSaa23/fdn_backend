// Script para verificar el formato exacto de una fecha

// Crear una fecha de prueba
const fecha = new Date('2025-04-30T00:00:00Z');
console.log('Fecha como objeto Date:', fecha);
console.log('String normal de fecha:', String(fecha));
console.log('JSON de fecha:', JSON.stringify(fecha));
console.log('Longitud string:', String(fecha).length);

// Convertir a formato YYYYMMDD
const yyyy = fecha.getUTCFullYear();
const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
const dd = String(fecha.getUTCDate()).padStart(2, '0');
const formato = `${yyyy}${mm}${dd}`;

console.log('\nFormato YYYYMMDD:', formato);
console.log('Longitud YYYYMMDD:', formato.length);

// Emular el formato que causa el error
const fechaString = 'Wed Apr 30 2025 19:00:00 GMT-0500 (hora estándar de Perú)';
console.log('\nFecha como string que causa error:', fechaString);
console.log('Longitud string error:', fechaString.length);

// Emular transformación
function formatearFecha(fecha) {
  // Extraer la fecha usando expresiones regulares
  const match = fecha.match(/\w+\s+(\w+)\s+(\d+)\s+(\d{4})/);
  if (match) {
    const mes = match[1];
    const dia = String(match[2]).padStart(2, '0');
    const año = match[3];
    
    // Mapeo de nombres de mes en inglés a números
    const meses = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
      'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    return `${año}${meses[mes]}${dia}`;
  }
  return fecha;
}

console.log('\nDespués de transformación:', formatearFecha(fechaString));
console.log('Longitud después de transformación:', formatearFecha(fechaString).length); 