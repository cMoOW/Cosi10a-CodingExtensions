// create-ticket.js
// Creates tickets in Supabase instead of sending emails directly

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Lazy-load Supabase client to avoid breaking extension activation
let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Load environment variables from .env file
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  
  let supabaseUrl = process.env.SUPABASE_URL;
  let supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

/**
 * Creates a ticket in Supabase database
 * @param {Object} ticketData - The ticket data
 * @param {string} ticketData.studentEmail - Student's Brandeis email
 * @param {string} ticketData.message - Student's message/question
 * @param {string} ticketData.highlightedCode - Selected/highlighted code snippet
 * @param {string} ticketData.fullCode - Full document code
 * @param {string} ticketData.filePath - Path to the file (optional)
 * @param {string} ticketData.fileName - Just the filename (optional)
 * @param {string} ticketData.language - Programming language (optional)
 * @param {string[]} ticketData.taEmails - Array of TA emails (optional)
 * @returns {Promise<Object>} The created ticket object with id
 */
async function createTicket(ticketData) {
  const {
    studentEmail,
    message,
    highlightedCode,
    fullCode,
    filePath = null,
    fileName = null,
    language = null,
    taEmails = []
  } = ticketData;

  // Validate required fields
  if (!studentEmail || !message) {
    throw new Error('Student email and message are required');
  }

  // Validate Brandeis email
  if (!studentEmail.endsWith('@brandeis.edu')) {
    throw new Error('Student email must be a Brandeis email (@brandeis.edu)');
  }

  // Prepare ticket data for Supabase
  const ticket = {
    student_email: studentEmail,
    message: message,
    highlighted_code: highlightedCode || null,
    full_code: fullCode || null,
    file_path: filePath || null,
    file_name: fileName || null,
    language: language || null,
    ta_emails: taEmails.length > 0 ? taEmails : null,
    status: 'open',
    priority: 'medium'
  };

  // Insert ticket into Supabase
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tickets')
    .insert([ticket])
    .select()
    .single();

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(`Failed to create ticket: ${error.message}`);
  }

  console.log('Ticket created successfully:', data.id);
  return data;
}

/**
 * Legacy function signature for backward compatibility
 * Converts old email function parameters to new ticket format
 */
async function createTicketFromEmailData(highlightedText, documentText, email, message, filePath = null, fileName = null, language = null) {
  // Parse multiple emails if comma-separated
  const emails = email.split(',').map(e => e.trim());
  const studentEmail = emails[0]; // First email is the student
  const taEmails = emails.slice(1); // Rest are TAs

  return await createTicket({
    studentEmail: studentEmail,
    message: message,
    highlightedCode: highlightedText,
    fullCode: documentText,
    filePath: filePath,
    fileName: fileName,
    language: language,
    taEmails: taEmails
  });
}

module.exports = {
  createTicket,
  createTicketFromEmailData
};

