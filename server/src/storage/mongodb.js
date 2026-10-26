const { getDB } = require('../db');

async function generateId(db, collectionName) {
  const collection = db.collection(collectionName);

  const lastRecord = await collection
    .find({})
    .sort({ id: -1 })
    .project({ _id: 0, id: 1 })
    .limit(1)
    .next();

  const maxExistingId = Number(lastRecord?.id) || 0;
  const counters = db.collection('_counters');

  await counters.updateOne(
    { _id: collectionName },
    { $max: { seq: maxExistingId } },
    { upsert: true },
  );

  const result = await counters.findOneAndUpdate(
    { _id: collectionName },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );

  return (result?.value ?? result).seq;
}

function createMongoStorage() {
  return {
    async list(name) {
      return getDB()
        .collection(name)
        .find({}, { projection: { _id: 0 } })
        .toArray();
    },

    async getById(name, id) {
      return getDB()
        .collection(name)
        .findOne({ id: Number(id) }, { projection: { _id: 0 } });
    },

    async create(name, record) {
      const db = getDB();
      const newRecord = {
        ...record,
        id: await generateId(db, name),
      };

      await db.collection(name).insertOne(newRecord);

      delete newRecord._id;
      return newRecord;
    },

    async update(name, id, changes) {
      const collection = getDB().collection(name);

      const result = await collection.updateOne({ id: Number(id) }, { $set: changes });

      if (result.matchedCount === 0) {
        return null;
      }

      return this.getById(name, id);
    },

    async updatePending(name, id, dateField, date, changes) {
      const collection = getDB().collection(name);

      const result = await collection.updateOne(
        {
          id: Number(id),
          status: 'pending',
          [dateField]: date,
        },
        { $set: changes },
      );

      if (result.matchedCount === 0) {
        return null;
      }

      return this.getById(name, id);
    },

    async delete(name, id) {
      const result = await getDB()
        .collection(name)
        .deleteOne({ id: Number(id) });

      return result.deletedCount === 1;
    },
  };
}

module.exports = { createMongoStorage };
