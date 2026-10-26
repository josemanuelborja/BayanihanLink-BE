require("dotenv").config({ path: "C:\\Users\\PC\\StudioProjects\\BayanihanLink-BE\\.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("C:\\Users\\PC\\StudioProjects\\BayanihanLink-BE\\models\\User");
const { generateToken } = require("C:\\Users\\PC\\StudioProjects\\BayanihanLink-BE\\middleware\\auth");

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bayanihanlink");
    console.log("Connected to MongoDB for seeding...");

    const usersToSeed = [
      {
        email: "admin@bayanihanLink.gov.ph",
        fullName: "System Administrator",
        password: "bayanihanlinkgov123",
        role: "ADMIN",
        contactNumber: "+639000000000",
        address: "National Government Center, Quezon City"
      },
      {
        email: "officer@dswd.gov.ph",
        fullName: "DSWD Relief Officer",
        password: "officerdswdgov123",
        role: "OFFICER",
        contactNumber: "+639111111111",
        address: "DSWD Central Office, Batasan Hills, Quezon City"
      }
    ];

    for (const userData of usersToSeed) {
      const existing = await User.findOne({ email: userData.email });
      const passwordHash = await bcrypt.hash(userData.password, 10);
      const authToken = generateToken();

      if (existing) {
        existing.passwordHash = passwordHash;
        existing.role = userData.role;
        existing.isVerified = true;
        existing.authToken = authToken;
        existing.fullName = userData.fullName;
        await existing.save();
        console.log(`User ${userData.email} (${userData.role}) updated successfully!`);
      } else {
        await User.create({
          fullName: userData.fullName,
          email: userData.email,
          passwordHash,
          contactNumber: userData.contactNumber,
          address: userData.address,
          accountType: "AFFECTED_INDIVIDUAL",
          isVerified: true,
          role: userData.role,
          authToken
        });
        console.log(`User ${userData.email} (${userData.role}) created successfully!`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error("Error seeding users:", err);
    process.exit(1);
  }
}

seedUsers();
