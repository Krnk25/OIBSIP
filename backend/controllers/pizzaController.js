import Ingredient from "../models/Ingredient.js";
import Pizza from "../models/Pizza.js";

const toNonNegativeNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

const toPositiveThreshold = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 1 ? num : fallback;
};

const normalizeCategory = (category) => {
  const raw = String(category || "Veg").toLowerCase().trim();
  if (raw === "non-veg" || raw === "nonveg") return "Non-Veg";
  if (raw === "special") return "Special";
  return "Veg";
};

// @desc    Get all pre-built pizzas
// @route   GET /api/pizzas
export const getAllPizzas = async (req, res) => {
  try {
    const pizzas = await Pizza.find().sort({ createdAt: -1 });
    return res.status(200).json(pizzas);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new pre-built pizza with stock (Admin only)
// @route   POST /api/pizzas
export const createPizza = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Pizza name is required" });
    }

    const stock = toNonNegativeNumber(req.body.stock, 40);
    const threshold = toPositiveThreshold(req.body.threshold, 10);

    const basePrice = toNonNegativeNumber(
      req.body.price ?? req.body.prices?.medium,
      299
    );

    const normalizedCategory = normalizeCategory(req.body.category);

    const payload = {
      ...req.body,
      name,
      category: normalizedCategory,
      description:
        String(req.body.description || "").trim() ||
        "Freshly baked artisanal pizza from PizzaHouse.",
      image:
        String(req.body.image || "").trim() ||
        "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500",
      prices: {
        small: toNonNegativeNumber(
          req.body.prices?.small,
          Math.max(99, basePrice - 70)
        ),
        medium: toNonNegativeNumber(req.body.prices?.medium, basePrice),
        large: toNonNegativeNumber(req.body.prices?.large, basePrice + 100),
      },
      stock,
      threshold,
      isAvailable:
        typeof req.body.isAvailable === "boolean"
          ? req.body.isAvailable && stock > 0
          : stock > 0,
    };

    const pizza = await Pizza.create(payload);
    return res.status(201).json(pizza);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// @desc    Update an existing pre-built pizza / stock (Admin only)
// @route   PUT /api/pizzas/:id
export const updatePizza = async (req, res) => {
  try {
    const existing = await Pizza.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Pizza not found" });
    }

    const updateData = { ...req.body };

    if (req.body.category !== undefined) {
      updateData.category = normalizeCategory(req.body.category);
    }

    if (req.body.price !== undefined) {
      const basePrice = toNonNegativeNumber(
        req.body.price,
        existing.prices?.medium ?? 299
      );
      updateData.prices = {
        small: toNonNegativeNumber(
          req.body.prices?.small,
          existing.prices?.small ?? Math.max(99, basePrice - 70)
        ),
        medium: toNonNegativeNumber(req.body.prices?.medium, basePrice),
        large: toNonNegativeNumber(
          req.body.prices?.large,
          existing.prices?.large ?? basePrice + 100
        ),
      };
    }

    if (req.body.threshold !== undefined) {
      updateData.threshold = toPositiveThreshold(
        req.body.threshold,
        existing.threshold ?? 10
      );
    }

    if (req.body.stock !== undefined) {
      const nextStock = toNonNegativeNumber(
        req.body.stock,
        existing.stock ?? 0
      );
      updateData.stock = nextStock;
      if (typeof req.body.isAvailable !== "boolean") {
        updateData.isAvailable = nextStock > 0;
      }
    }

    const pizza = await Pizza.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json(pizza);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a pre-built pizza (Admin only)
// @route   DELETE /api/pizzas/:id
export const deletePizza = async (req, res) => {
  try {
    const pizza = await Pizza.findByIdAndDelete(req.params.id);
    if (!pizza) {
      return res.status(404).json({ message: "Pizza not found" });
    }
    return res.status(200).json({ message: "Pizza deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all ingredients grouped by category (for Custom Pizza Builder & Admin)
// @route   GET /api/pizzas/ingredients
export const getIngredients = async (req, res) => {
  try {
    const ingredients = await Ingredient.find();
    return res.status(200).json(ingredients);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add a new ingredient (Admin only)
// @route   POST /api/pizzas/ingredients
export const addIngredient = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Ingredient name is required" });
    }

    const payload = {
      ...req.body,
      name,
      price: toNonNegativeNumber(req.body.price, 0),
      stock: toNonNegativeNumber(req.body.stock, 50),
      threshold: toPositiveThreshold(req.body.threshold, 20),
    };

    const ingredient = await Ingredient.create(payload);
    return res.status(201).json(ingredient);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// @desc    Update ingredient stock or price (Admin only)
// @route   PUT /api/pizzas/ingredients/:id
export const updateIngredient = async (req, res) => {
  try {
    const existing = await Ingredient.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Ingredient not found" });
    }

    const updateData = { ...req.body };

    if (req.body.price !== undefined) {
      updateData.price = toNonNegativeNumber(req.body.price, existing.price);
    }
    if (req.body.stock !== undefined) {
      updateData.stock = toNonNegativeNumber(
        req.body.stock,
        existing.stock ?? 0
      );
    }
    if (req.body.threshold !== undefined) {
      updateData.threshold = toPositiveThreshold(
        req.body.threshold,
        existing.threshold ?? 20
      );
    }

    const ingredient = await Ingredient.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    return res.status(200).json(ingredient);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};