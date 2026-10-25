const express = require("express");
const Notification = require("../models/Notification");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Get notifications by user
router.get("/user/:userId", requireAuth, async (req, res) => {
  try {
    if (req.userId !== req.params.userId && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden." });
    }
    const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching notifications." });
  }
});

// Mark notification as read
router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid notification id." });
    }
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found." });
    }
    if (req.userId !== notification.userId.toString() && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden." });
    }
    notification.isRead = true;
    await notification.save();
    res.json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating notification." });
  }
});

// Mark all notifications as read for user
router.put("/user/:userId/read-all", requireAuth, async (req, res) => {
  try {
    if (req.userId !== req.params.userId && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden." });
    }
    await Notification.updateMany({ userId: req.params.userId }, { isRead: true });
    res.json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating notifications." });
  }
});

module.exports = router;
