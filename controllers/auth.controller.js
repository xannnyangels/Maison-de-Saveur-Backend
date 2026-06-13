const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '7d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, dan password wajib diisi.' });
    }

    if (username.length < 3) return res.status(400).json({ error: 'Username minimal 3 karakter.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });

    const { data: existingEmail } = await supabase.from('users').select('id').eq('email', email).single();
    if (existingEmail) return res.status(400).json({ error: 'Email sudah terdaftar.' });

    const { data: existingUsername } = await supabase.from('users').select('id').eq('username', username).single();
    if (existingUsername) return res.status(400).json({ error: 'Username sudah dipakai.' });

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ username, email, password_hash: passwordHash }])
      .select('id, username, email, profile_photo_url, bio')
      .single();

    if (insertError) throw insertError;

    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Registrasi berhasil',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, password_hash, profile_photo_url, bio')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    delete user.password_hash;

    const token = generateToken(user);

    res.status(200).json({
      message: 'Login berhasil',
      token,
      user
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};
