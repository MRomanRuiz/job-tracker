function createStorage(type = process.env.STORAGE_TYPE || 'json') {
  if (typeof type !== 'string' || !type.trim()) {
    throw new TypeError('STORAGE_TYPE must be "json" or "mongodb".');
  }

  switch (type) {
    case 'json':
      return require('./json').createJSONStorage();

    case 'mongodb':
      return require('./mongodb').createMongoStorage();

    default:
      throw new Error(`Unsupported STORAGE_TYPE "${type}". Use "json" or "mongodb".`);
  }
}

module.exports = { createStorage };
