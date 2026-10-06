import eventRoutes from "./routes/events.js";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import "express-async-errors";
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./prisma.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());   // lets the server read JSON sent by the browser
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })); // blocks password-guessing
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);

// Test route: proves server + database both work
app.get("/api/health", async (req, res) => {
  const users = await prisma.user.count();
  res.json({ status: "ok", app: "Eventra", users });
});

app.listen(process.env.PORT, () =>
  console.log(`Server running on http://localhost:${process.env.PORT}`)
);