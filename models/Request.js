// Request model

const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  disasterType: { type: String, required: true },
  category: { type: String, required: false },
  categories: { type: [String], default: [] },
  itemNeeded: { type: String, required: true },
  quantity: { type: String, required: true },
  unit: { type: String, required: true },
  description: { type: String, default: "" },
  personsAffected: { type: Number, required: true },
  location: { type: String, default: "" },
  evidenceImage: { type: String, default: "" },
  urgency: { type: String, enum: ["NORMAL", "URGENT", "CRITICAL"], default: "NORMAL" },
  status: { type: String, enum: ["PENDING", "VERIFIED", "ASSISTED", "COMPLETED"], default: "PENDING" },
  currentTimelineStep: { type: Number, default: 1 }
}, {
  timestamps: true
});

module.exports = mongoose.model("Request", requestSchema);