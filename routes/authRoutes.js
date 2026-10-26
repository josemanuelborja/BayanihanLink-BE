// Auth routes

const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const { generateToken } = require("../middleware/auth");

const router = express.Router();

const resetCodes = new Map();
const CODE_EXPIRY_MS = 10 * 60 * 1000;

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || ""
  }
});

function toSafeUser(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    contactNumber: user.contactNumber,
    address: user.address,
    accountType: user.accountType,
    isVerified: !!user.isVerified,
    role: user.role || "USER",
    authToken: user.authToken || ""
  };
}

function buildVerifyLink(user) {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  return baseUrl + "/api/auth/verify-email?token=" + user.verificationToken;
}

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, contactNumber, address, accountType } = req.body;
    if (!fullName || !email || !password || !contactNumber || !address || !accountType) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(24).toString("hex");
    const authToken = generateToken();

    const user = await User.create({
      fullName,
      email,
      passwordHash,
      contactNumber,
      address,
      accountType,
      isVerified: false,
      verificationToken,
      authToken,
      role: "USER"
    });

    const link = buildVerifyLink(user);
    try {
      await mailTransporter.sendMail({
        from: process.env.SMTP_USER || "no-reply@bayanihanlink.com",
        to: user.email,
        subject: "Verify your BayanihanLink account",
        text: "Welcome! Please verify your account by opening this link:\n\n" + link,
        html: "<div style='font-family: Arial, sans-serif; padding: 20px;'><h2>Welcome to BayanihanLink!</h2><p>Please verify your account by clicking the link below:</p><a href='" + link + "' style='display: inline-block; padding: 10px 20px; background-color: #2B49CC; color: white; text-decoration: none; border-radius: 5px;'>Verify Email</a><p>Or paste this link into your browser:</p><p><a href='" + link + "'>" + link + "</a></p></div>"
      });
      console.log("Verification email successfully sent to " + user.email);
    } catch (e) {
      console.error("Could not send verification email:", e.message);
      console.log("Fallback verification link:");
      console.log(link);
    }

    res.status(201).json(toSafeUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while creating the account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Please verify your email before logging in." });
    }

    if (!user.authToken) {
      user.authToken = generateToken();
      await user.save();
    }

    res.json(toSafeUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while logging in." });
  }
});

router.post("/change-password", async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Invalid user id." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.authToken = generateToken();
    await user.save();

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while changing the password." });
  }
});

router.post("/send-reset-code", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Please enter your email." });
    }

    const user = await User.findOne({ email: email.trim() });
    if (!user) {
      return res.status(404).json({ error: "No account found with that email." });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    resetCodes.set(user.email, { code, expiresAt: Date.now() + CODE_EXPIRY_MS });

    try {
      await mailTransporter.sendMail({
        from: process.env.SMTP_USER || "no-reply@bayanihanlink.com",
        to: user.email,
        subject: "BayanihanLink password reset code",
        text: "Your BayanihanLink verification code is: " + code
      });
      console.log("Reset code sent to " + user.email);
    } catch (e) {
      console.log("Could not send email. Code:");
      console.log(code);
    }

    res.json({ message: "Code sent." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while sending the code." });
  }
});

router.get("/verify-email", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token || typeof token !== "string" || token.trim() === "") {
      return res.status(400).send("Missing verification token.");
    }

    const user = await User.findOne({ verificationToken: token.trim() });
    if (!user) {
      return res.status(404).send("This verification link is not valid or has already been used.");
    }

    user.isVerified = true;
    user.verificationToken = "";
    if (!user.authToken) user.authToken = generateToken();
    await user.save();

    res.send("<h2>Email verified!</h2><p>You can now log in to the app.</p>");
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong while verifying the email.");
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    const token = req.query.token || req.body.token;
    if (!token || typeof token !== "string" || token.trim() === "") {
      return res.status(400).json({ error: "Missing verification token." });
    }

    const user = await User.findOne({ verificationToken: token.trim() });
    if (!user) {
      return res.status(404).json({ error: "This verification link is not valid or has already been used." });
    }

    user.isVerified = true;
    user.verificationToken = "";
    if (!user.authToken) user.authToken = generateToken();
    await user.save();

    res.json({ message: "Email verified successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while verifying the email." });
  }
});

router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Please enter the code." });
    }

    const saved = resetCodes.get(email.trim());
    if (!saved) return res.status(400).json({ error: "Please request a new code." });
    if (Date.now() > saved.expiresAt) {
      resetCodes.delete(email.trim());
      return res.status(400).json({ error: "That code has expired. Please request a new one." });
    }
    if (saved.code !== String(code).trim()) {
      return res.status(400).json({ error: "That code is incorrect." });
    }

    res.json({ message: "Code verified." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while checking the code." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    const saved = resetCodes.get(email.trim());
    if (!saved || Date.now() > saved.expiresAt || saved.code !== String(code).trim()) {
      return res.status(400).json({ error: "That code is incorrect or has expired." });
    }

    const user = await User.findOne({ email: email.trim() });
    if (!user) return res.status(404).json({ error: "No account found with that email." });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.authToken = generateToken();
    await user.save();
    resetCodes.delete(email.trim());

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while resetting the password." });
  }
});

module.exports = router;