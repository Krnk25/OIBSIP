import crypto from "crypto";
import Razorpay from "razorpay";
import Ingredient from "../models/Ingredient.js";
import Order from "../models/Order.js";
import Pizza from "../models/Pizza.js";
import User from "../models/User.js";
import { sendDeliveryOtpEmail } from "../utils/sendDeliveryOtpEmail.js";
import { sendNewOrderEmailToAdmin } from "../utils/sendOrderEmail.js";
import { sendDeliveryOtpSms } from "../utils/sendSms.js";

// Helper: Generate 4-digit delivery OTP
const generateDeliveryOtp = () => String(crypto.randomInt(1000, 10000));

// Helper: Extract 10-digit Indian mobile number from request, order, or user
const extractIndianPhone = (order, extraPhone = "") => {
  const candidates = [
    extraPhone,
    order?.shippingAddress?.phone,
    order?.shippingAddress?.mobile,
    order?.phone,
    order?.mobile,
    order?.user?.mobile,
    order?.user?.phone,
    order?.deliveryAddress,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length >= 10) {
      const tenDigits = digits.slice(-10);
      if (/^[6-9]\d{9}$/.test(tenDigits)) {
        return tenDigits;
      }
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
    const pizzaId = item.pizza?._id || item.pizza || (!item.isCustom ? item._id : undefined);

    return {
      ...(pizzaId ? { pizza: pizzaId } : {}),
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

// Helper: Deduct stock for both custom pizza ingredients and regular menu pizzas
const deductOrderStock = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    const rawQty = Number(item.quantity ?? item.qty ?? 1);
    const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;

    if (item.isCustom && item.customDetails) {
      const { base, sauce, cheese, veggies = [] } = item.customDetails;
      const selectedIngredients = [
        base,
        sauce,
        cheese,
        ...(Array.isArray(veggies) ? veggies : []),
      ].filter(Boolean);

      for (const ing of selectedIngredients) {
        const ingId = ing?._id || ing?.id;
        const ingName = ing?.name ? String(ing.name).trim() : "";
        const filter = ingId ? { _id: ingId } : ingName ? { name: ingName } : null;
        if (!filter) continue;

        const updatedIng = await Ingredient.findOneAndUpdate(
          filter,
          { $inc: { stock: -qty } },
          { new: true }
        );

        if (updatedIng && Number(updatedIng.stock) < 0) {
          await Ingredient.findByIdAndUpdate(updatedIng._id, {
            $set: { stock: 0 },
          });
        }
      }
    } else {
      const pizzaId = item.pizza?._id || item.pizza || item._id;
      const pizzaName = item.name ? String(item.name).trim() : "";
      const filter = pizzaId
        ? { _id: pizzaId }
        : pizzaName
          ? { name: pizzaName }
          : null;
      if (!filter) continue;

      const updatedPizza = await Pizza.findOneAndUpdate(
        filter,
        { $inc: { stock: -qty } },
        { new: true }
      );

      if (updatedPizza && Number(updatedPizza.stock) < 0) {
        await Pizza.findByIdAndUpdate(updatedPizza._id, {
          $set: { stock: 0 },
        });
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

// Helper: Notify admin by email with customer + pizza details
const triggerAdminOrderEmail = async (order, reqUser) => {
  try {
    let customer = reqUser || null;
    if (!customer && order?.user) {
      customer = await User.findById(order.user).select(
        "name email phone mobile"
      );
    } else if (reqUser?._id && (!reqUser.name || !reqUser.email)) {
      const dbUser = await User.findById(reqUser._id).select(
        "name email phone mobile"
      );
      if (dbUser) customer = dbUser;
    }

    await sendNewOrderEmailToAdmin({ order, customer });
  } catch (emailErr) {
    console.error("Admin order email error:", emailErr.message);
  }
};

// @desc    Create a direct / COD / ₹0 Free order
// @route   POST /api/orders
export const createOrder = async (req, res) => {
  try {
    const rawItems = req.body.orderItems || req.body.items || [];
    const rawAddress = req.body.deliveryAddress ?? req.body.shippingAddress;
    const rawTotal = Number(req.body.totalAmount ?? req.body.totalPrice ?? 0);

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ message: "No order items provided" });
    }

    const deliveryAddress = formatDeliveryAddress(rawAddress);
    if (!deliveryAddress) {
      return res.status(400).json({ message: "Delivery address is required" });
    }

    if (!Number.isFinite(rawTotal) || rawTotal < 0) {
      return res.status(400).json({ message: "Valid totalAmount is required" });
    }

    const totalAmount = Math.max(0, rawTotal);
    const paymentMethod =
      totalAmount === 0
        ? req.body.paymentMethod || "Free Order"
        : req.body.paymentMethod || "Cash on Delivery";

    const phone10 = extractIndianPhone(
      {
        shippingAddress: rawAddress,
        phone: req.body.phone,
        mobile: req.body.mobile,
        user: req.user,
        deliveryAddress,
      },
      req.body?.phone || req.body?.mobile
    );

    const normalizedShippingAddress =
      rawAddress && typeof rawAddress === "object"
        ? {
            ...rawAddress,
            ...(phone10 ? { phone: rawAddress.phone || phone10 } : {}),
          }
        : undefined;

    await deductOrderStock(rawItems);

    const items = formatOrderItems(rawItems);
    const isOnline = String(paymentMethod).toLowerCase() === "online";
    const paymentStatus =
      totalAmount === 0
        ? "Paid"
        : req.body.paymentStatus || (isOnline ? "Paid" : "Pending");
    const deliveryOtp = generateDeliveryOtp();

    const newOrder = await Order.create({
      user: req.user._id,
      items,
      deliveryAddress,
      shippingAddress: normalizedShippingAddress,
      ...(phone10 ? { phone: phone10 } : {}),
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
      stockDeducted: true,
    });

    await triggerAdminOrderEmail(newOrder, req.user);

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

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error("Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env");
      return res.status(500).json({
        message: "Razorpay keys are missing in backend .env configuration",
      });
    }

    const razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpayInstance.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    return res.status(200).json({
      ...order,
      keyId,
    });
  } catch (error) {
    console.error("createRazorpayOrder error:", error);
    return res.status(500).json({
      message:
        error?.error?.description ||
        error?.message ||
        "Razorpay order creation failed",
    });
  }
};

// @desc    Verify payment signature, deduct stock & save order
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

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        message: "RAZORPAY_KEY_SECRET is missing in backend .env configuration",
      });
    }

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
    const totalAmount = Math.max(0, Number(rawTotal ?? totalPrice ?? 0));

    if (!deliveryAddress) {
      return res.status(400).json({ message: "Delivery address is required" });
    }

    const phone10 = extractIndianPhone(
      {
        shippingAddress: addressInput,
        phone: req.body.phone,
        mobile: req.body.mobile,
        user: req.user,
        deliveryAddress,
      },
      req.body?.phone || req.body?.mobile
    );

    const normalizedShippingAddress =
      addressInput && typeof addressInput === "object"
        ? {
            ...addressInput,
            ...(phone10 ? { phone: addressInput.phone || phone10 } : {}),
          }
        : undefined;

    await deductOrderStock(sourceItems);

    const formattedItems = formatOrderItems(sourceItems);
    const deliveryOtp = generateDeliveryOtp();

    const newOrder = await Order.create({
      user: req.user._id,
      items: formattedItems,
      deliveryAddress,
      shippingAddress: normalizedShippingAddress,
      ...(phone10 ? { phone: phone10 } : {}),
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
      stockDeducted: true,
    });

    await triggerAdminOrderEmail(newOrder, req.user);

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
      .populate("user", "name email phone mobile")
      .sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Send / resend order summary email to admin (Admin)
