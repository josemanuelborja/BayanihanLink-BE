// This describes one "assistance request" — matches what the Request
// Assistance wizard in the app collects, plus a status the admin updates later.

const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  // Which user submitted this request. "ref: 'User'" lets us later fetch
  // the full user info if we need it (like Mongoose's version of a JOIN).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  disasterType: { type: String, required: true },   // "Flood", "Typhoon", "Fire", "Earthquake", "Other"
  category: { type: String, required: true },        // "Food", "Drinking Water", "Medicine", etc.
  itemNeeded: { type: String, required: true },       // e.g. "Rice (5kg sacks)"
  quantity: { type: String, required: true },         // e.g. "10"
  unit: { type: String, required: true },             // e.g. "packs"
  description: { type: String, default: "" },
  personsAffected: { type: Number, required: true },

  // The picture the citizen uploaded as proof of the disaster. We only store
  // the filename (e.g. "evidence-1712345.jpg"), not the whole path, and the
  // app builds the full URL from it.
  evidenceImage: { type: String, default: "" },

  urgency: {
    type: String,
    enum: ["NORMAL", "URGENT", "CRITICAL"],
    default: "NORMAL"
  },

  // What stage this request is at. Matches RequestStatus in MyRequestsScreen.kt.
  status: {
    type: String,
    enum: ["PENDING", "VERIFIED", "ASSISTED", "COMPLETED"],
    default: "PENDING"
  },

  // Matches the 6-step timeline in RequestDetailsScreen.kt:
  // 1 = Submitted, 2 = Pending Verification, 3 = Verified,
  // 4 = Assistance Offered, 5 = Assisted, 6 = Completed.
  currentTimelineStep: { type: Number, default: 1 }
}, {
  timestamps: true // adds "createdAt" automatically — this is what "Date Submitted" shows
});

module.exports = mongoose.model("Request", requestSchema);