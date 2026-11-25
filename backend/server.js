import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import http from "http";
import mongoose from "mongoose";
import dns from "node:dns";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import settingRoutes from "./routes/settingRoutes.js";
// ...


// Force Node.js to use Google DNS to bypass local ISP/Hotspot SRV blocks
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.join(__dirname, ".env"),
  path.join(__dirname, "..", ".env"),
];
const envPath = envCandidates.find((p) => fs.existsSync(p));

// Load environment variables
dotenv.config(envPath ? { path: envPath } : undefined);

// Database
import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import pizzaRoutes from "./routes/pizzaRoutes.js";

// ========================================
// GLOBAL UNCAUGHT ERROR HANDLERS
// ========================================
process.on("uncaughtException", (err) => {
  console.error("\n❌ [UNCAUGHT EXCEPTION] Critical Error:");
  console.error("Message:", err.message);
  console.error("Code:", err.code || "N/A");
  console.error("Stack:\n", err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("\n❌ [UNHANDLED REJECTION] Promise Error:");
  console.error("Reason:", reason);
  if (reason instanceof Error) {
    console.error("Stack:\n", reason.stack);
  }
});

// ========================================
// ENV CHECK
// ========================================
console.log("=================================");
console.log("SERVER ENVIRONMENT CHECK");
console.log("=================================");
console.log("ENV PATH:", envPath || "NOT FOUND ❌");
console.log("PORT:", process.env.PORT || "5000 (Default)");
console.log("MONGO_URI:", process.env.MONGO_URI ? "YES ✅" : "NO ❌");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "YES ✅" : "NO ❌");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "YES ✅" : "NO ❌");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "YES ✅" : "NO ❌");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "YES ✅" : "NO ❌");
console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? "YES ✅" : "NO ❌");
console.log("RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "YES ✅" : "NO ❌");
console.log("FAST2SMS_API_KEY:", process.env.FAST2SMS_API_KEY ? "YES ✅" : "NO ❌");
console.log("=================================\n");

// ========================================
// EXPRESS APP, HTTP SERVER & SOCKET.IO
// ========================================
const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOriginHandler = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(null, true);
};

const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`⚡ A user connected via Socket.io: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`🔌 User disconnected (${socket.id}): ${reason}`);
  });
});

app.set("io", io);

app.use(
  cors({
    origin: corsOriginHandler,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`➡️  [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ========================================
// BASIC HEALTH CHECK ROUTES
// ========================================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend Server is Running",
    dbStatus: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "API Endpoint Active",
  });
});

// ========================================
// API ROUTES
// ========================================
app.use("/api/auth", authRoutes);
app.use("/api/pizzas", pizzaRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/settings", settingRoutes);

// ========================================
// 404 ROUTE NOT FOUND HANDLER
// ========================================
app.use((req, res) => {
  const errorMsg = `Route not found: ${req.method} ${req.originalUrl}`;
  console.warn(`⚠️  [404 WARNING]: ${errorMsg}`);
  res.status(404).json({
    success: false,
    message: errorMsg,
  });
});

// ========================================
// DETAILED EXPRESS ERROR HANDLER
// ========================================
app.use((err, req, res, next) => {
  console.error("\n🔥 [EXPRESS ROUTE ERROR]:");
  console.error("URL:", `${req.method} ${req.originalUrl}`);
  console.error("Message:", err.message);
  console.error("Status Code:", err.status || 500);
  console.error("Stack Trace:\n", err.stack);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    code: err.code || "SERVER_ERROR",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

// ========================================
// MONGODB DIAGNOSTICS (NON-BLOCKING)
// ========================================
const runMongoDiagnostics = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    console.log("\n=================================");
    console.log("MONGODB DIAGNOSTICS");
    console.log("=================================");
    console.log("CONNECTION STATUS:", mongoose.connection.readyState, "(1 = Connected)");
    console.log("ACTIVE DATABASE:", mongoose.connection.name);
    console.log("HOST:", mongoose.connection.host);

    const collections = await db.listCollections().toArray();
    console.log(
      "COLLECTIONS IN CURRENT DB:",
      collections.map((c) => c.name)
    );

    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`📁 COLLECTION [${collection.name}]: ${count} documents`);
    }
    console.log("=================================\n");
  } catch (error) {
    console.warn("⚠️  MongoDB diagnostics skipped:", error.message);
  }
};

// ========================================
// START SERVER AFTER DATABASE CONNECTION
// ========================================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await connectDB();
    console.log("✅ MongoDB connected successfully!");

    server.listen(PORT, "0.0.0.0", () => {
      console.log("---------------------------------");
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Local URL: http://localhost:${PORT}`);
      console.log("---------------------------------\n");
    });

    runMongoDiagnostics();
  } catch (error) {
    console.error("\n❌ [FATAL] MongoDB Connection Failed!");
    console.error("Error Name:", error.name);
    console.error("Error Code:", error.code || "N/A");
    console.error("Error Message:", error.message);
    console.error("Full Stack Trace:\n", error.stack);
    process.exit(1);
  }
};

startServer();