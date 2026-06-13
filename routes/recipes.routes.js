const express = require('express');
const router = express.Router();
const recipesController = require('../controllers/recipes.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const uploadMiddleware = require('../middlewares/upload.middleware');

// Route Publik
router.get('/', recipesController.getAllRecipes);
router.get('/:id', recipesController.getRecipeById);

// Route Privat
router.use(authMiddleware);
router.post('/', uploadMiddleware.single('photo'), recipesController.createRecipe);
router.put('/:id', uploadMiddleware.single('photo'), recipesController.updateRecipe);
router.delete('/:id', recipesController.deleteRecipe);

module.exports = router;
