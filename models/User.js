// This file describes the "shape" of a User document in MongoDB.
// Mongoose uses this "schema" to know what fields a user has, and to
// check/validate the data before saving it.

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // unique = no two users can share an email
  passwordHash: { type: String, required: true }, // NEVER store the real password, only the hashed version
  contactNumber: { type: String, required: true },
  address: { type: String, required: true },

  // Email verification. A new account starts with isVerified = false and the
  // app sends them a link. Clicking the link flips this to true.
  isVerified: { type: Boolean, default: false },
  // The random token that goes in the verification link.
  verificationToken: { type: String, default: "" },

  // Simple auth token for API access (issued on login/register)
  authToken: { type: String, default: "" },

  // Role for authorization (admin can approve requests/offers)
  role: {
    type: String,
    enum: ["USER", "ADMIN"],
    default: "USER"
  },

  // Matches the two account types from the Register screen in the app.
  accountType: {
    type: String,
    enum: ["AFFECTED_INDIVIDUAL", "DONOR_VOLUNTEER"],
    required: true
  }
}, {
  timestamps: true // automatically adds "createdAt" and "updatedAt" fields
});

// "User" here becomes the MongoDB collection name "users" (Mongoose does this automatically).
module.exports = mongoose.model("User", userSchema);