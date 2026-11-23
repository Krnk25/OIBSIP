import crypto from "crypto";
import Razorpay from "razorpay";
import Ingredient from "../models/Ingredient.js";
import Order from "../models/Order.js";
import { sendDeliveryOtpSms } from "../utils/sendSms.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "secret_placeholder",
});

// Helper: Generate 4-digit delivery OTP
const generateDeliveryOtp = () =>
  String(crypto.randomInt(1000, 10000));

// Helper: Extract 10-digit Indian mobile number from order or user
const extractIndianPhone = (order) => {
  const candidates = [
    order?.shippingAddress?.phone,
    order?.phone,
    order?.user?.phone,
    order?.deliveryAddress,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
  }
  return "";
};

// Helper: Convert address object or string into a clean String for Order schema
const formatDeliveryAddress = (rawAddress) => {
  if (typeof rawAddress === "string") {
    return rawAddress.trim();
  }
  if (rawAddress && typeof rawAddress === "object") {
    return [
      rawAddress.street,
      rawAddress.city,
      rawAddress.postalCode,
      rawAddress.phone ? `Phone: ${rawAddress.phone}` : "",
    ]
      .filter(Boolean)
      .join(", ")
      .trim();
  }
  return "";
};

// Helper: Format cart/order items to match Order schema
const formatOrderItems = (rawItems = []) =>
  rawItems.map((item) => {
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const price = Number(item.price ?? item.unitPrice ?? 0);

    return {
      name: item.name,
      image: item.image || "",
      isCustom: Boolean(item.isCustom),
      size: item.size || item.selectedSize || "medium",
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      price: Number.isFinite(price) ? price : 0,
      customDetails:
        item.isCustom && item.customDetails ? item.customDetails : undefined,
    };
  });

// Helper: Deduct stock for custom pizza ingredients
const deductCustomIngredientStock = async (items = []) => {
  for (const item of items) {
    if (item.isCustom && item.customDetails) {
      const qty = Number(item.quantity ?? item.qty ?? 1);
      const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const ingredientIds = [];

      if (item.customDetails.base?.id || item.customDetails.base?._id) {
        ingredientIds.push(
          item.customDetails.base.id || item.customDetails.base._id
        );
      }
      if (item.customDetails.sauce?.id || item.customDetails.sauce?._id) {
        ingredientIds.push(
          item.customDetails.sauce.id || item.customDetails.sauce._id
        );
      }
      if (item.customDetails.cheese?.id || item.customDetails.cheese?._id) {
        ingredientIds.push(
          item.customDetails.cheese.id || item.customDetails.cheese._id
        );
      }
      if (Array.isArray(item.customDetails.veggies)) {
        item.customDetails.veggies.forEach((v) => {
          const vId = v?.id || v?._id;
          if (vId) ingredientIds.push(vId);
        });
      }

      if (ingredientIds.length > 0) {
        await Ingredient.updateMany(
          { _id: { $in: ingredientIds }, stock: { $gte: safeQty } },
          { $inc: { stock: -safeQty } }
        );
      }
    }
  }
};

// Helper: Emit live order events via Socket.io
const emitOrderSocketEvents = (req, order, extraOtpPayload = null) => {
  const io = req.app.get("io");
  if (!io || !order) return;

  if (extraOtpPayload) {
    io.emit(`deliveryOtpSent_${order._id}`, extraOtpPayload);
  }
  io.emit(`orderStatusUpdated_${order._id}`, order);
};

// @desc    Create a direct / COD order
// @route   POST /api/orders
export const createOrder = async (req, res) => {
  try {
    const rawItems = req.body.orderItems || req.body.items || [];
    const rawAddress = req.body.deliveryAddress ?? req.body.shippingAddress;
    const paymentMethod = req.body.paymentMethod || "Cash on Delivery";
    const totalAmount = Number(req.body.totalAmount ?? req.body.totalPrice ?? 0);

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ message: "No order items provided" });
    }

    const deliveryAddress = formatDeliveryAddress(rawAddress);
    if (!deliveryAddress) {
      return res.status(400).json({ message: "Delivery address is required" });
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: "Valid totalAmount is required" });
    }

    await deductCustomIngredientStock(rawItems);

    const items = formatOrderItems(rawItems);
    const isOnline = String(paymentMethod).toLowerCase() === "online";
    const paymentStatus =
      req.body.paymentStatus || (isOnline ? "Paid" : "Pending");
    const deliveryOtp = generateDeliveryOtp();

    const newOrder = await Order.create({
      user: req.user._id,
      items,
      deliveryAddress,
      shippingAddress:
        rawAddress && typeof rawAddress === "object" ? rawAddress : undefined,
      totalAmount,
      paymentMethod,
      paymentStatus,
      isPaid: paymentStatus === "Paid",
      paymentInfo: {
        status: paymentStatus,
      },
      orderStatus: "Order Received",
      deliveryOtp,
      isOtpVerified: false,
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("newOrderPlaced", newOrder);
    }

    return res.status(201).json({
      message: "Order placed successfully!",
      order: newOrder,
    });
  } catch (error) {
    console.error("createOrder error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create Razorpay order
// @route   POST /api/orders/razorpay
export const createRazorpayOrder = async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid order amount" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    return res.status(200).json(order);
  } catch (error) {
    return res.status(500).json({
      message: "Razorpay order creation failed",
      error: error.message,
    });
  }
};

