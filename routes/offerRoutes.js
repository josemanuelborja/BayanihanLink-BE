const express = require("express");
const Offer = require("../models/Offer");
const Request = require("../models/Request");
const User = require("../models/User");
const Notification = require("../models/Notification");

const router = express.Router();

// Create offer
router.post("/", async (req, res) => {
  try {
    const { donorId, requestId, quantityOffered, unit, message } = req.body;
    if (!donorId || !requestId || !quantityOffered) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const donor = await User.findById(donorId);
    if (!donor) {
      return res.status(404).json({ error: "User not found." });
    }
    if (!donor.isVerified) {
      return res.status(403).json({ error: "Please verify your email before offering assistance." });
    }
    if (donor.accountType !== "DONOR_VOLUNTEER") {
      return res.status(403).json({ error: "Only donors/volunteers can offer assistance." });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found." });
    }

    const offer = await Offer.create({
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

    res.status(201).json(offer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while submitting the offer." });
  }
});

// Get offers by donor
router.get("/user/:userId", async (req, res) => {
  try {
    const offers = await Offer.find({ donorId: req.params.userId }).sort({ createdAt: -1 });
    res.json(offers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching offers." });
  }
});

// Get offers for a request
router.get("/request/:requestId", async (req, res) => {
  try {
    const offers = await Offer.find({ requestId: req.params.requestId }).sort({ createdAt: -1 });
    res.json(offers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching offers." });
  }
});

// Update offer status
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found." });
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

    res.json(offer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating the offer." });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: "Offer not found." });
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

    res.json(offer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating the offer." });
  }
});

module.exports = router;
