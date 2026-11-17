import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [
      {
        name: { type: String, required: true },
        isCustom: { type: Boolean, default: false },
        size: { type: String, default: 'medium' },
        quantity: { type: Number, required: true, default: 1 },
        price: { type: Number, required: true },
        // कस्टमाइज्ड पिझ्झासाठी निवडलेले इंग्रेडियंट्स (स्टॉक कमी करण्यासाठी IDs सहित)
        customDetails: {
          base: { id: mongoose.Schema.Types.ObjectId, name: String },
          sauce: { id: mongoose.Schema.Types.ObjectId, name: String },
          cheese: { id: mongoose.Schema.Types.ObjectId, name: String },
          veggies: [{ id: mongoose.Schema.Types.ObjectId, name: String }],
        },
      },
    ],
    deliveryAddress: {
      type: String,
      required: [true, 'Delivery address is required'],
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentInfo: {
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      status: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending',
      },
    },
    orderStatus: {
      type: String,
      enum: ['Order Received', 'In the Kitchen', 'Sent to Delivery', 'Delivered'],
      default: 'Order Received',
    },
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);

export default Order;