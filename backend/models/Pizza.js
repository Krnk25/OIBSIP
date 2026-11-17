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
    },
    image: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['Veg', 'Non-Veg', 'Bestseller'],
      default: 'Veg',
    },
    prices: {
      small: { type: Number, required: true },
      medium: { type: Number, required: true },
      large: { type: Number, required: true },
    },
    defaultIngredients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ingredient',
      },
    ],
  },
  { timestamps: true }
);

const Pizza = mongoose.model('Pizza', pizzaSchema);
export default Pizza;