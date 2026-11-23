import mongoose from 'mongoose';

const pizzaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Veg', 'Non-Veg', 'Special'],
      default: 'Veg',
    },
    image: {
      type: String,
      required: true,
    },
    prices: {
      small: { type: Number, required: true },
      medium: { type: Number, required: true },
      large: { type: Number, required: true },
    },
    stock: {
      type: Number,
      default: 40,
      min: 0,
    },
    threshold: {
      type: Number,
      default: 10,
      min: 1,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Pizza', pizzaSchema);