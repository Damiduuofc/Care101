import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes); // <-- register auth route

app.get("/", (req, res) => {
  res.send("Backend running!");
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
