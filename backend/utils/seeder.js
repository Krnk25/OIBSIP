const Ingredient = require('../models/Ingredient');
const Pizza = require('../models/Pizza');

const seedInitialData = async () => {
  try {
    const ingredientCount = await Ingredient.countDocuments();
    if (ingredientCount === 0) {
      await Ingredient.insertMany([
        // 5 Pizza Bases
        { name: 'Classic Hand Tossed', category: 'base', price: 80, stock: 50, threshold: 15 },
        { name: 'Thin Crust', category: 'base', price: 90, stock: 50, threshold: 15 },
        { name: 'Cheese Burst', category: 'base', price: 140, stock: 40, threshold: 15 },
        { name: 'Wheat Thin Crust', category: 'base', price: 100, stock: 45, threshold: 15 },
        { name: 'Fresh Pan Pizza', category: 'base', price: 110, stock: 50, threshold: 15 },

        // 5 Sauces
        { name: 'Classic Marinara', category: 'sauce', price: 30, stock: 60, threshold: 20 },
        { name: 'Spicy Peri-Peri', category: 'sauce', price: 40, stock: 50, threshold: 20 },
        { name: 'Smoky BBQ', category: 'sauce', price: 45, stock: 50, threshold: 20 },
        { name: 'Creamy Alfredo', category: 'sauce', price: 50, stock: 40, threshold: 15 },
        { name: 'Basil Pesto', category: 'sauce', price: 55, stock: 35, threshold: 15 },

        // Cheese Selection
        { name: 'Mozzarella Cheese', category: 'cheese', price: 50, stock: 80, threshold: 20 },
        { name: 'Cheddar Blend', category: 'cheese', price: 60, stock: 60, threshold: 20 },
        { name: 'Extra Double Cheese', category: 'cheese', price: 85, stock: 50, threshold: 15 },

        // Veggies
        { name: 'Onion', category: 'veggie', price: 20, stock: 100, threshold: 25 },
        { name: 'Capsicum', category: 'veggie', price: 25, stock: 100, threshold: 25 },
        { name: 'Tomato', category: 'veggie', price: 20, stock: 100, threshold: 25 },
        { name: 'Sweet Corn', category: 'veggie', price: 30, stock: 90, threshold: 20 },
        { name: 'Black Olives', category: 'veggie', price: 35, stock: 70, threshold: 20 },
        { name: 'Jalapenos', category: 'veggie', price: 35, stock: 70, threshold: 20 },
        { name: 'Paneer Tikka Cubes', category: 'veggie', price: 55, stock: 60, threshold: 15 },
        { name: 'Mushrooms', category: 'veggie', price: 40, stock: 65, threshold: 15 },
      ]);
      console.log('🌱 Default Pizza Ingredients seeded!');
    }

    const pizzaCount = await Pizza.countDocuments();
    if (pizzaCount === 0) {
      await Pizza.insertMany([
        {
          name: 'Margherita Classic',
          description: 'Rich tomato marinara layered with 100% real mozzarella cheese.',
          image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600',
          category: 'Veg',
          prices: { small: 199, medium: 349, large: 499 },
        },
        {
          name: 'Farmhouse Fiesta',
          description: 'Loaded with crisp capsicum, onions, juicy tomatoes, and mushrooms.',
          image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
          category: 'Bestseller',
          prices: { small: 259, medium: 429, large: 599 },
        },
        {
          name: 'Peppy Paneer',
          description: 'Flavorful spiced paneer cubes, crisp capsicum, and spicy red paprika.',
          image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600',
          category: 'Bestseller',
          prices: { small: 279, medium: 459, large: 629 },
        },
        {
          name: 'Mexican Green Wave',
          description: 'Crunchy onions, capsicum, tomatoes, and fiery jalapenos with Mexican herbs.',
          image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=600',
          category: 'Veg',
          prices: { small: 269, medium: 439, large: 609 },
        },
      ]);
      console.log('🍕 Default Pizza Varieties seeded!');
    }
  } catch (error) {
    console.error('Seeder Error:', error.message);
  }
};

module.exports = seedInitialData;
