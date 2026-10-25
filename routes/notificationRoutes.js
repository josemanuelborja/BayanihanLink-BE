const express = require("express");
const Notification = require("../models/Notification");

const router = express.Router();

// Get notifications by user
router.get("/user/:userId", async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching notifications." });
  }
});

// Mark notification as read
router.put("/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found." });
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
router.put("/user/:userId/read-all", async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.params.userId }, { isRead: true });
    res.json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while updating notifications." });
  }
});

module.exports = router;
