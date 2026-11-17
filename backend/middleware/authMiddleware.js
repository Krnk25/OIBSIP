import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// 1. Verify JWT Token (Logged-in users only)
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // 'Bearer <token>' से टोकन निकालें
      token = req.headers.authorization.split(' ')[1];

      // टोकन डिकोड करें
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // यूजर की जानकारी req.user में जोड़ें (बिना पासवर्ड के)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// 2. Role Check (Admins only)
export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admins only' });
  }
};