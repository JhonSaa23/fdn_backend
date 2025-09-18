require('dotenv').config();
const { getConnection } = require('../database');

async function asignarPermisosLetras() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    const pool = await getConnection();
    console.log('✅ Conexión establecida');

    // 1. Obtener el ID de la vista de letras
    console.log('📋 Obteniendo ID de la vista de letras...');
    const vistaResult = await pool.request()
      .query("SELECT ID FROM VistasSistema WHERE Ruta = '/letras'");
    
    if (vistaResult.recordset.length === 0) {
      console.error('❌ No se encontró la vista de letras en VistasSistema');
      return;
    }
    
    const vistaId = vistaResult.recordset[0].ID;
    console.log(`✅ Vista de letras encontrada con ID: ${vistaId}`);

    // 2. Obtener todos los usuarios
    console.log('👥 Obteniendo lista de usuarios...');
    const usuariosResult = await pool.request()
      .query("SELECT IDUS FROM UsersSystems WHERE Activo = 1");
    
    console.log(`✅ Encontrados ${usuariosResult.recordset.length} usuarios activos`);

    // 3. Asignar permisos a todos los usuarios
    console.log('🔐 Asignando permisos de letras a todos los usuarios...');
    
    for (const usuario of usuariosResult.recordset) {
      try {
        // Verificar si ya tiene el permiso
        const permisoExistente = await pool.request()
          .input('IDUS', usuario.IDUS)
          .input('IDVista', vistaId)
          .query("SELECT COUNT(*) as count FROM PermisosVista WHERE IDUS = @IDUS AND IDVista = @IDVista");
        
        if (permisoExistente.recordset[0].count > 0) {
          console.log(`⏭️  Usuario ${usuario.IDUS} ya tiene permisos para letras`);
          continue;
        }

        // Asignar el permiso
        await pool.request()
          .input('IDUS', usuario.IDUS)
          .input('IDVista', vistaId)
          .input('PuedeVer', 1)
          .input('PuedeEditar', 1)
          .input('PuedeEliminar', 0)
          .query(`
            INSERT INTO PermisosVista (IDUS, IDVista, PuedeVer, PuedeEditar, PuedeEliminar, FechaCreacion)
            VALUES (@IDUS, @IDVista, @PuedeVer, @PuedeEditar, @PuedeEliminar, GETDATE())
          `);
        
        console.log(`✅ Permisos asignados al usuario ${usuario.IDUS}`);
      } catch (error) {
        console.error(`❌ Error asignando permisos al usuario ${usuario.IDUS}:`, error.message);
      }
    }

    console.log('\n🎉 Proceso completado');
    console.log('📋 Todos los usuarios ahora tienen permisos para acceder a /letras');

  } catch (error) {
    console.error('❌ Error general:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  asignarPermisosLetras();
}

module.exports = { asignarPermisosLetras };
