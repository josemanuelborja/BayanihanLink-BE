const crypto = require("crypto");
const User = require("../models/User");

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || req.headers["x-auth-token"] || req.body.authToken || req.query.authToken;
    const userId = req.headers["x-user-id"] || req.body.userId || req.query.userId;

    if (token) {
      const user = await User.findOne({ authToken: token });
      if (!user) {
        return res.status(401).json({ error: "Unauthorized." });
      }
      if (!user.isVerified) {
        return res.status(403).json({ error: "Please verify your email before accessing this feature." });
      }
      req.user = user;
      req.userId = user._id.toString();
      return next();
    }

    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized." });
      }
      if (!user.isVerified) {
        return res.status(403).json({ error: "Please verify your email before accessing this feature." });
      }
      req.user = user;
      req.userId = user._id.toString();
      return next();
    }

    return res.status(401).json({ error: "Unauthorized." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Authentication failed." });
  }
}

async function requireAdmin(req, res, next) {
  try {
    await requireAuth(req, res, () => {
      if (req.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin access required." });
      }
      next();
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Authorization failed." });
  }
}

function requireOwnerOrAdmin(getResourceUserId) {
  return async (req, res, next) => {
    try {
      await requireAuth(req, res, async () => {
        if (req.user.role === "ADMIN") {
          return next();
        }
        const resourceUserId = await getResourceUserId(req);
        if (!resourceUserId || resourceUserId.toString() !== req.userId) {
          return res.status(403).json({ error: "Forbidden." });
        }
        next();
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Authorization failed." });
    }
  };
}

module.exports = { generateToken, requireAuth, requireAdmin, requireOwnerOrAdmin };
