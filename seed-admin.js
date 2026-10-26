require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const crypto = require("crypto");

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bayanihanlink");
    console.log("Connected to MongoDB for seeding...");

    const email = "admin@bayanihanLink.gov.ph";
    const existing = await User.findOne({ email });

    const passwordHash = await bcrypt.hash("bayanihanlinkgov123", 10);
    const authToken = generateToken();

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = "ADMIN";
      existing.isVerified = true;
      existing.authToken = authToken;
      await existing.save();
      console.log("Admin user updated successfully!");
    } else {
      await User.create({
        fullName: "System Administrator",
        email,
        passwordHash,
        contactNumber: "+639000000000",
        address: "National Government Center, Quezon City",
        accountType: "AFFECTED_INDIVIDUAL",
        isVerified: true,
        role: "ADMIN",
        authToken
      });
      console.log("Admin user created successfully!");
    }

    process.exit(0);
  } catch (err) {
    console.error("Error seeding admin:", err);
    process.exit(1);
  }
}

seedAdmin();
