import Razorpay from 'razorpay';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Ingredient from '../models/Ingredient.js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder',
});

// @desc    Step 1: Create Razorpay Order
// @route   POST /api/orders/razorpay
export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body; // रक्कम रुपयांमध्ये

    const options = {
      amount: Math.round(amount * 100), // Razorpay ला पैशांमध्ये (paise) रक्कम लागते
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Razorpay order creation failed', error: error.message });
  }
};

// @desc    Step 2: Verify Payment Signature, Deduct Stock Atomically & Save Order
// @route   POST /api/orders/verify
export const verifyAndPlaceOrder = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      deliveryAddress,
      totalAmount,
    } = req.body;

    // 1. Verify Razorpay Signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({ message: 'Payment verification failed! Invalid signature.' });
    }

    // 2. Atomic Stock Deduction for Custom Pizzas
    for (const item of items) {
      if (item.isCustom && item.customDetails) {
        const qty = item.quantity || 1;
        const ingredientIds = [];

        if (item.customDetails.base?.id) ingredientIds.push(item.customDetails.base.id);
        if (item.customDetails.sauce?.id) ingredientIds.push(item.customDetails.sauce.id);
        if (item.customDetails.cheese?.id) ingredientIds.push(item.customDetails.cheese.id);
        if (Array.isArray(item.customDetails.veggies)) {
          item.customDetails.veggies.forEach((v) => {
            if (v.id) ingredientIds.push(v.id);
          });
        }

        // प्रत्येक वापरलेल्या इंग्रेडियंटचा स्टॉक सुरक्षितपणे कमी करा
        await Ingredient.updateMany(
          { _id: { $in: ingredientIds }, stock: { $gte: qty } },
          { $inc: { stock: -qty } }
        );
      }
    }

    // 3. Save Order in MongoDB
    const newOrder = await Order.create({
      user: req.user._id,
      items,
      deliveryAddress,
      totalAmount,
      paymentInfo: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'Paid',
      },
      orderStatus: 'Order Received',
    });

    // 4. Emit real-time notification via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('newOrderPlaced', newOrder);
    }

    res.status(201).json({
      message: 'Order placed successfully!',
      order: newOrder,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged-in user's orders
// @route   GET /api/orders/my-orders
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders (Admin only)
// @route   GET /api/orders
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order status & notify user in real-time (Admin only)
// @route   PUT /api/orders/:id/status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Real-time update to user tracking page via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit(`orderStatusUpdated_${order._id}`, order);
    }

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};