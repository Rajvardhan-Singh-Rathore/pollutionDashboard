import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import axios from "axios";

dotenv.config();
const app = express();

/* ================== BASIC SETUP ================== */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://pollution-dashboard-azure.vercel.app"
    ],
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"], // ✅ DELETE added
    allowedHeaders: ["Content-Type", "token"]
  })
);

app.use(express.json());

/* ================== DATABASE ================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Mongo Error:", err));

/* ================== AQI HELPERS ================== */
function getAQICategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

/* ================== EMAIL ALERT ================== */
const mail = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ALERT_EMAIL,
    pass: process.env.ALERT_PASS
  }
});

function sendAlert(ward, aqi) {
  if (aqi < 300) return;
  mail.sendMail({
    to: process.env.ALERT_TO,
    subject: `🚨 AQI Alert - ${ward}`,
    text: `Severe AQI detected in ${ward}. AQI = ${aqi}`
  }).catch(() => {});
}

/* ================== MODELS ================== */
const PollutionSchema = new mongoose.Schema({
  wardNo: Number,
  ward: String,
  pm25: Number,
  pm10: Number,
  no2: Number,
  so2: Number,
  aqi: Number,
  category: String,
  lat: Number,
  lng: Number,
  source: {
    type: String,
    enum: ["manual", "live"],
    default: "manual"
  },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const Pollution = mongoose.model("Pollution", PollutionSchema);

const UserSchema = new mongoose.Schema({
  email: String,
  password: String
});

const User = mongoose.model("User", UserSchema);

/* ================== AUTH ================== */
function auth(req, res, next) {
  try {
    jwt.verify(req.headers.token, process.env.JWT_SECRET || "SECRET");
    next();
  } catch {
    res.status(401).json("Unauthorized");
  }
}

/* ================== ROUTES ================== */

// Health check
app.get("/", (req, res) => {
  res.send("✅ Pollution Dashboard API Running");
});

// Register admin
app.post("/api/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  res.json(await User.create({ email: req.body.email, password: hash }));
});

// Login
app.post("/api/login", async (req, res) => {
  const u = await User.findOne({ email: req.body.email });
  if (!u) return res.status(400).json("User not found");

  const ok = await bcrypt.compare(req.body.password, u.password);
  if (!ok) return res.status(400).json("Wrong password");

  const token = jwt.sign(
    { id: u._id },
    process.env.JWT_SECRET || "SECRET",
    { expiresIn: "7d" }
  );

  res.json({ token });
});

// Get stored readings (latest first)
app.get("/api/readings", async (req, res) => {
  const data = await Pollution.find().sort({ date: -1 });
  res.json(data);
});

/* ================== LIVE AQI (WAQI – SMART) ================== */
app.get("/api/live/:place", async (req, res) => {
  try {
    const place = req.params.place;

    const wardCoords = {
      "Anand Vihar": { lat: 28.6469, lng: 77.3156 },
      "Rohini": { lat: 28.7495, lng: 77.0565 },
      "Dwarka": { lat: 28.5921, lng: 77.0460 },
      "Mundka": { lat: 28.6836, lng: 77.0313 }
    };

    let url;

    if (place.toLowerCase() === "delhi") {
      url = "https://api.waqi.info/feed/delhi/";
    } else if (wardCoords[place]) {
      const { lat, lng } = wardCoords[place];
      url = `https://api.waqi.info/feed/geo:${lat};${lng}/`;
    } else {
      url = `https://api.waqi.info/feed/${encodeURIComponent(place)}/`;
    }

    const r = await axios.get(url, {
      params: { token: process.env.WAQI_TOKEN }
    });

    if (r.data.status !== "ok") {
      return res.status(404).json({ error: "No live data" });
    }

    const iaqi = r.data.data.iaqi || {};

    res.json({
      place,
      station: r.data.data.city?.name,
      aqi: r.data.data.aqi,
      pm25: iaqi.pm25?.v ?? null,
      pm10: iaqi.pm10?.v ?? null,
      no2: iaqi.no2?.v ?? null,
      so2: iaqi.so2?.v ?? null
    });
  } catch (e) {
    console.error("WAQI ERROR:", e.message);
    res.status(500).json({ error: "Live AQI fetch failed" });
  }
});

/* ================== ADD READING (ADMIN) ================== */
app.post("/api/readings", auth, async (req, res) => {
  const aqi = Math.max(
    req.body.pm25,
    req.body.pm10,
    req.body.no2,
    req.body.so2 ?? 0
  );

  const record = await Pollution.create({
    ...req.body,
    aqi,
    category: getAQICategory(aqi),
    source: "manual"
  });

  sendAlert(record.ward, aqi);
  res.json(record);
});

/* ================== DELETE READING (ADMIN) ================== */
app.delete("/api/readings/:id", auth, async (req, res) => {
  try {
    const deleted = await Pollution.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Record not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ================== SERVER ================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
