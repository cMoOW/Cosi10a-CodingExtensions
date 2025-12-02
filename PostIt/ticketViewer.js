// ticketViewer.js
// Manages ticket viewing UI for students in VS Code

const vscode = require('vscode');
const { getStudentTickets, getStudentTicketWithFeedback } = require('../src/view-tickets');

class TicketViewer {
  constructor(context) {
    this.context = context;
    this.activePanel = null;
    this.currentTickets = [];
    this.selectedTicketId = null;
  }

  /**
   * Show all tickets for the current student
   */
  async viewMyTickets() {
    // Get student email
    const getUserEmail = require('../extension').getUserEmail;
    let studentEmail = getUserEmail ? getUserEmail(this.context) : null;

    // Prompt for email if not stored
    if (!studentEmail) {
      const emailInput = await vscode.window.showInputBox({
        prompt: 'Enter your Brandeis email to view your tickets',
        placeHolder: 'name@brandeis.edu',
        validateInput: (value) => {
          if (!value || !value.endsWith('@brandeis.edu')) {
            return 'Please enter a valid Brandeis email address';
          }
          return null;
        }
      });

      if (!emailInput) {
        return; // User cancelled
      }

      studentEmail = emailInput;
      // Save email for future use
      const EMAIL_KEY = 'myExtension.userEmail';
      await this.context.globalState.update(EMAIL_KEY, emailInput);
    }

    try {
      // Fetch tickets
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Loading your tickets...',
        cancellable: false
      }, async (progress) => {
        this.currentTickets = await getStudentTickets(studentEmail);
        this.showTicketList(studentEmail);
      });

    } catch (error) {
      console.error('Error fetching tickets:', error);
      vscode.window.showErrorMessage(`Failed to load tickets: ${error.message}`);
    }
  }

  /**
   * Show ticket list in webview
   */
  showTicketList(studentEmail) {
    if (this.activePanel) {
      this.activePanel.reveal();
    } else {
      this.activePanel = vscode.window.createWebviewPanel(
        'myTickets',
        'My Tickets & Feedback',
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      this.activePanel.onDidDispose(() => {
        this.activePanel = null;
        this.selectedTicketId = null;
      });
    }

    this.selectedTicketId = null;
    this.activePanel.webview.html = this.getTicketListHTML(this.currentTickets, studentEmail);

    // Handle messages from webview
    this.activePanel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'viewTicket') {
        await this.showTicketDetail(message.ticketId, studentEmail);
      } else if (message.type === 'backToList') {
        this.showTicketList(studentEmail);
      } else if (message.type === 'refreshTickets') {
        try {
          this.currentTickets = await getStudentTickets(studentEmail);
          this.showTicketList(studentEmail);
          vscode.window.showInformationMessage('Tickets refreshed');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to refresh: ${error.message}`);
        }
      }
    });
  }

  /**
   * Show detailed ticket view with feedback
   */
  async showTicketDetail(ticketId, studentEmail) {
    try {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Loading ticket details...',
        cancellable: false
      }, async () => {
        const { ticket, feedback } = await getStudentTicketWithFeedback(ticketId, studentEmail);
        this.selectedTicketId = ticketId;
        
        if (this.activePanel) {
          this.activePanel.webview.html = this.getTicketDetailHTML(ticket, feedback, studentEmail);
        }
      });
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      vscode.window.showErrorMessage(`Failed to load ticket: ${error.message}`);
    }
  }

  /**
   * Generate HTML for ticket list
   */
  getTicketListHTML(tickets, studentEmail) {
    const ticketsHTML = tickets.length === 0
      ? '<div class="empty-state">No tickets yet. Create one by selecting code and using "Email Code Snippet".</div>'
      : tickets.map(ticket => `
        <div class="ticket-card" onclick="viewTicket('${ticket.id}')">
          <div class="ticket-header">
            <span class="ticket-id">#${ticket.id.substring(0, 8)}</span>
            <span class="ticket-status status-${ticket.status}">${ticket.status}</span>
            <span class="ticket-priority priority-${ticket.priority}">${ticket.priority}</span>
          </div>
          <div class="ticket-message">${this.escapeHtml(ticket.message.substring(0, 150))}${ticket.message.length > 150 ? '...' : ''}</div>
          <div class="ticket-footer">
            <span class="ticket-date">${new Date(ticket.created_at).toLocaleString()}</span>
            ${ticket.assigned_to ? `<span class="ticket-assigned">Assigned to: ${ticket.assigned_to}</span>` : ''}
          </div>
        </div>
      `).join('');

    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          h1 {
            margin: 0;
            color: var(--vscode-textLink-foreground);
          }
          .refresh-btn, .back-btn {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          .refresh-btn:hover, .back-btn:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .student-email {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin-top: 5px;
          }
          .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
          }
          .ticket-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .ticket-card:hover {
            background: var(--vscode-list-hoverBackground);
          }
          .ticket-header {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 10px;
          }
          .ticket-id {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
          }
          .ticket-status, .ticket-priority {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }
          .status-open { background: #4CAF50; color: white; }
          .status-in_progress { background: #2196F3; color: white; }
          .status-resolved { background: #9E9E9E; color: white; }
          .status-closed { background: #424242; color: white; }
          .priority-low { background: #81C784; color: white; }
          .priority-medium { background: #FFB74D; color: white; }
          .priority-high { background: #FF9800; color: white; }
          .priority-urgent { background: #F44336; color: white; }
          .ticket-message {
            margin: 10px 0;
            color: var(--vscode-foreground);
          }
          .ticket-footer {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .ticket-assigned {
            color: var(--vscode-textLink-foreground);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>My Tickets</h1>
            <div class="student-email">${this.escapeHtml(studentEmail)}</div>
          </div>
          <button class="refresh-btn" onclick="refreshTickets()">Refresh</button>
        </div>
        <div class="tickets-list">
          ${ticketsHTML}
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          function viewTicket(ticketId) {
            vscode.postMessage({ type: 'viewTicket', ticketId });
          }
          function refreshTickets() {
            vscode.postMessage({ type: 'refreshTickets' });
          }
        </script>
      </body>
      </html>`;
  }

  /**
   * Generate HTML for ticket detail view
   */
  getTicketDetailHTML(ticket, feedback, studentEmail) {
    const feedbackHTML = feedback.length === 0
      ? '<div class="empty-state">No feedback yet from TAs.</div>'
      : feedback.map(item => `
        <div class="feedback-item">
          <div class="feedback-header">
            <span class="feedback-author">${this.escapeHtml(item.ta_email)}</span>
            <span class="feedback-date">${new Date(item.created_at).toLocaleString()}</span>
          </div>
          <div class="feedback-content">${this.escapeHtml(item.feedback_text).replace(/\n/g, '<br>')}</div>
        </div>
      `).join('');

    const codeHTML = ticket.highlighted_code
      ? `<div class="code-section">
           <h3>Your Code</h3>
           <pre><code>${this.escapeHtml(ticket.highlighted_code)}</code></pre>
         </div>`
      : '';

    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
          }
          .header {
            margin-bottom: 20px;
          }
          .back-btn {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 15px;
          }
          .back-btn:hover {
            background: var(--vscode-button-hoverBackground);
          }
          h1 {
            margin: 0 0 10px 0;
            color: var(--vscode-textLink-foreground);
          }
          .ticket-meta {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .ticket-status, .ticket-priority {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }
          .status-open { background: #4CAF50; color: white; }
          .status-in_progress { background: #2196F3; color: white; }
          .status-resolved { background: #9E9E9E; color: white; }
          .status-closed { background: #424242; color: white; }
          .priority-low { background: #81C784; color: white; }
          .priority-medium { background: #FFB74D; color: white; }
          .priority-high { background: #FF9800; color: white; }
          .priority-urgent { background: #F44336; color: white; }
          .message-section {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
          }
          .message-section h3 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
          }
          .code-section {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
          }
          .code-section h3 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
          }
          .code-section pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
          }
          .code-section code {
            font-family: 'Courier New', monospace;
            font-size: 13px;
          }
          .feedback-section {
            margin-top: 30px;
          }
          .feedback-section h2 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
          }
          .feedback-item {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
          }
          .feedback-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .feedback-author {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
          }
          .feedback-content {
            color: var(--vscode-foreground);
            line-height: 1.6;
          }
          .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <button class="back-btn" onclick="backToList()">← Back to Tickets</button>
          <h1>Ticket #${ticket.id.substring(0, 8)}</h1>
          <div class="ticket-meta">
            <span class="ticket-status status-${ticket.status}">${ticket.status}</span>
            <span class="ticket-priority priority-${ticket.priority}">${ticket.priority}</span>
            <span>Created: ${new Date(ticket.created_at).toLocaleString()}</span>
            ${ticket.assigned_to ? `<span>Assigned to: ${this.escapeHtml(ticket.assigned_to)}</span>` : ''}
          </div>
        </div>

        <div class="message-section">
          <h3>Your Message</h3>
          <div>${this.escapeHtml(ticket.message).replace(/\n/g, '<br>')}</div>
        </div>

        ${codeHTML}

        <div class="feedback-section">
          <h2>TA Feedback (${feedback.length})</h2>
          ${feedbackHTML}
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          function backToList() {
            vscode.postMessage({ type: 'backToList' });
          }
        </script>
      </body>
      </html>`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
  }
}

module.exports = { TicketViewer };

