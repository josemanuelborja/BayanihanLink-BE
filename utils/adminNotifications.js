// Small helpers for Admin activity notifications.
// They only add rows to the existing notifications collection.

const Notification = require("../models/Notification");
const User = require("../models/User");

// Send one notification to every Admin account.
async function notifyAdmins(data) {
  try {
    const admins = await User.find({ role: "ADMIN" }).select("_id");

    if (admins.length === 0) {
      return;
    }

    await Notification.insertMany(
      admins.map(admin => ({
        userId: admin._id,
        type: data.type || "ADMIN_ACTIVITY",
        title: data.title || "Admin activity",
        message: data.message || "",
        requestId: data.requestId,
        offerId: data.offerId,
        contentType: data.contentType || "",
        targetId: data.targetId || ""
      }))
    );
  } catch (error) {
    console.error("Failed to notify admins:", error.message);
  }
}

// Send one notification to a single user, usually the Admin who saved a change.
async function notifyUser(userId, data) {
  if (!userId) {
    return;
  }

  try {
    await Notification.create({
      userId,
      type: data.type || "ADMIN_ACTIVITY",
      title: data.title || "Admin activity",
      message: data.message || "",
      requestId: data.requestId,
      offerId: data.offerId,
      contentType: data.contentType || "",
      targetId: data.targetId || ""
    });
  } catch (error) {
    console.error("Failed to create notification:", error.message);
  }
}

module.exports = { notifyAdmins, notifyUser };
