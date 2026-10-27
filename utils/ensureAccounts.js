// Creates the Admin and DSWD accounts that the admin portal expects.
// The emails and passwords can be overridden with environment variables, so
// every teammate can use the same accounts without editing this file.

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function defaultAccounts() {
  return [
    {
      email: (process.env.ADMIN_EMAIL || "admin@bayanihanLink.gov.ph").trim(),
      password: process.env.ADMIN_PASSWORD || "bayanihanlinkgov123",
      fullName: process.env.ADMIN_NAME || "System Administrator",
      role: "ADMIN",
      contactNumber: "+639000000000",
      address: "National Government Center, Quezon City"
    },
    {
      email: (process.env.DSWD_EMAIL || "officer@dswd.gov.ph").trim(),
      password: process.env.DSWD_PASSWORD || "officerdswdgov123",
      fullName: process.env.DSWD_NAME || "DSWD Relief Officer",
      role: "OFFICER",
      contactNumber: "+639111111111",
      address: "DSWD Central Office, Batasan Hills, Quezon City"
    }
  ];
}

async function ensureDefaultAccounts() {
  for (const account of defaultAccounts()) {
    const emailPattern = new RegExp("^" + escapeRegex(account.email) + "$", "i");
    const users = await User.find({ email: emailPattern });

    if (users.length === 0) {
      users.push(new User({
        email: account.email,
        accountType: "AFFECTED_INDIVIDUAL",
        authToken: crypto.randomBytes(32).toString("hex")
      }));
    }

    for (const user of users) {
      // Keep the documented demo credentials working on every local database.
      // Change ADMIN_PASSWORD / DSWD_PASSWORD in .env for a different password.
      user.fullName = account.fullName;
      user.passwordHash = await bcrypt.hash(account.password, 10);
      user.contactNumber = account.contactNumber;
      user.address = account.address;
      user.role = account.role;
      user.isVerified = true;
      if (!user.authToken) {
        user.authToken = crypto.randomBytes(32).toString("hex");
      }

      await user.save();
      console.log("[accounts] " + account.role + " account ready: " + user.email);
    }
  }
}

module.exports = { ensureDefaultAccounts, defaultAccounts };
