// --- 1. IMPORTS ---
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// axios is no longer needed, so it has been removed.

// --- 2. CREATE APP ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- 3. MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- 4. API ROUTES ---

// NEW: GET /api/locations - Fetches all locations for the dropdown
app.get('/api/locations', async (req, res) => {
    try {
        const [locations] = await db.query('SELECT * FROM locations ORDER BY name ASC');
        res.status(200).json(locations);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ message: 'Failed to retrieve locations' });
    }
});

// UPDATED: GET /api/drives - Joins with locations table
app.get('/api/drives', async (req, res) => {
    try {
        // This query now joins the two tables to get all necessary info at once.
        const query = `
            SELECT 
                d.id, 
                d.user_id, 
                d.organizer_name, 
                d.drive_date, 
                l.name AS location_name, 
                l.latitude, 
                l.longitude
            FROM drives d
            JOIN locations l ON d.location_id = l.id
            ORDER BY d.drive_date ASC
        `;
        const [results] = await db.query(query);
        res.status(200).json(results);
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ message: 'Failed to retrieve drives' });
    }
});


// --- AUTHENTICATION ROUTES (No changes here) ---
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

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.status(200).json(req.user);
});


// --- MIDDLEWARE to verify JWT (No changes here) ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
        if (err) return res.sendStatus(403);
        req.user = payload.user;
        next();
    });
}


// --- PROTECTED ROUTES ---

// UPDATED: POST /api/drives - Now uses location_id
app.post('/api/drives', authenticateToken, async (req, res) => {
    try {
        // Now expecting location_id instead of location_name
        const { organizer_name, drive_date, location_id } = req.body;
        const userId = req.user.id;

        if (!organizer_name || !drive_date || !location_id) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        
        // The query is now much simpler and more reliable.
        const query = 'INSERT INTO drives (user_id, organizer_name, drive_date, location_id) VALUES (?, ?, ?, ?)';
        await db.query(query, [userId, organizer_name, drive_date, location_id]);
        
        res.status(201).json({ message: 'Drive created successfully!' });

    } catch (error) {
        console.error('Create Drive Error:', error.message);
        res.status(500).json({ message: 'An error occurred while creating the drive.' });
    }
});

// DELETE /api/drives/:id (No changes here)
app.delete('/api/drives/:id', authenticateToken, async (req, res) => {
    try {
        const driveId = req.params.id;
        const userId = req.user.id;
        const query = 'DELETE FROM drives WHERE id = ? AND user_id = ?';
        const [result] = await db.query(query, [driveId, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Drive not found or you do not have permission to delete it.' });
        }
        res.status(200).json({ message: 'Drive deleted successfully.' });
    } catch (error) {
        console.error('Delete Drive Error:', error);
        res.status(500).json({ message: 'An error occurred while deleting the drive.' });
    }
});

// UPDATED: PUT /api/drives/:id - Now uses location_id
app.put('/api/drives/:id', authenticateToken, async (req, res) => {
    try {
        const driveId = req.params.id;
        const userId = req.user.id;
        const { organizer_name, drive_date, location_id } = req.body;

        if (!organizer_name || !drive_date || !location_id) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const query = 'UPDATE drives SET organizer_name = ?, drive_date = ?, location_id = ? WHERE id = ? AND user_id = ?';
        const [result] = await db.query(query, [organizer_name, drive_date, location_id, driveId, userId]);

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
