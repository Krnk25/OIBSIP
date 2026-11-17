import Ingredient from '../models/Ingredient.js';
import Pizza from '../models/Pizza.js';

// @desc    Get all pre-built pizzas
// @route   GET /api/pizzas
export const getAllPizzas = async (req, res) => {
  try {
    const pizzas = await Pizza.find();
    res.status(200).json(pizzas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all ingredients grouped by category (for Custom Pizza Builder & Admin)
// @route   GET /api/pizzas/ingredients
export const getIngredients = async (req, res) => {
  try {
    const ingredients = await Ingredient.find();
    res.status(200).json(ingredients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a new ingredient (Admin only)
// @route   POST /api/pizzas/ingredients
export const addIngredient = async (req, res) => {
  try {
    const ingredient = await Ingredient.create(req.body);
    res.status(201).json(ingredient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update ingredient stock or price (Admin only)
// @route   PUT /api/pizzas/ingredients/:id
export const updateIngredient = async (req, res) => {
  try {
    const ingredient = await Ingredient.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    res.status(200).json(ingredient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};