const User = require('../models/User');

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash -passwordSalt');
  res.json(user);
};

exports.updateMe = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: 'Nothing to update' });
    const exists = await User.findOne({ username, _id: { $ne: req.user.id } });
    if (exists) return res.status(409).json({ message: 'Username already taken' });

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { username },
      { new: true }
    ).select('-passwordHash -passwordSalt');

    res.json(updated);
  } catch (err) {
    console.error('Update me error:', err);
    res.status(500).json({ message: 'Update failed' });
  }
};
