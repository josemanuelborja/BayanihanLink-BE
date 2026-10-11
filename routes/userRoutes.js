// Routes for a user's own profile info — used by the Profile screen,
// the Edit Profile screen, and to get the name/initials on the Home screen.

const express = require("express");
const User = require("../models/User");

const router = express.Router();

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      contactNumber: user.contactNumber,
      address: user.address,
      accountType: user.accountType
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while fetching the profile." });
  }
});

// PUT /api/users/:id — saves the changes made on the Edit Profile screen.
// The app sends the full form (fullName, email, contactNumber, address),
// so we replace those fields with whatever came in.
router.put("/:id", async (req, res) => {
  try {
    const { fullName, email, contactNumber, address } = req.body;

    // Simple validation, same step-by-step style as the other routes.
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: "Please enter your full name." });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Please enter your email." });
    }
    if (!contactNumber || !contactNumber.trim()) {
      return res.status(400).json({ error: "Please enter your contact number." });
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ error: "Please enter your address." });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.fullName = fullName.trim();
    user.email = email.trim();
    user.contactNumber = contactNumber.trim();
    user.address = address.trim();

    // save() will fail with code 11000 if that email already belongs to
    // someone else — we turn that into a friendly message.
    try {
      await user.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        return res.status(409).json({ error: "That email is already in use." });
      }
      throw saveError;
    }

    res.json({
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      contactNumber: user.contactNumber,
      address: user.address,
      accountType: user.accountType
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong while saving the profile." });
  }
});

module.exports = router;
