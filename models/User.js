// User model

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  contactNumber: { type: String, required: true },
  address: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String, default: "" },
  authToken: { type: String, default: "" },
  role: { type: String, enum: ["USER", "ADMIN", "OFFICER"], default: "USER" },
  accountType: { type: String, enum: ["AFFECTED_INDIVIDUAL", "DONOR_VOLUNTEER"], required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);