const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const http = require("http");

async function triggerDelayAlert() {
  await mongoose.connect(process.env.MONGO_URI);
  const Doctor = require("./models/Doctor").default;
  const doc = await Doctor.findOne({ name: /Wijerathne/i });

  if (!doc) {
    console.error("Doctor not found!");
    process.exit(1);
  }

  // Ensure doctor is assigned to nurse Jithmi in Room 14
  doc.allocatedNurse = "jithmi";
  doc.allocatedRoom = "Room 14";
  await doc.save();

  // Create JWT token for nurse Jithmi
  const token = jwt.sign(
    { id: "6a3e925087a9b70678e34808", role: "nurse", name: "jithmi" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const statuses = ["Delayed 15 mins", "Delayed 20 mins", "Delayed 30 mins", "Delayed 45 mins"];
  const currentIdx = statuses.indexOf(doc.channelingStatus);
  const nextStatus = statuses[(currentIdx + 1) % statuses.length];

  const postData = JSON.stringify({
    channelingStatus: nextStatus
  });

  const options = {
    hostname: "localhost",
    port: 5002,
    path: `/api/admin/doctors/${doc._id}/status`,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": token,
      "Content-Length": Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let body = "";
    res.on("data", (chunk) => body += chunk);
    res.on("end", () => {
      console.log(`✅ Delay Alert Sent! HTTP ${res.statusCode}`);
      console.log(`🚨 Doctor: ${doc.name}`);
      console.log(`⏱️ New Status: ${nextStatus}`);
      console.log(`👩‍⚕️ Assigned Nurse: ${doc.allocatedNurse} (${doc.allocatedRoom})`);
      console.log(`🔔 Chime sound & popup dispatched via Socket.IO!`);
      process.exit(0);
    });
  });

  req.on("error", (e) => {
    console.error("Request error:", e);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

triggerDelayAlert();
