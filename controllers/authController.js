const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { hashPassword, verifyPassword } = require('../utils/password');

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('ENV VAR MISSING: JWT_SECRET must be set in .env');
  }
  return jwt.sign({ id: user._id }, secret, { expiresIn: '7d' });
}

exports.signup = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('[AUTH][SIGNUP][START]', { username });
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: 'Username already taken' });

    const { salt, hash } = hashPassword(password);
    const user = await User.create({ username, passwordHash: hash, passwordSalt: salt });
    const token = signToken(user);
    console.log('[AUTH][SIGNUP][OK]', { userId: user._id.toString(), username: user.username });
    res.status(201).json({ token, user: { id: user._id, username: user.username } });
  } catch (err) {
    console.error('[AUTH][SIGNUP][ERR]', err?.message || err);
    res.status(500).json({ message: 'Signup failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('[AUTH][LOGIN][START]', { username });
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    console.log('[AUTH][LOGIN][OK]', { userId: user._id.toString(), username: user.username });
    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (err) {
    console.error('[AUTH][LOGIN][ERR]', err?.message || err);
    res.status(500).json({ message: 'Login failed' });
  }
};

// Return current authenticated user
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('_id username');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user._id, username: user.username });
  } catch (err) {
    console.error('Me endpoint error:', err);
    res.status(500).json({ message: 'Failed to fetch current user' });
  }
};

// Stateless logout (for symmetry with frontend). No server state to clear with JWT.
exports.logout = async (_req, res) => {
  return res.status(200).json({ success: true });
};
