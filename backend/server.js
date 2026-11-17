import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import dns from "node:dns";

// Force Node.js to use Google DNS to bypass local ISP/Hotspot SRV blocks
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Load environment variables
dotenv.config();

// Database
import connectDB from "./config/db.js";

// Routes (Pizza Delivery App Routes - अपने प्रोजेक्ट के हिसाब से रखें)
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import pizzaRoutes from "./routes/pizzaRoutes.js";

// ========================================
// GLOBAL UNCAUGHT ERROR HANDLERS (ALL ERRORS)
// ========================================
process.on("uncaughtException", (err) => {
  console.error("\n❌ [UNCAUGHT EXCEPTION] Critical Error:");
  console.error("Message:", err.message);
  console.error("Code:", err.code || "N/A");
  console.error("Stack:\n", err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
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
console.log("PORT:", process.env.PORT || "5000 (Default)");
console.log("MONGO_URI:", process.env.MONGO_URI ? "YES ✅" : "NO ❌");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "YES ✅" : "NO ❌");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "YES ✅" : "NO ❌");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "YES ✅" : "NO ❌");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "YES ✅" : "NO ❌");
console.log("=================================\n");

// ========================================
// EXPRESS APP & MIDDLEWARE
// ========================================
const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request Logger (हर API रिक्वेस्ट और उसका स्टेटस दिखाने के लिए)
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
// MONGODB DIAGNOSTICS (CHECK DB & COLLECTIONS)
// ========================================
const runMongoDiagnostics = async () => {
  try {
    const db = mongoose.connection.db;

    if (!db) {
      console.error("❌ MongoDB database handle is not available");
      return;
    }

    console.log("\n=================================");
    console.log("MONGODB DIAGNOSTICS");
    console.log("=================================");
    console.log("CONNECTION STATUS:", mongoose.connection.readyState, "(1 = Connected)");
    console.log("ACTIVE DATABASE:", mongoose.connection.name);
    console.log("HOST:", mongoose.connection.host);

    // List all databases on the cluster/server
    const adminDb = db.admin();
    const dbsList = await adminDb.listDatabases();
    console.log(
      "ALL DATABASES:",
      dbsList.databases.map((d) => `${d.name} (${(d.sizeOnDisk / 1024).toFixed(2)} KB)`)
    );

    // List all collections in current database
    const collections = await db.listCollections().toArray();
    console.log(
      "COLLECTIONS IN CURRENT DB:",
      collections.map((c) => c.name)
    );
    console.log("---------------------------------");

    // Count documents in every collection
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`📁 COLLECTION [${collection.name}]: ${count} documents`);
    }

    console.log("=================================\n");
  } catch (error) {
    console.error("❌ MongoDB diagnostics failed:");
    console.error("Message:", error.message);
    console.error("Stack:\n", error.stack);
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

    // Run diagnostics to list all DBs & collections
    await runMongoDiagnostics();

    // Start Express server
    app.listen(PORT, "0.0.0.0", () => {
      console.log("---------------------------------");
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Local URL: http://localhost:${PORT}`);
      console.log("---------------------------------\n");
    });
  } catch (error) {
    console.error("\n❌ [FATAL] MongoDB Connection Failed!");
    console.error("Error Name:", error.name);
    console.error("Error Code:", error.code || "N/A");
    console.error("Error Message:", error.message);
    if (error.reason) {
      console.error("Topology Reason:", JSON.stringify(error.reason, null, 2));
    }
    console.error("Full Stack Trace:\n", error.stack);
    process.exit(1);
  }
};

// Start application
startServer();