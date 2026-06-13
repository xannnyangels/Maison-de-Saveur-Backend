const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Maison de Saveur API' });
});

// Import Routes
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const recipesRoutes = require('./routes/recipes.routes');

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/recipes', recipesRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
