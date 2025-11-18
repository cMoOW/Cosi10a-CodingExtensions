// ticketService.js
// Service layer for interacting with Supabase for ticket and feedback operations

import { supabase } from '../supabaseClient';

/**
 * Get all tickets with optional filters
 * @param {Object} filters - Filter options
 * @param {string} filters.status - Filter by status (open, in_progress, resolved, closed)
 * @param {string} filters.assignedTo - Filter by assigned TA email or 'unassigned'
 * @param {string} filters.priority - Filter by priority (low, medium, high, urgent)
 * @param {string} filters.studentEmail - Filter by student email
 * @returns {Promise<Array>} Array of ticket objects
 */
export async function getTickets(filters = {}) {
  let query = supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.assignedTo) {
    if (filters.assignedTo === 'unassigned') {
      query = query.is('assigned_to', null);
    } else {
      query = query.eq('assigned_to', filters.assignedTo);
    }
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters.studentEmail) {
    query = query.eq('student_email', filters.studentEmail);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tickets:', error);
    throw new Error(`Failed to fetch tickets: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single ticket with its feedback
 * @param {string} ticketId - UUID of the ticket
 * @returns {Promise<Object>} Object with ticket and feedback array
 */
export async function getTicketWithFeedback(ticketId) {
  // Fetch ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (ticketError) {
    console.error('Error fetching ticket:', ticketError);
    throw new Error(`Failed to fetch ticket: ${ticketError.message}`);
  }

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Fetch feedback for this ticket
  const { data: feedback, error: feedbackError } = await supabase
    .from('ticket_feedback')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (feedbackError) {
    console.error('Error fetching feedback:', feedbackError);
    // Don't throw - ticket might not have feedback yet
    return { ticket, feedback: [] };
  }

  return { ticket, feedback: feedback || [] };
}

/**
 * Update ticket status
 * @param {string} ticketId - UUID of the ticket
 * @param {string} newStatus - New status (open, in_progress, resolved, closed)
 * @param {string} taEmail - TA email who is making the change
 * @returns {Promise<Object>} Updated ticket object
 */
export async function updateTicketStatus(ticketId, newStatus, taEmail) {
  const updateData = {
    status: newStatus,
    updated_at: new Date().toISOString()
  };

  // If resolving, set resolution metadata
  if (newStatus === 'resolved' || newStatus === 'closed') {
    updateData.resolved_at = new Date().toISOString();
    updateData.resolved_by = taEmail;
  }

  const { data, error } = await supabase
    .from('tickets')
    .update(updateData)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) {
    console.error('Error updating ticket status:', error);
    throw new Error(`Failed to update status: ${error.message}`);
  }

  return data;
}

/**
 * Assign ticket to a TA
 * @param {string} ticketId - UUID of the ticket
 * @param {string} taEmail - TA email to assign to (empty string to unassign)
 * @returns {Promise<Object>} Updated ticket object
 */
export async function assignTicket(ticketId, taEmail) {
  const updateData = {
    assigned_to: taEmail || null,
    updated_at: new Date().toISOString()
  };

  if (taEmail) {
    updateData.assigned_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('tickets')
    .update(updateData)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) {
    console.error('Error assigning ticket:', error);
    throw new Error(`Failed to assign ticket: ${error.message}`);
  }

  return data;
}

/**
 * Update ticket priority
 * @param {string} ticketId - UUID of the ticket
 * @param {string} newPriority - New priority (low, medium, high, urgent)
 * @returns {Promise<Object>} Updated ticket object
 */
export async function updateTicketPriority(ticketId, newPriority) {
  const { data, error } = await supabase
    .from('tickets')
    .update({
      priority: newPriority,
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) {
    console.error('Error updating ticket priority:', error);
    throw new Error(`Failed to update priority: ${error.message}`);
  }

  return data;
}

/**
 * Add feedback to a ticket
 * @param {string} ticketId - UUID of the ticket
 * @param {string} taEmail - TA email adding the feedback
 * @param {string} feedbackText - The feedback text
 * @param {string} feedbackType - Type of feedback (note, response, question)
 * @param {boolean} isInternal - Whether this feedback is internal only
 * @returns {Promise<Object>} Created feedback object
 */
export async function addFeedback(ticketId, taEmail, feedbackText, feedbackType = 'note', isInternal = false) {
  const feedbackData = {
    ticket_id: ticketId,
    ta_email: taEmail,
    feedback_text: feedbackText,
    feedback_type: feedbackType,
    is_internal: isInternal
  };

  const { data, error } = await supabase
    .from('ticket_feedback')
    .insert([feedbackData])
    .select()
    .single();

  if (error) {
    console.error('Error adding feedback:', error);
    throw new Error(`Failed to add feedback: ${error.message}`);
  }

  return data;
}

