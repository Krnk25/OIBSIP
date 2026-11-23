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

    // ✅ सीधा बैकएंड API लिंक ताकि क्लिक करते ही डेटाबेस अपडेट हो जाए
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const verifyUrl = `${backendUrl}/api/auth/verify/${verificationToken}`;

    await sendEmail({
      email: user.email,
      subject: 'Verify Your PizzaZone Account 🍕',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:25px;border:1px solid #e2e8f0;border-radius:12px;text-align:center;">
          <h2 style="color:#e63946;margin-bottom:10px;">Welcome to PizzaZone, ${user.name}! 🍕</h2>
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

// @desc    Verify Email via Token (Shows clean confirmation page in new tab)
// @route   GET /api/auth/verify/:token
export const verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    if (!user) {
      return res.status(400).send(`
        <div style="font-family:Arial,sans-serif;text-align:center;margin-top:80px;">
          <h1 style="color:#e63946;">❌ Invalid or Expired Link</h1>
          <p style="color:#555;">This verification link has already been used or is invalid.</p>
          <a href="${clientUrl}/login" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#2b2d42;color:#fff;text-decoration:none;border-radius:6px;">Go to Login</a>
        </div>
      `);
    }

    // ✅ डेटाबेस में वेरीफाइड स्टेटस अपडेट करें
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    // ✅ नए टैब में सुंदर सक्सेस स्क्रीन दिखाएं
    res.status(200).send(`
      <div style="font-family:Arial,sans-serif;max-width:450px;margin:80px auto;padding:35px;border:1px solid #e2e8f0;border-radius:12px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        <div style="font-size:60px;margin-bottom:10px;">✅</div>
        <h1 style="color:#27ae60;margin-bottom:10px;">Email Verified Successfully!</h1>
        <p style="color:#444;font-size:16px;line-height:1.5;">
          Thank you, <b>${user.name}</b>! Your account is now active.
        </p>
        <a href="${clientUrl}/login" target="_blank" style="display:inline-block;margin-top:25px;padding:14px 30px;background-color:#e63946;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">
          Click Here to Login →
        </a>
      </div>
    `);
    
  } catch (error) {
    res.status(500).send(`<h2>Server Error: ${error.message}</h2>`);
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