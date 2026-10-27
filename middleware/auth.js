// Simple auth helpers

const crypto = require("crypto");
const User = require("../models/User");

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : (req.headers["x-auth-token"] || req.body.authToken || req.query.authToken);
    const userId = req.headers["x-user-id"] || req.body.userId || req.query.userId;

    let user = null;
    if (token) {
      user = await User.findOne({ authToken: token });
    } else if (userId) {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    if (!user.isVerified) {
      return res.status(403).json({ error: "Please verify your email before accessing this feature." });
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Authentication failed." });
  }
}

async function requireAdmin(req, res, next) {
  try {
    requireAuth(req, res, () => {
      if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin access required." });
      }
      next();
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Authorization failed." });
  }
}

async function requireAdminOrOfficer(req, res, next) {
  try {
    requireAuth(req, res, () => {
      if (!req.user || (req.user.role !== "ADMIN" && req.user.role !== "OFFICER")) {
        return res.status(403).json({ error: "Admin or DSWD officer access required." });
      }
      next();
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Authorization failed." });
  }
}

module.exports = { generateToken, requireAuth, requireAdmin, requireAdminOrOfficer };
