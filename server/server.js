const { createApp } = require('./app');

const PORT = 3001;

createApp().listen(PORT, () => {
  console.info(`Servidor funcionando en http://localhost:${PORT}`);
});
