// Offer model

const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  referenceNo: { type: String, unique: true, sparse: true },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true },
  quantityOffered: { type: String, required: true },
  unit: { type: String, default: "" },
  message: { type: String, default: "" },
  status: { type: String, enum: ["PENDING", "ACCEPTED", "REJECTED"], default: "PENDING" },
  // DSWD's external assessment, saved by the DSWD portal.
  dswdDisasterEligibility: { type: String, default: "Pending" },
  dswdRequestedItemsAssessment: { type: String, default: "Pending" },
  dswdDonatedItemsAssessment: { type: String, default: "Pending" },
  dswdSuggestedDestination: { type: String, default: "" },
  dswdNotes: { type: String, default: "" }
}, {
  timestamps: true
});

module.exports = mongoose.model("Offer", offerSchema);
