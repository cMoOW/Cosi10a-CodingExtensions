// src/supabaseClient.js
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Lazy load Supabase client to avoid breaking extension activation
let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Force .env to load from your extension root
  dotenv.config({ path: path.join(__dirname, '..', '.env') });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  console.log("🌍 ENV CHECK:", {
    SUPABASE_URL: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT FOUND',
    SUPABASE_ANON_KEY: !!supabaseAnonKey
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error("supabaseUrl and supabaseAnonKey are required. Please check your .env file.");
    console.error("❌ Supabase initialization failed:", error.message);
    throw error;
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  console.log(`✅ Supabase client initialized for: ${supabaseUrl.substring(0, 30)}...`);
  
  return supabaseClient;
}

// Export both the lazy getter and a direct reference for backward compatibility
module.exports = { 
  get supabase() {
    return getSupabase();
  },
  getSupabase
};