// @desc    Verify payment signature, deduct custom ingredient stock & save order
// @route   POST /api/orders/verify
export const verifyAndPlaceOrder = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items = [],
      orderItems = [],
      deliveryAddress: rawAddress,
      shippingAddress,
      totalAmount: rawTotal,
      totalPrice,
    } = req.body;

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ message: "Payment verification failed! Invalid signature." });
    }

    const sourceItems = items.length > 0 ? items : orderItems;
    const addressInput = rawAddress ?? shippingAddress;
    const deliveryAddress = formatDeliveryAddress(addressInput);
    const totalAmount = Number(rawTotal ?? totalPrice ?? 0);

    if (!deliveryAddress) {
      return res.status(400).json({ message: "Delivery address is required" });
    }

    await deductCustomIngredientStock(sourceItems);

    const formattedItems = formatOrderItems(sourceItems);
    const deliveryOtp = generateDeliveryOtp();

    const newOrder = await Order.create({
      user: req.user._id,
      items: formattedItems,
      deliveryAddress,
      shippingAddress:
        addressInput && typeof addressInput === "object"
          ? addressInput
          : undefined,
      totalAmount,
      paymentMethod: "Online",
      paymentStatus: "Paid",
      isPaid: true,
      paymentInfo: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "Paid",
      },
      orderStatus: "Order Received",
      deliveryOtp,
      isOtpVerified: false,
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("newOrderPlaced", newOrder);
    }

    return res.status(201).json({
      message: "Order placed successfully!",
      order: newOrder,
    });
  } catch (error) {
    console.error("verifyAndPlaceOrder error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged-in user's orders
// @route   GET /api/orders/my-orders
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Generate & send 4-digit delivery OTP via SMS + Socket.io (Admin)
// @route   POST /api/orders/:id/send-otp
export const sendDeliveryOtp = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email phone"
    );
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = String(order.orderStatus || "").toLowerCase();
    if (currentStatus === "delivered") {
      return res.status(400).json({ message: "Order is already delivered" });
    }
    if (currentStatus === "cancelled") {
      return res
        .status(400)
        .json({ message: "Cancelled order cannot receive OTP" });
    }

    const otp = generateDeliveryOtp();
    const otpSentAt = new Date();

    order.deliveryOtp = otp;
    order.otpSentAt = otpSentAt;
    order.isOtpVerified = false;

    if (req.body?.markOutForDelivery !== false) {
      order.orderStatus = "Sent to Delivery";
    }

    await order.save();

    const phone10 = extractIndianPhone(order);
    let smsStatus = { sent: false, reason: "Customer phone number not found" };

    if (phone10 && typeof sendDeliveryOtpSms === "function") {
      try {
        smsStatus = await sendDeliveryOtpSms(phone10, otp, order._id);
      } catch (smsErr) {
        console.error("Delivery OTP SMS error:", smsErr.message);
        smsStatus = { sent: false, reason: smsErr.message };
      }
    }

    emitOrderSocketEvents(req, order, {
      orderId: order._id,
      deliveryOtp: otp,
      otpSentAt,
      orderStatus: order.orderStatus,
    });

    return res.status(200).json({
      message: smsStatus.sent
        ? `Delivery OTP sent to mobile ending in ${phone10.slice(-4)}!`
        : "Delivery OTP generated and synced to customer order.",
      orderId: order._id,
      deliveryOtp: otp,
      otpSentAt,
      orderStatus: order.orderStatus,
      smsStatus,
    });
  } catch (error) {
    console.error("sendDeliveryOtp error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update order status & payment status with OTP verification on delivery (Admin)
// @route   PUT /api/orders/:id/status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, otp, paymentStatus, isPaid } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (orderStatus === "Delivered" && !order.isOtpVerified) {
      const providedOtp = String(otp || "").trim();
      if (!providedOtp) {
        return res.status(400).json({
          message: "4-digit delivery OTP is required to mark order as Delivered",
        });
      }
      if (providedOtp !== String(order.deliveryOtp || "").trim()) {
        return res.status(400).json({
          message: "Invalid delivery OTP! Please check with the customer.",
        });
      }
      order.isOtpVerified = true;
      order.deliveredAt = new Date();
    }

    if (orderStatus) {
      order.orderStatus = orderStatus;
    }

    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
      order.isPaid = paymentStatus === "Paid";
      order.paymentInfo = {
        ...(order.paymentInfo?.toObject
          ? order.paymentInfo.toObject()
          : order.paymentInfo),
        status: paymentStatus,
      };
    } else if (typeof isPaid === "boolean") {
      order.isPaid = isPaid;
      const derivedStatus = isPaid ? "Paid" : "Pending";
      order.paymentStatus = derivedStatus;
      order.paymentInfo = {
        ...(order.paymentInfo?.toObject
          ? order.paymentInfo.toObject()
          : order.paymentInfo),
        status: derivedStatus,
      };
    }

    const updatedOrder = await order.save();
    emitOrderSocketEvents(req, updatedOrder);

    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.error("updateOrderStatus error:", error);
    return res.status(500).json({ message: error.message });
  }
};