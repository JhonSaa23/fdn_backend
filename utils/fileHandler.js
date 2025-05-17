const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Asegurarse que el directorio de uploads existe
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento para archivos subidos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Crear un nombre único para evitar conflictos
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Función para filtrar tipos de archivos permitidos
const fileFilter = (req, file, cb) => {
  // Verificar por extensión en lugar de mimetype que puede ser inconsistente
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.xls', '.xlsx', '.csv', '.dbf'];

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Solo se permiten archivos Excel (xls, xlsx), CSV y DBF. Recibido: ${ext}`), false);
  }
};

// Crear el middleware de multer
const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // Límite aumentado a 50MB
});

module.exports = { upload }; 