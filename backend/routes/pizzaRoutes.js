import express from 'express';
import {
  addIngredient,
  createPizza,
  deletePizza,
  getAllPizzas,
  getIngredients,
  updateIngredient,
  updatePizza,
} from '../controllers/pizzaController.js';
import { adminOnly, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Pre-built Pizzas
router.get('/', getAllPizzas);
router.post('/', protect, adminOnly, createPizza);
router.put('/:id', protect, adminOnly, updatePizza);
router.delete('/:id', protect, adminOnly, deletePizza);

// Ingredients (Custom Pizza Builder & Admin)
router.get('/ingredients', getIngredients);
router.post('/ingredients', protect, adminOnly, addIngredient);
router.put('/ingredients/:id', protect, adminOnly, updateIngredient);

export default router;