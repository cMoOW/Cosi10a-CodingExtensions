// view-tickets.js
// Service functions for students to view their tickets and feedback

const { getSupabase } = require('./supabaseClient');

/**
 * Get all tickets for a specific student
 * @param {string} studentEmail - Student's Brandeis email
 * @returns {Promise<Array>} Array of ticket objects
 */
async function getStudentTickets(studentEmail) {
  if (!studentEmail || !studentEmail.endsWith('@brandeis.edu')) {
    throw new Error('Valid Brandeis student email is required');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('student_email', studentEmail)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching student tickets:', error);
    throw new Error(`Failed to fetch tickets: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single ticket with its feedback for a student
 * Only returns non-internal feedback visible to students
 * @param {string} ticketId - UUID of the ticket
 * @param {string} studentEmail - Student's email (for verification)
 * @returns {Promise<Object>} Object with ticket and feedback array
 */
async function getStudentTicketWithFeedback(ticketId, studentEmail) {
  if (!studentEmail || !studentEmail.endsWith('@brandeis.edu')) {
    throw new Error('Valid Brandeis student email is required');
  }

  const supabase = getSupabase();

  // Fetch ticket and verify ownership
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .eq('student_email', studentEmail)
    .single();

  if (ticketError) {
    console.error('Error fetching ticket:', ticketError);
    throw new Error(`Failed to fetch ticket: ${ticketError.message}`);
  }

  if (!ticket) {
    throw new Error('Ticket not found or you do not have permission to view it');
  }

  // Fetch feedback for this ticket (excluding internal notes)
  const { data: feedback, error: feedbackError } = await supabase
    .from('ticket_feedback')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('is_internal', false) // Students can only see non-internal feedback
    .order('created_at', { ascending: false });

  if (feedbackError) {
    console.error('Error fetching feedback:', feedbackError);
    // Don't throw - ticket might not have feedback yet
    return { ticket, feedback: [] };
  }

  return { ticket, feedback: feedback || [] };
}

/**
 * Get count of tickets with unread feedback (for notifications)
 * @param {string} studentEmail - Student's Brandeis email
 * @returns {Promise<number>} Count of tickets with new feedback
 */
async function getUnreadFeedbackCount(studentEmail) {
  if (!studentEmail || !studentEmail.endsWith('@brandeis.edu')) {
    return 0;
  }

  const supabase = getSupabase();

  // Get all tickets for student
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('id')
    .eq('student_email', studentEmail);

  if (ticketsError || !tickets || tickets.length === 0) {
    return 0;
  }

  const ticketIds = tickets.map(t => t.id);

  // Count feedback created in last 24 hours (or customize timeframe)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { count, error: feedbackError } = await supabase
    .from('ticket_feedback')
    .select('*', { count: 'exact', head: true })
    .in('ticket_id', ticketIds)
    .eq('is_internal', false)
    .gte('created_at', oneDayAgo.toISOString());

  if (feedbackError) {
    console.error('Error counting feedback:', feedbackError);
    return 0;
  }

  return count || 0;
}

module.exports = {
  getStudentTickets,
  getStudentTicketWithFeedback,
  getUnreadFeedbackCount
};

