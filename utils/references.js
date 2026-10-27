// Human-readable references stored in MongoDB.
// Requests use BL-000001 and offers use DO-000001. The number is kept in a
// Counter document so it never changes and never repeats.

const Counter = require("../models/Counter");
const Request = require("../models/Request");
const Offer = require("../models/Offer");

async function nextReference(counterName, prefix) {
  const counter = await Counter.findByIdAndUpdate(
    counterName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return prefix + "-" + String(counter.seq).padStart(6, "0");
}

async function backfillModel(Model, counterName, prefix, firstNumber) {
  let counter = await Counter.findById(counterName);

  const missing = await Model.find({
    $or: [
      { referenceNo: { $exists: false } },
      { referenceNo: null },
      { referenceNo: "" }
    ]
  }).sort({ createdAt: 1 });

  if (missing.length === 0) {
    if (!counter) {
      // A new database starts its numbering at 1.
      await Counter.create({ _id: counterName, seq: 0 });
    }
    return;
  }

  // The existing sample data already used BL-000302 and DO-000085, so the
  // one-time backfill continues from just before those numbers.
  let seq = counter ? counter.seq : firstNumber;

  for (const document of missing) {
    seq += 1;
    document.referenceNo = prefix + "-" + String(seq).padStart(6, "0");
    await document.save();
    console.log("[references] " + document.referenceNo + " assigned");
  }

  await Counter.findByIdAndUpdate(counterName, { seq }, { upsert: true });
}

// Safe to run on every server start. It only touches records that do not have
// a reference yet, so already-saved IDs never change.
async function backfillReferences() {
  await backfillModel(Request, "request", "BL", 300);
  await backfillModel(Offer, "offer", "DO", 84);
}

module.exports = { nextReference, backfillReferences };
