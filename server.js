// This is the main file. Running "npm start" runs THIS file, which:
// 1. Connects to your local MongoDB
// 2. Starts a small web server
// 3. Turns on the routes (register/login/requests) so the Android app can call them

require("dotenv").config(); // loads settings from your ".env" file

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const requestRoutes = require("./routes/requestRoutes");

const app = express();

app.use(cors()); // allows the Android app to call this server
app.use(express.json()); // lets us read JSON data sent from the app

// This serves the uploaded evidence pictures, so the app can display them.
// A file saved as "uploads/evidence-123.jpg" can then be loaded by visiting
// http://localhost:3000/uploads/evidence-123.jpg
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Every route file is "mounted" under a starting path:
// authRoutes handles /api/auth/..., userRoutes handles /api/users/..., etc.
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/requests", requestRoutes);

// A simple route just to check the server is alive, by visiting it in a browser.
app.get("/", (req, res) => {
  res.send("BayanihanLink backend is running!");
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bayanihanlink";

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB!");
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error.message);
  });   