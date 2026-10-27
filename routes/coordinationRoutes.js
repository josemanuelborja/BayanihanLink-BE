// Routes for External Partner Coordination.
// A coordination record is stored for one donation offer of one request.
// Both status and administrator notes live in MongoDB, so they survive refreshes.

const express = require("express");
const Coordination = require("../models/Coordination");
const Offer = require("../models/Offer");
const { requireAuth } = require("../middleware/auth");
const { notifyUser } = require("../utils/adminNotifications");

const router = express.Router();

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const DEFAULT_STATUS = "Awaiting DSWD Confirmation";

function cleanId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isObjectId(value) {
  return OBJECT_ID.test(value);
}

// Notes can arrive as "undefined" / "none" in the URL, so treat those as "no offer".
function isMissingOffer(value) {
  return !value || value === "none" || value === "undefined" || value === "null";
}

function formatNote(note) {
  const time = note.time ? new Date(note.time) : null;
  return {
    id: note.id,
    author: note.author || "App Admin",
    authorRole: note.authorRole || "Administrator",
    time: time && !isNaN(time.getTime()) ? time.toISOString() : (note.time || ""),
    text: note.text || ""
  };
}

// Shapes the record exactly like the admin frontend expects.
function toResponse(coordination, requestId, offerId) {
  return {
    requestId: requestId || null,
    offerId: offerId || null,
    selectedStatus: coordination ? coordination.selectedStatus : DEFAULT_STATUS,
    notes: coordination ? coordination.notes.map(formatNote) : [],
    updatedAt: coordination ? coordination.updatedAt : null
  };
}

// Clean the notes list that comes from the frontend before saving it.
function cleanNotes(notes, user) {
  if (!Array.isArray(notes)) {
    return null;
  }

  const authorName = (user && user.fullName) || "App Admin";
  const authorRole = (user && user.role) || "ADMIN";

  return notes
    .filter(note => note && typeof note.text === "string" && note.text.trim())
    .map((note, index) => ({
      id: String(note.id || `${Date.now()}-${index}`),
      author: String(note.author || authorName),
      authorRole: String(note.authorRole || authorRole),
      time: String(note.time || new Date().toISOString()),
      text: note.text.trim().slice(0, 500)
    }));
}

// GET /api/coordination/:requestId
// GET /api/coordination/:requestId/:offerId
// Returns the saved record, or an empty record when nothing has been saved yet.
async function getCoordination(req, res) {
  try {
    const requestId = cleanId(req.params.requestId);
    const offerId = cleanId(req.params.offerId);

    if (!isObjectId(requestId)) {
      return res.status(400).json({ error: "A valid request id is required." });
    }

    // Only real database ids can be looked up.
    let coordination = null;
    if (isObjectId(requestId)) {
      const filter = { requestId };
      if (isObjectId(offerId)) {
        filter.offerId = offerId;
      }
      coordination = await Coordination.findOne(filter);
    }

    res.json(toResponse(coordination, requestId, isObjectId(offerId) ? offerId : null));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while loading the coordination record." });
  }
}

router.get("/:requestId", requireAuth, getCoordination);
router.get("/:requestId/:offerId", requireAuth, getCoordination);

// PUT /api/coordination/:requestId/:offerId
// Creates or updates the coordination record (status + notes).
router.put("/:requestId/:offerId", requireAuth, async (req, res) => {
  try {
    const requestId = cleanId(req.params.requestId);
    const offerId = cleanId(req.params.offerId);

    if (!isObjectId(requestId)) {
      return res.status(400).json({ error: "A valid request id is required." });
    }
    if (!isMissingOffer(offerId) && !isObjectId(offerId)) {
      return res.status(400).json({ error: "A valid offer id is required." });
    }

    let offer = null;
    if (!isMissingOffer(offerId)) {
      offer = await Offer.findById(offerId);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found." });
      }
    }

    const filter = { requestId, offerId: offer ? offer._id : null };
    let coordination = await Coordination.findOne(filter);

    if (!coordination) {
      coordination = new Coordination({
        requestId,
        offerId: offer ? offer._id : null,
        selectedStatus: DEFAULT_STATUS,
        notes: []
      });
    }

    const { selectedStatus, notes, noteText } = req.body || {};

    if (typeof selectedStatus === "string" && selectedStatus.trim()) {
      coordination.selectedStatus = selectedStatus.trim();
    }

    const cleanedNotes = cleanNotes(notes, req.user);
    if (cleanedNotes !== null) {
      coordination.notes = cleanedNotes;
    }

    // Also support adding a single note in one call.
    if (typeof noteText === "string" && noteText.trim()) {
      coordination.notes.push({
        id: `${Date.now()}`,
        author: (req.user && req.user.fullName) || "App Admin",
        authorRole: (req.user && req.user.role) || "ADMIN",
        time: new Date().toISOString(),
        text: noteText.trim().slice(0, 500)
      });
    }

    await coordination.save();

    // Record the saved change in the Admin notification bell.
    if (req.user.role === "ADMIN") {
      const label = offer && offer.referenceNo ? `offer #${offer.referenceNo}` : `request ${requestId}`;
      await notifyUser(req.userId, {
        type: "COORDINATION_SAVED",
        title: "Coordination record saved",
        message: `Coordination for ${label} was saved.`,
        requestId: coordination.requestId,
        offerId: coordination.offerId,
        contentType: "COORDINATION",
        targetId: coordination._id.toString()
      });
    }

    res.json(toResponse(coordination, requestId, offer ? String(offer._id) : null));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while saving the coordination record." });
  }
});

module.exports = router;