// @route   POST /api/orders/:id/notify-email
export const notifyOrderByEmail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email phone mobile"
    );
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const result = await sendNewOrderEmailToAdmin({
      order,
      customer: order.user,
    });

    return res.status(200).json({
      message: result.sent
        ? `Order details emailed to admin (${result.to})`
        : `Order details logged (${result.reason})`,
      ...result,
    });
  } catch (error) {
    console.error("notifyOrderByEmail error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Generate & send 4-digit delivery OTP via Email (+ optional SMS & Socket.io)
// @route   POST /api/orders/:id/send-otp
export const sendDeliveryOtp = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email phone mobile"
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

    const phone10 = extractIndianPhone(
      order,
      req.body?.phone || req.body?.mobile
    );
    const customerEmail = String(
      order.user?.email || req.body?.email || order.email || ""
    ).trim();
    const customerName = String(order.user?.name || "Customer").trim();

    if (!customerEmail && !phone10) {
      return res.status(400).json({
        message:
          "Customer email or 10-digit mobile number is required to send delivery OTP.",
      });
    }

    if (phone10) {
      if (order.shippingAddress && typeof order.shippingAddress === "object") {
        if (!order.shippingAddress.phone) {
          order.shippingAddress.phone = phone10;
        }
      }
      if (!order.phone) {
        order.phone = phone10;
      }
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

    let emailStatus = { sent: false, reason: "Customer email not available" };
    if (customerEmail) {
      try {
        emailStatus = await sendDeliveryOtpEmail({
          to: customerEmail,
          customerName,
          otp,
          orderId: order._id,
          phone: phone10,
        });
      } catch (emailErr) {
        console.error("❌ Delivery OTP Email error:", emailErr.message);
        emailStatus = { sent: false, reason: emailErr.message };
      }
    }

    let smsStatus = { sent: false, reason: "Skipped (Email OTP enabled)" };
    if (
      phone10 &&
      String(process.env.FAST2SMS_API_KEY || "").trim() &&
      typeof sendDeliveryOtpSms === "function"
    ) {
      try {
        smsStatus = await sendDeliveryOtpSms(phone10, otp, order._id);
      } catch (smsErr) {
        console.error("⚠️ Delivery OTP SMS skipped/failed:", smsErr.message);
        smsStatus = { sent: false, reason: smsErr.message };
      }
    }

    emitOrderSocketEvents(req, order, {
      orderId: order._id,
      phone: phone10,
      email: customerEmail,
      deliveryOtp: otp,
      otpSentAt,
      orderStatus: order.orderStatus,
    });

    const deliveredVia = [
      emailStatus.sent ? `Email (${customerEmail})` : null,
      smsStatus.sent ? `SMS (+91 ${phone10})` : null,
    ].filter(Boolean);

    return res.status(200).json({
      message:
        deliveredVia.length > 0
          ? `Delivery OTP sent via ${deliveredVia.join(" & ")}!`
          : `Delivery OTP generated (${otp}) and synced to order.`,
      orderId: order._id,
      phone: phone10,
      email: customerEmail,
      deliveryOtp: otp,
      otpSentAt,
      orderStatus: order.orderStatus,
      emailStatus,
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