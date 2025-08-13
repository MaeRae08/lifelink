// --- 1. IMPORTS ---
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- 2. CREATE APP ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- 3. MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- 4. API ROUTES ---

// GET /api/drives - Fetches all blood drives
app.get('/api/drives', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM drives ORDER BY drive_date ASC');
        res.status(200).json(results);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ error: 'Failed to retrieve drives' });
    }
});

// --- AUTHENTICATION ROUTES ---

// POST /api/auth/signup - Registers a new user
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password || password.length < 6) {
            return res.status(400).json({ message: 'Please provide a valid email and a password of at least 6 characters.' });
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const query = 'INSERT INTO users (email, password_hash) VALUES (?, ?)';
        await db.query(query, [email, passwordHash]);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }
        console.error('Signup Error:', error);
        res.status(500).json({ message: 'An error occurred during registration.' });
    }
});

// POST /api/auth/login - Logs in a user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const query = 'SELECT * FROM users WHERE email = ?';
        const [users] = await db.query(query, [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const payload = { user: { id: user.id, email: user.email } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'An error occurred during login.' });
    }
});

// GET /api/auth/me - Gets the current logged-in user's data (NEW)
app.get('/api/auth/me', authenticateToken, (req, res) => {
    // The authenticateToken middleware already found the user and attached it to req.user
    res.status(200).json(req.user);
});


// --- MIDDLEWARE to verify JWT (our "Security Guard") ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (token == null) {
        return res.sendStatus(401); // Unauthorized - no token
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) {
            return res.sendStatus(403); // Forbidden - token is invalid
        }
        req.user = payload.user; // Attach user info to the request
        next(); // Proceed to the route handler
    });
}


// --- PROTECTED ROUTES ---

// POST /api/drives - Creates a new blood drive
app.post('/api/drives', authenticateToken, async (req, res) => {
    try {
        const { organizer_name, drive_date, location_name } = req.body;
        const userId = req.user.id;

        if (!organizer_name || !drive_date || !location_name) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        const query = 'INSERT INTO drives (user_id, organizer_name, drive_date, location_name) VALUES (?, ?, ?, ?)';
        await db.query(query, [userId, organizer_name, drive_date, location_name]);
        res.status(201).json({ message: 'Drive created successfully!' });
    } catch (error) {
        console.error('Create Drive Error:', error);
        res.status(500).json({ message: 'An error occurred while creating the drive.' });
    }
});

// DELETE /api/drives/:id - Deletes a drive (NEW)
app.delete('/api/drives/:id', authenticateToken, async (req, res) => {
    try {
        const driveId = req.params.id;
        const userId = req.user.id; // From the JWT payload

        // This query ensures users can only delete their OWN drives
        const query = 'DELETE FROM drives WHERE id = ? AND user_id = ?';
        const [result] = await db.query(query, [driveId, userId]);

        if (result.affectedRows === 0) {
            // This means the drive was not found OR the user is not the owner
            return res.status(404).json({ message: 'Drive not found or you do not have permission to delete it.' });
        }

        res.status(200).json({ message: 'Drive deleted successfully.' });

    } catch (error) {
        console.error('Delete Drive Error:', error);
        res.status(500).json({ message: 'An error occurred while deleting the drive.' });
    }
});

// PUT /api/drives/:id - Updates a drive (Protected)
app.put('/api/drives/:id', authenticateToken, async (req, res) => {
    try {
        const driveId = req.params.id;
        const userId = req.user.id;
        const { organizer_name, drive_date, location_name } = req.body;

        // Validation
        if (!organizer_name || !drive_date || !location_name) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Query to update the drive, ensuring the user is the owner
        const query = 'UPDATE drives SET organizer_name = ?, drive_date = ?, location_name = ? WHERE id = ? AND user_id = ?';
        const [result] = await db.query(query, [organizer_name, drive_date, location_name, driveId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Drive not found or you do not have permission to edit it.' });
        }

        res.status(200).json({ message: 'Drive updated successfully.' });

    } catch (error) {
        console.error('Update Drive Error:', error);
        res.status(500).json({ message: 'An error occurred while updating the drive.' });
    }
});

// --- 5. START SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});