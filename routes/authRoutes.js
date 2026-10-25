// Routes for creating an account and logging in.
// Matches the fields collected in RegisterScreen.kt and LoginScreen.kt.

const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const { generateToken } = require("../middleware/auth");

const router = express.Router();

// Simple place to keep the 6-digit codes while the user types them.
// A Map is just a list of key -> value pairs. It empties when the server
// restarts, which is fine for a school project.
const resetCodes = new Map();

// Code is only good for 10 minutes (10 * 60 * 60 * 1000 milliseconds).
const CODE_EXPIRY_MS = 10 * 60 * 1000;

// Email account used to send the codes. The settings come from ".env".
const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || ""
  }
});

// Turns a User document into safe data to send back to the app
// (removes passwordHash so we never accidentally leak it).
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

// Builds the link the user clicks to verify their email. We point it at the
// backend's own /verify page so clicking it works even before the Android
// app has been opened.
function buildVerificationLink(user) {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  return baseUrl + "/api/auth/verify-email?token=" + user.verificationToken;
}

// POST /api/auth/register
// Body: { fullName, email, password, contactNumber, address, accountType }
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, contactNumber, address, accountType } = req.body;

    if (!fullName || !email || !password || !contactNumber || !address || !accountType) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    // Hash the password before saving — "10" is how many times it scrambles
    // the password. Higher = more secure but slower. 10 is a normal default.
    const passwordHash = await bcrypt.hash(password, 10);

    // A random token used only for the verification link.
    const verificationToken = crypto.randomBytes(24).toString("hex");

    const authToken = generateToken();

    const newUser = await User.create({
      fullName,
      email,
      passwordHash,
      contactNumber,
      address,
      accountType,
      isVerified: false,
      verificationToken: verificationToken,
      authToken: authToken,
      role: "USER"
    });

    // Email the verification link. If SMTP isn't set up yet we print it in the
    // terminal so you can still test the flow.
    const verifyLink = buildVerificationLink(newUser);
    try {
      await mailTransporter.sendMail({
        from: process.env.SMTP_USER || "no-reply@bayanihanlink.com",
        to: newUser.email,
        subject: "Verify your BayanihanLink account",
        text: "Welcome! Please verify your account by opening this link:\n\n" + verifyLink
      });
      console.log("Verification link sent to " + newUser.email);
    } catch (mailError) {
      console.log("Could not send the verification email, so here is the link:");
      console.log("VERIFY LINK FOR " + newUser.email + " = " + verifyLink);
    }

    res.status(201).json(toSafeUser(newUser));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while creating the account." });
  }
});

// POST /api/auth/login
// Body: { email, password }
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

    // Compares the typed password against the stored hash.
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Check that the typed "current password" actually matches what's stored.
    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while changing the password." });
  }
});

// POST /api/auth/send-reset-code
// Body: { email }
// Only a REGISTERED email gets a code. The code is emailed and also saved
// (with an expiry time) so we can check it later.
router.post("/send-reset-code", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Please enter your email." });
    }

    const user = await User.findOne({ email: email.trim() });
    if (!user) {
      // This is what stops random emails from getting codes.
      return res.status(404).json({ error: "No account found with that email." });
    }

    // A random 6-digit number, like 483920.
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Remember the code and when it stops working.
    resetCodes.set(user.email, {
      code: code,
      expiresAt: Date.now() + CODE_EXPIRY_MS
    });

    // Send the email. If SMTP isn't set up yet we just print the code in the
    // terminal so you can still test the whole flow.
    try {
      await mailTransporter.sendMail({
        from: process.env.SMTP_USER || "no-reply@bayanihanlink.com",
        to: user.email,
        subject: "BayanihanLink password reset code",
        text: "Your BayanihanLink verification code is: " + code
      });
      console.log("Reset code sent to " + user.email);
    } catch (mailError) {
      console.log("Could not send the email, so here is the code instead:");
      console.log("CODE FOR " + user.email + " = " + code);
    }

    res.json({ message: "Code sent." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while sending the code." });
  }
});

// GET /api/auth/verify-email?token=xxxxx
// This is the link the user clicks in their inbox. Finding the account by that
// token is what flips isVerified to true.
router.get("/verify-email", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).send("Missing verification token.");
    }

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).send("This verification link is not valid.");
    }

    user.isVerified = true;
    user.verificationToken = "";
    if (!user.authToken) {
      user.authToken = generateToken();
    }
    await user.save();

    res.send(
      "<h2>Email verified!</h2>" +
      "<p>Thank you for verifying your BayanihanLink account. " +
      "You can now close this page and open the app.</p>"
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong while verifying the email.");
  }
});

// POST /api/auth/verify-reset-code
// Body: { email, code }
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Please enter the code." });
    }

    const saved = resetCodes.get(email.trim());
    if (!saved) {
      return res.status(400).json({ error: "Please request a new code." });
    }
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

// POST /api/auth/reset-password
// Body: { email, code, newPassword }
// Checks the code again (so it can't be skipped) and then saves the new password.
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
    if (!user) {
      return res.status(404).json({ error: "No account found with that email." });
    }

    // Hash it the same way Register and Change Password do.
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    // The code has been used, so delete it.
    resetCodes.delete(email.trim());

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while resetting the password." });
  }
});

module.exports = router;