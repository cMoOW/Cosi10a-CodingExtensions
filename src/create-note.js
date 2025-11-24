// create-note.js
// Saves notes to Supabase database (similar to create-ticket.js)

const { getSupabase } = require('./supabaseClient');

/**
 * Creates a note in Supabase database (saved as a ticket)
 * @param {Object} noteData - The note data
 * @param {string} noteData.studentEmail - Student's Brandeis email
 * @param {string} noteData.message - Note content
 * @param {string} noteData.highlightedCode - Selected/highlighted code snippet (optional)
 * @param {string} noteData.fullCode - Full document code (optional)
 * @param {string} noteData.filePath - Path to the file (optional)
 * @param {string} noteData.fileName - Just the filename (optional)
 * @param {string} noteData.language - Programming language (optional)
 * @returns {Promise<Object>} The created note/ticket object with id
 */
async function createNote(noteData) {
  const {
    studentEmail,
    message,
    highlightedCode = null,
    fullCode = null,
    filePath = null,
    fileName = null,
    language = null
  } = noteData;

  // Validate required fields
  if (!studentEmail || !message) {
    throw new Error('Student email and message are required');
  }

  // Validate Brandeis email
  if (!studentEmail.endsWith('@brandeis.edu')) {
    throw new Error('Student email must be a Brandeis email (@brandeis.edu)');
  }

  // Prepare note data for Supabase (using tickets table)
  const note = {
    student_email: studentEmail,
    message: message,
    highlighted_code: highlightedCode,
    full_code: fullCode,
    file_path: filePath,
    file_name: fileName,
    language: language,
    status: 'open', // Notes are open by default
    priority: 'low' // Notes have lower priority than tickets
  };

  // Insert note into Supabase
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tickets')
    .insert([note])
    .select()
    .single();

  if (error) {
    console.error('Supabase error creating note:', error);
    throw new Error(`Failed to create note: ${error.message}`);
  }

  console.log('Note saved to database successfully:', data.id);
  return data;
}

module.exports = {
  createNote
};

