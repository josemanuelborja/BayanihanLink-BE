// Routes for submitting a request and fetching requests back.
// Matches the wizard in RequestAssistanceScreen.kt and the lists shown in
// MyRequestsScreen.kt, HomeScreen.kt, and RequestDetailsScreen.kt.

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Request = require("../models/Request");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { requireAuth, requireAdmin, requireOwnerOrAdmin } = require("../middleware/auth");

const router = express.Router();

// Where the uploaded pictures are saved. "uploads" sits next to server.js.
const UPLOADS_FOLDER = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOADS_FOLDER)) {
  fs.mkdirSync(UPLOADS_FOLDER);
}

// multer looks after saving the file the app sent. We give every picture a
// random name so two uploads never overwrite each other.
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOADS_FOLDER);
    },
    filename: function (req, file, cb) {
      const extension = path.extname(file.originalname) || ".jpg";
      cb(null, "evidence-" + Date.now() + "-" + Math.round(Math.random() * 100000) + extension);
    }
  }),
  // Only allow small image files, so nobody can upload a huge video.
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  }
});

// Turns a Request document into the shape the Android app expects.
function toSafeRequest(request) {
  const categories = request.categories && request.categories.length > 0
    ? request.categories
    : (request.category ? [request.category] : []);

  return {
    id: request._id,
    userId: request.userId,
    disasterType: request.disasterType,
    category: request.category || categories[0] || "",
    categories: categories,
    itemNeeded: request.itemNeeded,
    quantity: request.quantity,
    unit: request.unit,
    description: request.description || "",
    personsAffected: request.personsAffected,
    location: request.location || "",
    // Just the file name. The app adds the full address
    // (e.g. http://10.0.2.2:3000/uploads/...) when it shows the picture.
    evidenceImage: request.evidenceImage || "",
    urgency: request.urgency,
    status: request.status,
    currentTimelineStep: request.currentTimelineStep,
    dateSubmitted: request.createdAt
  };
}

// POST /api/requests
// This one accepts multipart/form-data because the app may send a picture of
// the disaster as proof. The picture arrives as "evidenceImage"; everything
// else arrives as normal text fields.
//
// If no picture is sent, evidenceImage is just "" and everything still works.
router.post("/", upload.single("evidenceImage"), async (req, res) => {
  try {
    const {
      userId, disasterType, category, categories, itemNeeded,
      quantity, unit, description, personsAffected, location
    } = req.body;

    if (!userId || !disasterType || !itemNeeded || !quantity || !unit || !personsAffected) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    let categoryList = [];
    if (Array.isArray(categories)) {
      categoryList = categories.filter(Boolean);
    } else if (typeof categories === "string") {
      try {
        const parsed = JSON.parse(categories);
        if (Array.isArray(parsed)) {
          categoryList = parsed.filter(Boolean);
        } else if (parsed) {
          categoryList = [parsed];
        }
      } catch (e) {
        categoryList = categories.split(",").map(c => c.trim()).filter(Boolean);
      }
    }
    if (categoryList.length === 0 && category) {
      categoryList = [category];
    }
    if (categoryList.length === 0) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // Verify user exists and is verified
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (!user.isVerified) {
      return res.status(403).json({ error: "Please verify your email before submitting a request." });
    }

    const newRequest = await Request.create({
      userId,
      disasterType,
      category: categoryList[0],
      categories: categoryList,
      itemNeeded,
      quantity,
      unit,
      description: description || "",
      personsAffected: Number(personsAffected),
      location: location || user.address || "",
      // multer already saved the picture and gave us its file name.
      evidenceImage: req.file ? req.file.filename : "",
      // urgency, status, and currentTimelineStep all use their defaults
      // (NORMAL, PENDING, 1) — an administrator would update these later.
    });

    try {
      await Notification.create({
        userId: user._id,
        type: "REQUEST_SUBMITTED",
        title: "Request Submitted",
        message: "Your assistance request has been submitted and is pending verification.",
        requestId: newRequest._id,
        contentType: "REQUEST",
        targetId: newRequest._id.toString()
      });
    } catch (e) {
      console.error("Failed to create notification:", e.message);
    }

    res.status(201).json(toSafeRequest(newRequest));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while submitting the request." });
  }
});

