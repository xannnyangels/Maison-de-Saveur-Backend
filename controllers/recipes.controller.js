const supabase = require('../config/supabase');

exports.getAllRecipes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { data: recipes, error, count } = await supabase
      .from('recipes')
      .select(`
        id, title, photo_url, created_at,
        uploader:users ( id, username, profile_photo_url )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.status(200).json({
      recipes,
      pagination: {
        current_page: page,
        total_pages: Math.ceil((count || 0) / limit),
        total_recipes: count || 0
      }
    });
  } catch (error) {
    console.error('Get All Recipes Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};

exports.getRecipeById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select(`
        id, title, description, photo_url, created_at,
        uploader:users ( id, username, profile_photo_url )
      `)
      .eq('id', id)
      .single();

    if (recipeError || !recipe) {
      return res.status(404).json({ error: 'Resep tidak ditemukan.' });
    }

    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('id, name, order_index')
      .eq('recipe_id', id)
      .order('order_index', { ascending: true });

    const { data: steps } = await supabase
      .from('steps')
      .select('id, instruction, order_index')
      .eq('recipe_id', id)
      .order('order_index', { ascending: true });

    res.status(200).json({
      ...recipe,
      ingredients: ingredients || [],
      steps: steps || []
    });
  } catch (error) {
    console.error('Get Recipe By ID Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
};

exports.createRecipe = async (req, res) => {
  let uploadedPhotoPath = null;
  let newRecipeId = null;

  try {
    const userId = req.user.id;
    const { title, description } = req.body;
    let { ingredients, steps } = req.body;
    const file = req.file;

    if (!title || !file) {
      return res.status(400).json({ error: 'Judul dan foto resep wajib diisi.' });
    }

    try {
      ingredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
      steps = typeof steps === 'string' ? JSON.parse(steps) : steps;
    } catch (e) {
      return res.status(400).json({ error: 'Format ingredients/steps tidak valid.' });
    }

    if (!ingredients || ingredients.length === 0) return res.status(400).json({ error: 'Minimal 1 bahan wajib diisi.' });
    if (!steps || steps.length === 0) return res.status(400).json({ error: 'Minimal 1 langkah wajib diisi.' });

    const fileExt = file.originalname.split('.').pop();
    uploadedPhotoPath = `recipes/user_${userId}_${Date.now()}.${fileExt}`;
    
    let mimeType = file.mimetype;
    if (mimeType === 'application/octet-stream') {
      const ext = file.originalname.split('.').pop().toLowerCase();
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }
    
    const { error: uploadError } = await supabase.storage
      .from('maison_uploads')
      .upload(uploadedPhotoPath, file.buffer, { contentType: mimeType });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('maison_uploads').getPublicUrl(uploadedPhotoPath);
    const publicUrl = publicUrlData.publicUrl;

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert([{ user_id: userId, title, description, photo_url: publicUrl }])
      .select()
      .single();

    if (recipeError) throw recipeError;
    newRecipeId = recipe.id;

    const ingredientsToInsert = ingredients.map((ing, i) => ({
      recipe_id: newRecipeId,
      name: ing.name || ing,
      order_index: ing.order_index || i + 1
    }));
    const { error: ingError } = await supabase.from('ingredients').insert(ingredientsToInsert);
    if (ingError) throw ingError;

    const stepsToInsert = steps.map((st, i) => ({
      recipe_id: newRecipeId,
      instruction: st.instruction || st,
      order_index: st.order_index || i + 1
    }));
    const { error: stepError } = await supabase.from('steps').insert(stepsToInsert);
    if (stepError) throw stepError;

    res.status(201).json({
      message: 'Resep berhasil diupload',
      recipe: {
        ...recipe,
        ingredients: ingredientsToInsert,
        steps: stepsToInsert
      }
    });
  } catch (error) {
    console.error('Create Recipe Error:', error);
    
    if (newRecipeId) {
      await supabase.from('recipes').delete().eq('id', newRecipeId);
    }
    if (uploadedPhotoPath) {
      await supabase.storage.from('maison_uploads').remove([uploadedPhotoPath]);
    }

    res.status(500).json({ error: 'Terjadi kesalahan saat membuat resep.' });
  }
};

exports.updateRecipe = async (req, res) => {
  let uploadedPhotoPath = null;
  let oldPhotoPath = null;

  try {
    const userId = req.user.id;
    const recipeId = req.params.id;
    const { title, description } = req.body;
    let { ingredients, steps } = req.body;
    const file = req.file;

    const { data: existingRecipe, error: fetchError } = await supabase
      .from('recipes')
      .select('user_id, photo_url')
      .eq('id', recipeId)
      .single();

    if (fetchError || !existingRecipe) return res.status(404).json({ error: 'Resep tidak ditemukan.' });
    if (existingRecipe.user_id !== userId) return res.status(403).json({ error: 'Akses ditolak.' });

    let photoUrlToSave = existingRecipe.photo_url;

    if (file) {
      const fileExt = file.originalname.split('.').pop();
      uploadedPhotoPath = `recipes/user_${userId}_${Date.now()}.${fileExt}`;
      
      let mimeType = file.mimetype;
      if (mimeType === 'application/octet-stream') {
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      }

      const { error: uploadError } = await supabase.storage
        .from('maison_uploads')
        .upload(uploadedPhotoPath, file.buffer, { contentType: mimeType });

      if (uploadError) throw uploadError;

      photoUrlToSave = supabase.storage.from('maison_uploads').getPublicUrl(uploadedPhotoPath).data.publicUrl;
      
      const matches = existingRecipe.photo_url.match(/maison_uploads\/(.*)$/);
      if (matches && matches[1]) {
        oldPhotoPath = matches[1];
      }
    }

    const { error: updateError } = await supabase
      .from('recipes')
      .update({ title, description, photo_url: photoUrlToSave })
      .eq('id', recipeId);

    if (updateError) throw updateError;

    if (ingredients) {
      try { ingredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients; } catch(e){}
      await supabase.from('ingredients').delete().eq('recipe_id', recipeId);
      
      const ingredientsToInsert = ingredients.map((ing, i) => ({
        recipe_id: recipeId, name: ing.name || ing, order_index: ing.order_index || i + 1
      }));
      await supabase.from('ingredients').insert(ingredientsToInsert);
    }

    if (steps) {
      try { steps = typeof steps === 'string' ? JSON.parse(steps) : steps; } catch(e){}
      await supabase.from('steps').delete().eq('recipe_id', recipeId);
      
      const stepsToInsert = steps.map((st, i) => ({
        recipe_id: recipeId, instruction: st.instruction || st, order_index: st.order_index || i + 1
      }));
      await supabase.from('steps').insert(stepsToInsert);
    }

    if (oldPhotoPath) {
      await supabase.storage.from('maison_uploads').remove([oldPhotoPath]);
    }

    res.status(200).json({ message: 'Resep berhasil diperbarui' });
  } catch (error) {
    console.error('Update Recipe Error:', error);
    if (uploadedPhotoPath) {
      await supabase.storage.from('maison_uploads').remove([uploadedPhotoPath]);
    }
    res.status(500).json({ error: 'Terjadi kesalahan saat mengupdate resep.' });
  }
};

exports.deleteRecipe = async (req, res) => {
  try {
    const userId = req.user.id;
    const recipeId = req.params.id;

    const { data: recipe, error: fetchError } = await supabase
      .from('recipes')
      .select('user_id, photo_url')
      .eq('id', recipeId)
      .single();

    if (fetchError || !recipe) return res.status(404).json({ error: 'Resep tidak ditemukan.' });
    if (recipe.user_id !== userId) return res.status(403).json({ error: 'Akses ditolak.' });

    const matches = recipe.photo_url.match(/maison_uploads\/(.*)$/);
    if (matches && matches[1]) {
      await supabase.storage.from('maison_uploads').remove([matches[1]]);
    }

    const { error: deleteError } = await supabase.from('recipes').delete().eq('id', recipeId);
    if (deleteError) throw deleteError;

    res.status(200).json({ message: 'Resep berhasil dihapus' });
  } catch (error) {
    console.error('Delete Recipe Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat menghapus resep.' });
  }
};
