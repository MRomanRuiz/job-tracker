const { getDB } = require('../db');
const { prepareRecordUpdate } = require('../domain/recordHistory');

const toPublicRecord = record => {
  const publicRecord = { ...record };
  delete publicRecord._id;
  delete publicRecord._storageRevision;
  return publicRecord;
};

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

async function updateWithHistory(name, id, changes, conditions = {}) {
  const collection = getDB().collection(name);
  const numericId = Number(id);
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await collection.findOne({
      id: numericId,
      ...conditions,
    });

    if (!current) {
      return null;
    }

    const updated = prepareRecordUpdate(current, changes);

    if (updated === current) {
      return toPublicRecord(current);
    }

    const filter = {
      _id: current._id,
      _storageRevision: Object.hasOwn(current, '_storageRevision')
        ? current._storageRevision
        : { $exists: false },
    };

    const currentRevision = current._storageRevision ?? 0;
    if (!Number.isSafeInteger(currentRevision) || currentRevision < 0) {
      throw new Error(`Revisión interna no válida para ${name} con id ${numericId}`);
    }

    const replacement = { ...updated };
    delete replacement._id;
    replacement._storageRevision = currentRevision + 1;

    const result = await collection.replaceOne(filter, replacement);

    if (result.matchedCount === 1) {
      return toPublicRecord(replacement);
    }
  }

  throw new Error(`Could not update ${name} with id ${numericId} due to concurrent changes`);
}

function createMongoStorage() {
  return {
    async list(name) {
      return getDB()
        .collection(name)
        .find({}, { projection: { _id: 0, _storageRevision: 0 } })
        .toArray();
    },

    async getById(name, id) {
      return getDB()
        .collection(name)
        .findOne({ id: Number(id) }, { projection: { _id: 0, _storageRevision: 0 } });
    },

    async create(name, record) {
      const db = getDB();
      const now = new Date().toISOString();
      const newRecord = {
        ...record,
        id: await generateId(db, name),
        updatedAt: now,
        history: [],
        _storageRevision: 0,
      };

      await db.collection(name).insertOne(newRecord);

      return toPublicRecord(newRecord);
    },

    async update(name, id, changes) {
      return updateWithHistory(name, id, changes);
    },

    async updatePending(name, id, dateField, date, changes) {
      return updateWithHistory(name, id, changes, {
        status: 'pending',
        [dateField]: date,
      });
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
