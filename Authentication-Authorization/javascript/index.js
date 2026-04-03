const express = require('express');
const db = require('./DB/db.configure')

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

const authmiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ msg: 'not authorized' });
  }
  next();
};

app.get('/', (req, res) => {
  res.json({ msg: 'working fine..' });
});

// auth routes (NO middleware)
app.post('/sign-up', (req, res) => {});
app.post('/sign-in', (req, res) => {});
app.post('/logout', (req, res) => {});

// protected example
app.get('/protected', authmiddleware, (req, res) => {
  res.json({ msg: 'protected route' });
});

app.listen(8000, () => {
  console.log('running on http://localhost:8000');
});
