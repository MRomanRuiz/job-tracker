const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI);

let db;

async function connectDB() {
  await client.connect();

  db = client.db(process.env.MONGODB_DB);

  console.info('Conectado a MongoDB Atlas');

  return db;
}

function getDB() {
  if (!db) {
    throw new Error('MongoDB no está conectado');
  }

  return db;
}

async function closeDB() {
  await client.close();
  db = null;
}

module.exports = { connectDB, getDB, closeDB };
