// Notification model

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, default: "" },
  title: { type: String, default: "" },
  message: { type: String, default: "" },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request" },
  offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer" },
  contentType: { type: String, default: "" },
  targetId: { type: String, default: "" },
  isRead: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model("Notification", notificationSchema);
