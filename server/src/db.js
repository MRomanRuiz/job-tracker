const { MongoClient } = require('mongodb');

const { MONGODB_URI, MONGODB_DB } = process.env;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (!MONGODB_DB) {
  throw new Error('MONGODB_DB environment variable is required');
}

const client = new MongoClient(MONGODB_URI);

let db;

const connectDB = async () => {
  if (db) {
    return db;
  }

  await client.connect();

  db = client.db(MONGODB_DB);

  console.info('Connected to MongoDB Atlas');

  return db;
};

const getDB = () => {
  if (!db) {
    throw new Error('MongoDB is not connected');
  }

  return db;
};

const closeDB = async () => {
  if (!db) {
    return;
  }

  await client.close();
  db = null;
};

module.exports = { connectDB, getDB, closeDB };
