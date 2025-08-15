const crypto = require('crypto');

const iterations = 310000;
const keylen = 32;
const digest = 'sha256';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const hashed = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hashed, 'hex'), Buffer.from(hash, 'hex'));
}

module.exports = { hashPassword, verifyPassword };
