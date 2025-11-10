// test-supabase-connection.js
// Quick test script to verify Supabase connection
// Run with: node test-supabase-connection.js

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials!');
    console.error('Please create a .env file with:');
    console.error('  SUPABASE_URL=https://xxxxx.supabase.co');
    console.error('  SUPABASE_ANON_KEY=eyJhbGc...');
    process.exit(1);
  }

  console.log('✅ Environment variables loaded');
  console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
  console.log(`   Key: ${supabaseAnonKey.substring(0, 30)}...\n`);

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Test 1: Check if we can read from tickets table
  console.log('📊 Test 1: Reading from tickets table...');
  const { data: tickets, error: readError } = await supabase
    .from('tickets')
    .select('id, student_email, status')
    .limit(5);

  if (readError) {
    console.error('❌ Failed to read from tickets table:', readError.message);
    console.error('   Make sure:');
    console.error('   - Table "tickets" exists in Supabase');
    console.error('   - RLS policies allow SELECT');
    process.exit(1);
  }

  console.log(`✅ Successfully read ${tickets.length} ticket(s) from database\n`);

  // Test 2: Try to create a test ticket
  console.log('📝 Test 2: Creating a test ticket...');
  const testTicket = {
    student_email: 'test@brandeis.edu',
    message: 'This is a test ticket from connection test script',
    highlighted_code: 'print("Hello World")',
    full_code: 'print("Hello World")\nprint("Test")',
    status: 'open',
    priority: 'medium'
  };

  const { data: newTicket, error: insertError } = await supabase
    .from('tickets')
    .insert([testTicket])
    .select()
    .single();

  if (insertError) {
    console.error('❌ Failed to create ticket:', insertError.message);
    console.error('   Make sure:');
    console.error('   - RLS policies allow INSERT');
    console.error('   - All required fields are present');
    process.exit(1);
  }

  console.log(`✅ Successfully created test ticket!`);
  console.log(`   Ticket ID: ${newTicket.id}`);
  console.log(`   Status: ${newTicket.status}\n`);

  // Test 3: Clean up test ticket (optional)
  console.log('🧹 Test 3: Cleaning up test ticket...');
  const { error: deleteError } = await supabase
    .from('tickets')
    .delete()
    .eq('id', newTicket.id);

  if (deleteError) {
    console.warn('⚠️  Could not delete test ticket (this is okay if RLS prevents deletion)');
    console.warn(`   You can manually delete ticket ${newTicket.id} from Supabase dashboard`);
  } else {
    console.log('✅ Test ticket deleted successfully\n');
  }

  console.log('🎉 All tests passed! Supabase connection is working correctly.');
  console.log('\nYou can now use the VS Code extension to create tickets.');
}

// Run the test
testConnection().catch(error => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});

