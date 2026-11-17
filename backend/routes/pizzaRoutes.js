import express from 'express';
import {
  addIngredient,
  getAllPizzas,
  getIngredients,
  updateIngredient,
} from '../controllers/pizzaController.js';
import { adminOnly, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getAllPizzas);
router.get('/ingredients', getIngredients);
router.post('/ingredients', protect, adminOnly, addIngredient);
router.put('/ingredients/:id', protect, adminOnly, updateIngredient);

export default router;