// supabaseClient.js
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// ✅ Make absolutely sure the .env file exists and load it
const envPath = path.resolve(__dirname, ".env");

if (fs.existsSync(envPath)) {
  console.log("🟢 Loading .env from:", envPath);
  dotenv.config({ path: envPath });
} else {
  console.error("❌ .env file not found at:", envPath);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log("🌍 ENV CHECK:", {
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: !!supabaseAnonKey,
});

if (!supabaseUrl) {
  throw new Error("supabaseUrl is required.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log("✅ Supabase client initialized for:", supabaseUrl);

module.exports = { supabase };
