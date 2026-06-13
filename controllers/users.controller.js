const supabase = require('../config/supabase');

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, profile_photo_url, bio, created_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Get Me Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, bio } = req.body;

    if (username) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(400).json({ error: 'Username sudah dipakai oleh pengguna lain.' });
      }
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ username, bio })
      .eq('id', userId)
      .select('id, username, bio, profile_photo_url')
      .single();

    if (error) throw error;

    res.status(200).json({
      message: 'Profil berhasil diperbarui',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update Me Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};

exports.updatePhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'File foto tidak ditemukan dalam request.' });
    }

    const { data: currentUser } = await supabase.from('users').select('profile_photo_url').eq('id', userId).single();

    const fileExt = file.originalname.split('.').pop();
    const fileName = `profile_${userId}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    let mimeType = file.mimetype;
    if (mimeType === 'application/octet-stream') {
      const ext = file.originalname.split('.').pop().toLowerCase();
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }

    const { error: uploadError } = await supabase.storage
      .from('maison_uploads')
      .upload(filePath, file.buffer, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('maison_uploads')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    if (currentUser && currentUser.profile_photo_url) {
      const oldUrl = currentUser.profile_photo_url;
      const matches = oldUrl.match(/maison_uploads\/(.*)$/);
      if (matches && matches[1]) {
        const oldFilePath = matches[1];
        await supabase.storage.from('maison_uploads').remove([oldFilePath]);
      }
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_photo_url: publicUrl })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.status(200).json({
      message: 'Foto profil berhasil diperbarui',
      profile_photo_url: publicUrl
    });
  } catch (error) {
    console.error('Update Photo Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengunggah foto.' });
  }
};

exports.getMyRecipes = async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, title, photo_url, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ recipes });
  } catch (error) {
    console.error('Get My Recipes Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};

