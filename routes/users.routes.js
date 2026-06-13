const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const uploadMiddleware = require('../middlewares/upload.middleware');

// Semua rute user dilindungi oleh JWT
router.use(authMiddleware);

router.get('/me', usersController.getMe);
router.put('/me', usersController.updateMe);
router.put('/me/photo', uploadMiddleware.single('photo'), usersController.updatePhoto);
router.get('/me/recipes', usersController.getMyRecipes);

module.exports = router;
