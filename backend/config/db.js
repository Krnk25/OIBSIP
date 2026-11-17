import dns from "dns";
import mongoose from "mongoose";

dns.setDefaultResultOrder("ipv4first");

const connectDB = async () => {
  try {
    // यहाँ MONGO_URI और MONGODB_URI दोनों को सपोर्ट करने के लिए जोड़ दिया गया है
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error(
        "MONGO_URI or MONGODB_URI is missing in environment variables"
      );
    }

    console.log("⏳ Attempting to connect to MongoDB Atlas...");

    // Connect to MongoDB Atlas
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });

    const db = mongoose.connection.db;

    if (!db) {
      throw new Error(
        "MongoDB database connection is unavailable"
      );
    }

    console.log("\n=================================");
    console.log("       MONGODB DIAGNOSTICS");
    console.log("=================================");

    console.log(
      "CONNECTION STATUS:",
      mongoose.connection.readyState,
      "(1 = Connected)"
    );
    console.log("DATABASE:", mongoose.connection.name);
    console.log("HOST:", mongoose.connection.host);

    // List collections safely
    const collections = await db.listCollections().toArray();

    console.log(
      "COLLECTIONS:",
      collections.map((collection) => collection.name)
    );

    console.log("=================================\n");

    return true;
  } catch (error) {
    console.error(
      "\n❌ MONGODB CONNECTION ERROR:",
      error.message
    );
    if (error.reason) {
      console.error("Reason:", JSON.stringify(error.reason, null, 2));
    }

    // Important: propagate the error to server.js
    throw error;
  }
};

export default connectDB;