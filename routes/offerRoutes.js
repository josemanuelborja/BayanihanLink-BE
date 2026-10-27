const express = require("express");
const Offer = require("../models/Offer");
const Request = require("../models/Request");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { requireAuth, requireAdminOrOfficer } = require("../middleware/auth");
const { nextReference } = require("../utils/references");
const { notifyAdmins, notifyUser } = require("../utils/adminNotifications");

const router = express.Router();

// Adds the readable IDs and donor/request names to an offer.
function toSafeOffer(offer) {
  const donor = offer.donorId && offer.donorId.fullName ? offer.donorId : null;
  const request = offer.requestId && offer.requestId.referenceNo !== undefined ? offer.requestId : null;

  return {
    _id: offer._id,
    referenceNo: offer.referenceNo || "",
    donorId: donor ? donor._id : offer.donorId,
    donorName: donor ? donor.fullName : "",
    requestId: request ? request._id : offer.requestId,
    requestReferenceNo: request ? request.referenceNo : "",
    requestItem: request ? request.itemNeeded : "",
    requestQuantity: request ? request.quantity : "",
    requestUnit: request ? request.unit : "",
    requestDisasterType: request ? request.disasterType : "",
    requestUrgency: request ? request.urgency : "",
    requestPersonsAffected: request ? request.personsAffected : 0,
    requestLocation: request ? request.location : "",
    quantityOffered: offer.quantityOffered,
    unit: offer.unit,
    message: offer.message,
    status: offer.status,
    dswdDisasterEligibility: offer.dswdDisasterEligibility || "Pending",
    dswdRequestedItemsAssessment: offer.dswdRequestedItemsAssessment || "Pending",
    dswdDonatedItemsAssessment: offer.dswdDonatedItemsAssessment || "Pending",
    dswdSuggestedDestination: offer.dswdSuggestedDestination || "",
    dswdNotes: offer.dswdNotes || "",
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt
  };
}

// Get all offers for admin and DSWD officers
router.get("/admin/all", requireAdminOrOfficer, async (req, res) => {
  try {
    const offers = await Offer.find()
      .sort({ createdAt: -1 })
      .populate("donorId", "fullName")
      .populate(
        "requestId",
        "referenceNo itemNeeded quantity unit disasterType urgency personsAffected location"
      );
    res.json(offers.map(toSafeOffer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching offers." });
  }
});

// Save the DSWD officer's external assessment for one offer.
router.put("/:id/dswd-assessment", requireAdminOrOfficer, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid offer id." });
    }

    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found." });
    }

    const {
      disasterEligibility,
      requestedItemsAssessment,
      donatedItemsAssessment,
      suggestedDestination,
      notes
    } = req.body;

    if (disasterEligibility) offer.dswdDisasterEligibility = disasterEligibility;
    if (requestedItemsAssessment) offer.dswdRequestedItemsAssessment = requestedItemsAssessment;
    if (donatedItemsAssessment) offer.dswdDonatedItemsAssessment = donatedItemsAssessment;
    if (suggestedDestination !== undefined) offer.dswdSuggestedDestination = suggestedDestination;
    if (notes !== undefined) offer.dswdNotes = notes;

    // Keep the offer workflow status in sync with the DSWD decision.
    if (donatedItemsAssessment === "Not confirmed") {
      offer.status = "REJECTED";
    } else if (
      donatedItemsAssessment === "Confirmed" &&
      (disasterEligibility === "Confirmed" || !disasterEligibility) &&
      (requestedItemsAssessment === "Confirmed" || !requestedItemsAssessment)
    ) {
      offer.status = "ACCEPTED";
    }

    await offer.save();

    // Tell the Admins that the DSWD assessment was recorded.
    await notifyAdmins({
      type: "DSWD_ASSESSMENT_SAVED",
      title: "DSWD assessment saved",
      message: `Assessment for offer #${offer.referenceNo || offer._id} was saved by ${req.user.fullName}.`,
      requestId: offer.requestId,
      offerId: offer._id,
      contentType: "OFFER",
      targetId: offer._id.toString()
    });

    const populated = await Offer.findById(offer._id)
      .populate("donorId", "fullName")
      .populate(
        "requestId",
        "referenceNo itemNeeded quantity unit disasterType urgency personsAffected location"
      );

    res.json(toSafeOffer(populated));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while saving the DSWD assessment." });
  }
});

// Create offer
router.post("/", requireAuth, async (req, res) => {
  try {
    const { donorId, requestId, quantityOffered, unit, message } = req.body;
    if (!donorId || !requestId || !quantityOffered) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (req.userId !== donorId.toString()) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const donor = req.user;
    if (donor.accountType !== "DONOR_VOLUNTEER") {
      return res.status(403).json({ error: "Only donors/volunteers can offer assistance." });
    }

    if (!requestId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid request id." });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found." });
    }

    const offer = await Offer.create({
      referenceNo: await nextReference("offer", "DO"),
      donorId,
      requestId,
      quantityOffered,
      unit: unit || "",
      message: message || "",
      status: "PENDING"
    });

    try {
      await Notification.create({
        userId: request.userId,
        type: "OFFER_RECEIVED",
        title: "Assistance Offer Received",
        message: `A donor has offered assistance for your request.`,
        requestId: request._id,
        offerId: offer._id,
        contentType: "OFFER",
        targetId: offer._id.toString()
      });
    } catch (e) {
      console.error("Failed to create notification:", e.message);
    }

    // Tell every Admin that a new donation offer needs coordination.
    await notifyAdmins({
      type: "OFFER_SUBMITTED",
      title: "New donation offer",
      message: `Offer #${offer.referenceNo} from ${donor.fullName} is waiting for coordination.`,
      requestId: request._id,
      offerId: offer._id,
      contentType: "OFFER",
      targetId: offer._id.toString()
    });

    res.status(201).json(toSafeOffer(offer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while submitting the offer." });
  }
});

