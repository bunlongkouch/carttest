require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken'); // Assuming JWT for authentication

const app = express();
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Define Schema before using it
const CartSchema = new mongoose.Schema({
    userId: String,
    products: [{ productId: String, name: String, price: Number, quantity: Number }]
});

const Cart = mongoose.model('Cart', CartSchema);

// Middleware to authenticate the user using JWT
function authenticateUser(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', ''); // Remove "Bearer " prefix

    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;  // Attach the decoded token (which includes userId) to the req.user object
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: 'Token is not valid' });
    }
}




// Login Route to generate JWT token
app.post('/login', async (req, res) => {
    const { userId, password } = req.body;
    if (userId && password) {
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token });
    }

    return res.status(400).json({ message: 'Invalid credentials' });
});

// Add product to cart
app.post('/cart/add', authenticateUser, async (req, res) => {
    const { productId, name, price, quantity } = req.body;
    const userId = req.user.id;  // Get userId from the decoded JWT token

    let cart = await Cart.findOne({ userId });

    if (!cart) {
        cart = new Cart({ userId, products: [] });
    }

    const existingProduct = cart.products.find(p => p.productId === productId);
    if (existingProduct) {
        existingProduct.quantity += quantity;
    } else {
        cart.products.push({ productId, name, price, quantity });
    }

    await cart.save();
    res.json({ message: 'Product added to cart', cart });
});


// Get cart details - Authentication required
app.get('/cart', authenticateUser, async (req, res) => {
    const userId = req.user.id; // Get user ID from token
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: 'Cart is empty' });

    res.json(cart);
});

// Start the server using the port from the .env file
const PORT = process.env.PORT || 5000; // Fallback to 5000 if the PORT is not defined in the .env
app.listen(PORT, () => {
    console.log(`Cart microservice running on port ${PORT}`);
});