// GET /api/requests
// Returns all requests (for donor needs board). Can filter by status.
router.get("/", async (req, res) => {
  try {
    const { status, urgency } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (urgency) filter.urgency = urgency;
    const requests = await Request.find(filter).sort({ createdAt: -1 });
    res.json(requests.map(toSafeRequest));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching requests." });
  }
});

// GET /api/requests/user/:userId
// Returns every request a specific user has submitted, NEWEST FIRST
// (this is what "My Requests" and the Home screen's stats are built from).
router.get("/user/:userId", async (req, res) => {
  try {
    const requests = await Request.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(requests.map(toSafeRequest));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching requests." });
  }
});

// GET /api/requests/:id
// Returns one request's full details (used by RequestDetailsScreen.kt).
router.get("/:id", async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: "Request not found." });
    }
    res.json(toSafeRequest(request));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching the request." });
  }
});

// PUT/PATCH /api/requests/:id/status - Admin updates request status/urgency/timeline
router.put("/:id/status", async (req, res) => {
  try {
    const { status, urgency, currentTimelineStep } = req.body;
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: "Request not found." });
    }

    if (status) request.status = status;
    if (urgency) request.urgency = urgency;
    if (currentTimelineStep !== undefined && currentTimelineStep !== null) {
      request.currentTimelineStep = Number(currentTimelineStep);
    }

    await request.save();

    try {
      let title = "Request Updated";
      let message = "Your request has been updated.";
      if (status === "VERIFIED") {
        title = "Request Verified";
        message = "Your request has been verified by the administrator and posted to the Needs Board.";
      } else if (status === "ASSISTED") {
        title = "Assistance Update";
        message = "Your request is now marked as assisted.";
      } else if (status === "COMPLETED") {
        title = "Request Completed";
        message = "Your request has been successfully completed.";
      }
      await Notification.create({
        userId: request.userId,
        type: "REQUEST_STATUS_UPDATE",
        title: title,
        message: message,
        requestId: request._id,
        contentType: "REQUEST",
        targetId: request._id.toString()
      });
    } catch (e) {
      console.error("Failed to create notification:", e.message);
    }

    res.json(toSafeRequest(request));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating the request." });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status, urgency, currentTimelineStep } = req.body;
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: "Request not found." });
    }

    if (status) request.status = status;
    if (urgency) request.urgency = urgency;
    if (currentTimelineStep !== undefined && currentTimelineStep !== null) {
      request.currentTimelineStep = Number(currentTimelineStep);
    }

    await request.save();

    try {
      let title = "Request Updated";
      let message = "Your request has been updated.";
      if (status === "VERIFIED") {
        title = "Request Verified";
        message = "Your request has been verified by the administrator and posted to the Needs Board.";
      } else if (status === "ASSISTED") {
        title = "Assistance Update";
        message = "Your request is now marked as assisted.";
      } else if (status === "COMPLETED") {
        title = "Request Completed";
        message = "Your request has been successfully completed.";
      }
      await Notification.create({
        userId: request.userId,
        type: "REQUEST_STATUS_UPDATE",
        title: title,
        message: message,
        requestId: request._id,
        contentType: "REQUEST",
        targetId: request._id.toString()
      });
    } catch (e) {
      console.error("Failed to create notification:", e.message);
    }

    res.json(toSafeRequest(request));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating the request." });
  }
});

// GET /api/requests/images/:filename
// Lets anyone open one saved picture directly (used by the full-size preview).
router.get("/images/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_FOLDER, path.basename(req.params.filename));

  // path.basename stops someone asking for "../../server.js".
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Image not found." });
  }
  res.sendFile(filePath);
});

module.exports = router;