// Get offers by donor
router.get("/user/:userId", requireAuth, async (req, res) => {
  try {
    if (req.userId !== req.params.userId && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden." });
    }
    const offers = await Offer.find({ donorId: req.params.userId })
      .sort({ createdAt: -1 })
      .populate("requestId", "referenceNo itemNeeded location");
    res.json(offers.map(toSafeOffer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching offers." });
  }
});

// Get offers for a request
router.get("/request/:requestId", requireAuth, async (req, res) => {
  try {
    if (!req.params.requestId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid request id." });
    }
    const request = await Request.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found." });
    }
    if (req.userId !== request.userId.toString() && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden." });
    }
    const offers = await Offer.find({ requestId: req.params.requestId })
      .sort({ createdAt: -1 })
      .populate("donorId", "fullName");
    res.json(offers.map(toSafeOffer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching offers." });
  }
});

// Update offer status
router.put("/:id/status", requireAuth, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid offer id." });
    }
    const { status } = req.body;
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found." });
    }
    const request = await Request.findById(offer.requestId);
    const isOwner = request && request.userId.toString() === req.userId;
    const isAdmin = req.user.role === "ADMIN";
    const isOfficer = req.user.role === "OFFICER";
    if (!isOwner && !isAdmin && !isOfficer) {
      return res.status(403).json({ error: "Forbidden." });
    }
    if (status) offer.status = status;
    await offer.save();

    try {
      if (status === "ACCEPTED") {
        await Notification.create({
          userId: offer.donorId,
          type: "OFFER_ACCEPTED",
          title: "Offer Accepted",
          message: "Your assistance offer has been accepted.",
          requestId: offer.requestId,
          offerId: offer._id,
          contentType: "OFFER",
          targetId: offer._id.toString()
        });
      } else if (status === "REJECTED") {
        await Notification.create({
          userId: offer.donorId,
          type: "OFFER_REJECTED",
          title: "Offer Update",
          message: "Your assistance offer was not accepted at this time.",
          requestId: offer.requestId,
          offerId: offer._id,
          contentType: "OFFER",
          targetId: offer._id.toString()
        });
      }
    } catch (e) {
      console.error("Failed to create notification:", e.message);
    }

    // Record the Admin's own change for the Admin notification bell.
    if (req.user.role === "ADMIN") {
      await notifyUser(req.userId, {
        type: "OFFER_STATUS_UPDATE",
        title: "Offer status updated",
        message: `Offer #${offer.referenceNo || offer._id} is now ${offer.status}.`,
        requestId: offer.requestId,
        offerId: offer._id,
        contentType: "OFFER",
        targetId: offer._id.toString()
      });
    }

    res.json(toSafeOffer(offer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating the offer." });
  }
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid offer id." });
    }
    const { status } = req.body;
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found." });
    }
    const request = await Request.findById(offer.requestId);
    const isOwner = request && request.userId.toString() === req.userId;
    const isAdmin = req.user.role === "ADMIN";
    const isOfficer = req.user.role === "OFFICER";
    if (!isOwner && !isAdmin && !isOfficer) {
      return res.status(403).json({ error: "Forbidden." });
    }
    if (status) offer.status = status;
    await offer.save();

    try {
      if (status === "ACCEPTED") {
        await Notification.create({
          userId: offer.donorId,
          type: "OFFER_ACCEPTED",
          title: "Offer Accepted",
          message: "Your assistance offer has been accepted.",
          requestId: offer.requestId,
          offerId: offer._id,
          contentType: "OFFER",
          targetId: offer._id.toString()
        });
      } else if (status === "REJECTED") {
        await Notification.create({
          userId: offer.donorId,
          type: "OFFER_REJECTED",
          title: "Offer Update",
          message: "Your assistance offer was not accepted at this time.",
          requestId: offer.requestId,
          offerId: offer._id,
          contentType: "OFFER",
          targetId: offer._id.toString()
        });
      }
    } catch (e) {
      console.error("Failed to create notification:", e.message);
    }

    // Record the Admin's own change for the Admin notification bell.
    if (req.user.role === "ADMIN") {
      await notifyUser(req.userId, {
        type: "OFFER_STATUS_UPDATE",
        title: "Offer status updated",
        message: `Offer #${offer.referenceNo || offer._id} is now ${offer.status}.`,
        requestId: offer.requestId,
        offerId: offer._id,
        contentType: "OFFER",
        targetId: offer._id.toString()
      });
    }

    res.json(toSafeOffer(offer));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating the offer." });
  }
});

module.exports = router;
