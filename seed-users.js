// Creates the Admin and DSWD accounts in the local database.
// Run with: node seed-users.js
// The emails and passwords come from .env when they are set there.

require("dotenv").config();
const mongoose = require("mongoose");
const { ensureDefaultAccounts } = require("./utils/ensureAccounts");

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bayanihanlink");
    console.log("Connected to MongoDB for seeding...");

    await ensureDefaultAccounts();

    process.exit(0);
  } catch (err) {
    console.error("Error seeding users:", err);
    process.exit(1);
  }
}

seedUsers();
