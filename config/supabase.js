require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase URL and Key are missing in .env file!');
}

const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'placeholder');

module.exports = supabase;
