import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import sendEmail from '../utils/sendEmail.js';

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @desc    Register User & Send Email with Verify Button
// @route   POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await User.create({
      name,
      email,
      password,
      role: role === 'admin' ? 'admin' : 'user',
      isVerified: false,
      verificationToken,
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const verifyUrl = `${clientUrl}/verify-email/${verificationToken}`;

    await sendEmail({
      email: user.email,
      subject: 'Verify Your Pizza House Account 🍕',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:25px;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
          <h2 style="color:#e63946;margin-bottom:10px;">Welcome to Pizza House, ${user.name}! 🍕</h2>
          <p style="color:#2b2d42;font-size:15px;">Tap the button below to verify your email address and activate your account:</p>
          <a href="${verifyUrl}" style="display:inline-block;margin:20px 0;padding:14px 28px;background-color:#e63946;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">
            Verify Email
          </a>
          <p style="font-size:12px;color:#6c757d;">If the button doesn't work, copy and paste this link in your browser:<br/>${verifyUrl}</p>
        </div>
      `,
    });

    res.status(201).json({
      message: 'Registration successful! We have sent a verification link to your email.',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Email via Token
// @route   GET /api/auth/verify/:token
export const verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or already used verification link.' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: 'Verified Successful! You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login User or Admin
// @route   POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Current Logged-in User Profile
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
  res.status(200).json(req.user);
};