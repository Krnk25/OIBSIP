import express from 'express';
import {
  getMe,
  loginUser,
  registerUser,
  verifyEmail,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.get('/verify/:token', verifyEmail);
router.post('/login', loginUser);
router.get('/me', protect, getMe); // Protected route

export default router;