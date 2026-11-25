import express from "express";
import {
  getStoreSettings,
  updateStoreSettings,
} from "../controllers/settingController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getStoreSettings);
router.put("/", protect, adminOnly, updateStoreSettings);

export default router;