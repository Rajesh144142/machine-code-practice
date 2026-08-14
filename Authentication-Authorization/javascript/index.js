const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./DB/db.configure');

// Run table creation to ensure tables exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
});

const app = express();
app.use(express.json());

const ACCESS_TOKEN_SECRET = 'access_secret_key_123';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Authentication Middleware
const authmiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'Not authorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ msg: 'Not authorized: Invalid or expired token' });
    }
    req.user = decoded; // Attach user info (id, email)
    next();
  });
};

app.get('/', (req, res) => {
  res.json({ msg: 'working fine..' });
});

// Sign-Up Route
app.post('/sign-up', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: 'Email and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.run(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, email, passwordHash],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ msg: 'Email already registered' });
          }
          return res.status(500).json({ msg: 'Database error', error: err.message });
        }
        res.status(201).json({ msg: 'User registered successfully', userId });
      }
    );
  } catch (error) {
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// Sign-In Route
app.post('/sign-in', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ msg: 'Database error', error: err.message });
    }
    if (!user) {
      return res.status(401).json({ msg: 'Invalid email or password' });
    }

    try {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ msg: 'Invalid email or password' });
      }

      // Generate Access Token (JWT)
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      // Generate Refresh Token
      const refreshToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

      // Save Refresh Token in DB
      const tokenId = uuidv4();
      db.run(
        'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
        [tokenId, user.id, refreshToken, expiresAt.toISOString()],
        (dbErr) => {
          if (dbErr) {
            return res.status(500).json({ msg: 'Database error storing token', error: dbErr.message });
          }
          res.json({ accessToken, refreshToken });
        }
      );
    } catch (error) {
      res.status(500).json({ msg: 'Server error', error: error.message });
    }
  });
});

// Token Refresh Route
app.post('/token', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ msg: 'Refresh token is required' });
  }

  db.get('SELECT * FROM refresh_tokens WHERE token = ?', [refreshToken], (err, row) => {
    if (err) {
      return res.status(500).json({ msg: 'Database error', error: err.message });
    }
    if (!row) {
      return res.status(403).json({ msg: 'Invalid refresh token' });
    }

    const expiresAt = new Date(row.expires_at);
    if (expiresAt < new Date()) {
      // Token expired, clean it up from DB
      db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      return res.status(403).json({ msg: 'Refresh token expired' });
    }

    // Fetch user details to sign new JWT
    db.get('SELECT id, email FROM users WHERE id = ?', [row.user_id], (userErr, user) => {
      if (userErr || !user) {
        return res.status(500).json({ msg: 'User error', error: userErr?.message });
      }

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: user.id, email: user.email },
        ACCESS_TOKEN_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      res.json({ accessToken });
    });
  });
});

// Logout Route
app.post('/logout', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ msg: 'Refresh token is required' });
  }

  db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken], function (err) {
    if (err) {
      return res.status(500).json({ msg: 'Database error', error: err.message });
    }
    res.json({ msg: 'Logged out successfully' });
  });
});

// Protected Route Example
app.get('/protected', authmiddleware, (req, res) => {
  res.json({ msg: 'Access granted to protected route', user: req.user });
});

app.listen(8000, () => {
  console.log('running on http://localhost:8000');
});
