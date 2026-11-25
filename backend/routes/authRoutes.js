import express from 'express';
import {
  getMe,
  loginUser,
  registerUser,
  verifyEmail,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

router.post('/register', registerUser);
router.get('/verify/:token', verifyEmail);

router.post('/login', loginUser);
router.get('/me', protect, getMe); // Protected route

router.put('/profile', protect, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.body.name !== undefined) {
      user.name = String(req.body.name).trim();
    }

    if (req.body.email !== undefined) {
      user.email = String(req.body.email).trim();
    }

    const rawPhone = req.body.mobile ?? req.body.phone;
    if (rawPhone !== undefined) {
      const cleanPhone = String(rawPhone).replace(/\D/g, '').slice(-10);
      user.mobile = cleanPhone;
      user.phone = cleanPhone;
    }

    const updatedUser = await user.save();

    return res.json({
      success: true,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        phone: updatedUser.phone,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: error.message || 'Failed to update profile' });
  }
});

export default router;