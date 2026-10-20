
function createStorage(type = process.env.STORAGE_TYPE || 'json') {
  switch (type.toLowerCase()) {
    case 'json':
      return require('./json').createJSONStorage();

    case 'mongodb':
      return require('./mongodb').createMongoStorage();

    default:
      throw new Error(
        `STORAGE_TYPE no válido: ${type}. Usa json o mongodb.`,
      );
  }
}

module.exports = { createStorage };
