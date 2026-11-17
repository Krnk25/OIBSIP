import mongoose from 'mongoose';

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['base', 'sauce', 'cheese', 'veggie', 'meat'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
    },
    threshold: {
      type: Number,
      default: 20, // यापेक्षा कमी स्टॉक झाल्यास Admin ला Alert जाईल
    },
  },
  { timestamps: true }
);

const Ingredient = mongoose.model('Ingredient', ingredientSchema);
export default Ingredient;