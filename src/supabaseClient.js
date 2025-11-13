// // src/supabaseClient.js
// const path = require('path');
// const dotenv = require('dotenv');
// const { createClient } = require('@supabase/supabase-js');

// // Force .env to load from your extension root
// dotenv.config({ path: path.join(__dirname, '..', '.env') });

// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// console.log("🌍 ENV CHECK:", {
//   SUPABASE_URL: supabaseUrl,
//   SUPABASE_ANON_KEY: !!supabaseAnonKey
// });

// if (!supabaseUrl || !supabaseAnonKey) {
//   throw new Error("supabaseUrl and supabaseAnonKey are required.");
// }

// const supabase = createClient(supabaseUrl, supabaseAnonKey);
// console.log(`✅ Supabase client initialized for: ${supabaseUrl}`);

// module.exports = { supabase };

const { createClient } = require("@supabase/supabase-js");

// Use environment variables for Node.js
const SUPABASE_URL = process.env.SUPABASE_URL || "https://your-project-url.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "your-anon-key";

// Log once to confirm it's set up
console.log("✅ Supabase client initialized:", SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = { supabase };

