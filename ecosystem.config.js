module.exports = {
  apps: [
    {
      name: 'dev-sifano',
      cwd: 'C:/Users/Farmacos/Desktop/Jhon/FSDINS/fdn_backend',
      // Ejecuta directamente node index.js
      script: 'node',
      args: 'index.js',
      // PM2 hará el “watch” de tus .js
      watch: true,
      ignore_watch: ['node_modules', '.git'],
      watch_delay: 1000,
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}
