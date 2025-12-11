// ticketService.js
// Service layer for interacting with Supabase for ticket and feedback operations

import { supabase } from '../supabaseClient';

/**
 * Get all tickets with optional filters
 * @param {Object} filters - Filter options
 * @param {string} filters.status - Filter by status (open, resolved)
 * @param {string} filters.assignedTo - Filter by assigned TA email or 'unassigned'
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
 * @param {string} newStatus - New status (open, resolved)
 * @param {string} taEmail - TA email who is making the change
 * @returns {Promise<Object>} Updated ticket object
 */
export async function updateTicketStatus(ticketId, newStatus, taEmail) {
  // Validate ticketId
  if (!ticketId || typeof ticketId !== 'string') {
    throw new Error('Invalid ticket ID');
  }

  console.log('Updating ticket status:', { ticketId, newStatus, taEmail });

  // First verify the ticket exists and get its current status
  const { data: currentTicket, error: fetchError } = await supabase
    .from('tickets')
    .select('id, status')
    .eq('id', ticketId)
    .single();

  if (fetchError || !currentTicket) {
    console.error('Cannot find ticket to update:', { ticketId, error: fetchError });
    throw new Error(`Ticket not found. Cannot update status. ${fetchError?.message || ''}`);
  }

  console.log('Current ticket status:', currentTicket.status);

  // Start with basic update data - only include fields that definitely exist
  const basicUpdateData = {
    status: newStatus,
    updated_at: new Date().toISOString()
  };

  // Perform the update and get the result
  // Note: Using .select() to check if rows were actually updated
  const { data: updateResult, error: updateError } = await supabase
    .from('tickets')
    .update(basicUpdateData)
// [MermaidChart: d35e91f3-1477-4d7a-84c9-09d06b55d2f1]
// [MermaidChart: d35e91f3-1477-4d7a-84c9-09d06b55d2f1]
// [MermaidChart: d35e91f3-1477-4d7a-84c9-09d06b55d2f1]
// [MermaidChart: d35e91f3-1477-4d7a-84c9-09d06b55d2f1]
// [MermaidChart: d35e91f3-1477-4d7a-84c9-09d06b55d2f1]
// [MermaidChart: d35e91f3-1477-4d7a-84c9-09d06b55d2f1]
// [MermaidChart: d35e91f3-1477-4d7a-84c9-09d06b55d2f1]
// [MermaidChart: d35e91f3-1477-4d7a-84c9-09d06b55d2f1]
    .eq('id', ticketId)
    .select('id');

  if (updateError) {
    console.error('Update failed:', updateError);
    // Check if error is related to RLS/permissions
    if (updateError.message && (updateError.message.includes('permission') || updateError.message.includes('policy') || updateError.message.includes('RLS'))) {
      throw new Error(`Update blocked by Row Level Security. Please run the SQL in database/tickets_rls_policies.sql in your Supabase SQL editor to allow ticket updates. Error: ${updateError.message}`);
    }
    throw new Error(`Failed to update ticket status: ${updateError.message}`);
  }

  // Check if any rows were actually updated
  const rowsAffected = updateResult ? updateResult.length : 0;
  console.log('Update query executed. Rows affected:', rowsAffected);

  if (rowsAffected === 0) {
    // No rows were updated - likely RLS blocking the update silently
    throw new Error(`Update was blocked. No rows were updated. This is likely due to Row Level Security (RLS) policies preventing updates. Please run the SQL in database/tickets_rls_policies.sql in your Supabase SQL editor to allow ticket updates.`);
  }

  console.log('Update query executed successfully, verifying...');

  // Now fetch the updated ticket to verify the change
  const { data: updatedTicket, error: verifyError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (verifyError || !updatedTicket) {
    console.error('Cannot verify update:', { ticketId, error: verifyError });
    throw new Error(`Update may have succeeded but cannot verify: ${verifyError?.message || 'Unknown error'}`);
  }

  console.log('Updated ticket status:', updatedTicket.status);

  // Verify the status actually changed
  if (updatedTicket.status !== newStatus) {
    console.error('Status mismatch:', { expected: newStatus, actual: updatedTicket.status });
    throw new Error(`Update failed. Expected status "${newStatus}" but ticket is still "${updatedTicket.status}". This may be due to database constraints or Row Level Security policies.`);
  }

  // If update succeeded, optionally try to update resolved_at/resolved_by if status is resolved
  if ((newStatus === 'resolved' || newStatus === 'closed') && taEmail) {
    const resolvedUpdateData = {
      resolved_at: new Date().toISOString(),
      resolved_by: taEmail
    };
    
    // Try to update resolved fields (silently fail if columns don't exist)
    const { error: resolvedError } = await supabase
      .from('tickets')
      .update(resolvedUpdateData)
      .eq('id', ticketId);
    
    if (resolvedError) {
      console.warn('Could not update resolved_at/resolved_by (columns may not exist):', resolvedError.message);
      // Don't throw - the status update already succeeded
    } else {
      // Re-fetch to get the full updated ticket with resolved fields
      const { data: finalTicket } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();
      
      if (finalTicket) {
        return finalTicket;
      }
    }
  }

  return updatedTicket;

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

