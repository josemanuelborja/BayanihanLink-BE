// Simple server for BayanihanLink

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const requestRoutes = require("./routes/requestRoutes");
const offerRoutes = require("./routes/offerRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const coordinationRoutes = require("./routes/coordinationRoutes");
const { ensureDefaultAccounts } = require("./utils/ensureAccounts");
const { backfillReferences } = require("./utils/references");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/coordination", coordinationRoutes);

app.get("/", (req, res) => {
  res.send("BayanihanLink backend is running!");
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bayanihanlink";

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB!");

    // Make sure every teammate has the Admin and DSWD accounts.
    try {
      await ensureDefaultAccounts();
    } catch (error) {
      console.error("Could not prepare the default accounts:", error.message);
    }

    // Give older requests/offers their BL-... and DO-... references.
    try {
      await backfillReferences();
    } catch (error) {
      console.error("Could not backfill references:", error.message);
    }

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message);
  });
