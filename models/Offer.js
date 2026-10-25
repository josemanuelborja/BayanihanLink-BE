const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true },
  quantityOffered: { type: String, required: true },
  unit: { type: String, default: "" },
  message: { type: String, default: "" },
  status: {
    type: String,
    enum: ["PENDING", "ACCEPTED", "REJECTED"],
    default: "PENDING"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Offer", offerSchema);
