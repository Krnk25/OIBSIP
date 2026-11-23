import express from "express";
import {
  createOrder,
  createRazorpayOrder,
  getAllOrders,
  getMyOrders,
  sendDeliveryOtp,
  updateOrderStatus,
  verifyAndPlaceOrder,
} from "../controllers/orderController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createOrder);
router.post("/razorpay", protect, createRazorpayOrder);
router.post("/verify", protect, verifyAndPlaceOrder);

router.get("/my-orders", protect, getMyOrders);
router.get("/", protect, adminOnly, getAllOrders);
router.put("/:id/status", protect, adminOnly, updateOrderStatus);
router.post("/:id/send-otp", protect, adminOnly, sendDeliveryOtp);

export default router;