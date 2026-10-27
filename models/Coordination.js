// Coordination model
// One coordination record belongs to one donation offer of one request.
// The admin records the DSWD confirmation status and the administrator notes here.

const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  id: { type: String, required: true },
  author: { type: String, default: "App Admin" },
  authorRole: { type: String, default: "Administrator" },
  time: { type: String, default: "" },
  text: { type: String, required: true }
}, { _id: false });

const coordinationSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null },
  selectedStatus: { type: String, default: "Awaiting DSWD Confirmation" },
  notes: { type: [noteSchema], default: [] }
}, {
  timestamps: true
});

// A request can have many offers, so the pair (request + offer) is the unique key.
coordinationSchema.index({ requestId: 1, offerId: 1 }, { unique: true });

module.exports = mongoose.model("Coordination", coordinationSchema);
