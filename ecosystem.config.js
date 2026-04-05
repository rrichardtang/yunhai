module.exports = {
  apps: [
    {
      name: 'travelplanner',
      script: 'src/server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3457
      }
    }
  ]
};
