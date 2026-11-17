import express from 'express';
import {
  createRazorpayOrder,
  verifyAndPlaceOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/razorpay', protect, createRazorpayOrder);
router.post('/verify', protect, verifyAndPlaceOrder);
router.get('/my-orders', protect, getMyOrders);

// Admin Routes
router.get('/', protect, adminOnly, getAllOrders);
router.put('/:id/status', protect, adminOnly, updateOrderStatus);

export default router;