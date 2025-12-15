const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { createNote } = require("../src/create-note");

class NoteManager {
  constructor(context, onNotesChanged = null) {
    this.context = context;
    this.notesFilePath = path.join(
      context.globalStorageUri.fsPath,
      "postItNotes.json"
    );
    this.notes = this.loadNotes();
    this.activePanel = null; // Track the active webview panel
    this.onNotesChanged = onNotesChanged; // Callback for when notes change
    console.log(
      "NoteManager initialized with",
      this.notes.length,
      "existing notes"
    );
    this.emailList = {
      "Brian Shen": "brianshen@brandeis.edu",
      "Apoorva Uppal": "auppal@brandeis.edu",
      "Jacob Carminati": "jacobcarminati@brandeis.edu",
      "SiMing Lin": "siminglin@brandeis.edu",
    };
  }

  /**
   * Load notes from file
   */
  loadNotes() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.notesFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.notesFilePath)) {
        const data = fs.readFileSync(this.notesFilePath, "utf8");
        const notes = JSON.parse(data);
        console.log("Loaded", notes.length, "notes from file");
        return notes;
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
    return [];
  }

  /**
   * Add a new note
   * @param {string} message - The note content
   * @param {Object} [options={}] - Optional editor context
   * @param {string} [options.highlightedCode] - Selected code (optional)
   * @param {string} [options.fullCode] - Full document code (optional)
   * @param {string} [options.filePath] - File path (optional)
   * @param {string} [options.fileName] - File name (optional)
   * @param {string} [options.language] - Language (optional)
   */
  // @ts-ignore Should be optional
  async addNote(message, options = {}) {
    if (message && message.trim()) {
      const newNote = {
        id: Date.now(),
        content: message.trim(),
        timestamp: new Date().toISOString(),
        color: await this.selectNoteColor(),
      };

      this.notes.push(newNote);
      await this.saveNotes();

      // Also save to Supabase database
      try {
        // Get user email from stored state
        const getUserEmail = require("../extension").getUserEmail;
        let userEmail = getUserEmail ? getUserEmail(this.context) : null;

        // If no email stored, prompt user
        if (!userEmail) {
          const emailInput = await vscode.window.showInputBox({
            prompt: "Enter your Brandeis email to save note to database",
            placeHolder: "name@brandeis.edu",
            validateInput: (value) => {
              if (!value || !value.endsWith("@brandeis.edu")) {
                return "Please enter a valid Brandeis email address";
              }
              return null;
            }
          });

          if (emailInput) {
            userEmail = emailInput;
            // Save email for future use
            const EMAIL_KEY = 'myExtension.userEmail';
            await this.context.globalState.update(EMAIL_KEY, emailInput);
          }
        }

        // Save to Supabase if we have an email
        if (userEmail) {
          const editor = vscode.window.activeTextEditor;
          const noteData = {
            studentEmail: userEmail,
            message: message.trim(),
            highlightedCode: options.highlightedCode || (editor ? this.getSelectedText(editor) : null),
            fullCode: options.fullCode || (editor ? editor.document.getText() : null),
            filePath: options.filePath || (editor ? editor.document.uri.fsPath || editor.document.fileName : null),
            fileName: options.fileName || (editor && editor.document.fileName ? path.basename(editor.document.fileName) : null),
            language: options.language || (editor ? editor.document.languageId : null)
          };

          const ticket = await createNote(noteData);
          // Store the ticket ID in the local note for sync purposes
          if (ticket && ticket.id) {
            newNote.ticketId = ticket.id;
          }
          console.log("Note saved to Supabase database");
        }
      } catch (error) {
        console.error("Error saving note to database:", error);
        // Don't show error to user - local save already succeeded
        // vscode.window.showErrorMessage(`Note saved locally, but failed to save to database: ${error.message}`);
      }

      vscode.window.showInformationMessage(
        ` Note added: "${message.substring(0, 30)}${
          message.length > 30 ? "..." : ""
        }"`
      );

      // Refresh the active panel if it exists
      if (this.activePanel) {
        this.activePanel.webview.html = this.getWebviewContent();
      }

      return newNote;
    }

    return null;
  }

  /**
   * Get selected text from editor
   */
  getSelectedText(editor) {
    if (!editor) return null;
    const selection = editor.selection;
    if (selection && !selection.isEmpty) {
      return editor.document.getText(selection);
    }
    return null;
  }

  /**
   * Show floating note editor for adding new notes
   */
  async showFloatingEditor(initialContent = "") {
    const panel = vscode.window.createWebviewPanel(
      "floatingNoteEditor",
      "Add New Post-It Note",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    panel.webview.html = this.getFloatingEditorHTML(initialContent);

    // Handle messages from the floating editor
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "saveNote") {
        const content = message.content.trim();
        if (content) {
          // Use addNote which handles both local and Supabase save
          await this.addNote(content);

          panel.dispose();
        } else {
          vscode.window.showWarningMessage("Note cannot be empty");
        }
      }

      if (message.type === "cancelNote") {
        panel.dispose();
      }
    });
  }

  /**
   * Show inline note editor that appears over the code editor
   */
  async showInlineNoteEditor(initialContent = "") {
    const panel = vscode.window.createWebviewPanel(
      "inlineNoteEditor",
      "Quick Note",
      vscode.ViewColumn.Beside, // Open beside the current editor
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    const iconPath = vscode.Uri.file(
      path.join(this.context.extensionPath, "PostIt", "post_it_storage.png") // Can also be post_it_logo
    );
    panel.iconPath = iconPath;

    
    panel.webview.html = this.getInlineEditorHTML(initialContent);

    // Handle messages from the inline editor
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "saveNote") {
        const content = message.content.trim();
        if (content) {
          // Get editor context for database save
          const editor = vscode.window.activeTextEditor;
          const options = {
            highlightedCode: initialContent || (editor ? this.getSelectedText(editor) : null),
            fullCode: editor ? editor.document.getText() : null,
            filePath: editor ? editor.document.uri.fsPath || editor.document.fileName : null,
            fileName: editor && editor.document.fileName ? path.basename(editor.document.fileName) : null,
            language: editor ? editor.document.languageId : null
          };

          // Use addNote which handles both local and Supabase save
          await this.addNote(content, options);

          panel.dispose();
        } else {
          vscode.window.showWarningMessage("Note cannot be empty");
        }
      }

      if (message.type === "cancelNote") {
        panel.dispose();
      }
    });
  }

  /**
   * Select note color
   */
  async selectNoteColor() {
    const colors = [
      "#355E3B", // Dark Green
      "#699987", // Mint Green
      "#8d698d", // Soft Lavender
    ];

    // Pick a random color each time
    const randomIndex = Math.floor(Math.random() * colors.length);
    return colors[randomIndex];
  }

  async sendNoteEmail(note, userEmail, recipientEmail) {
    try {
      // Import the sendHelloEmail function
      const { sendEmail } = require("../src/send-email");

      // Validate emails
      const emailList = recipientEmail
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email);
      const brandeisEmails = emailList.filter((email) =>
        email.endsWith("@brandeis.edu")
      );

      if (brandeisEmails.length === 0) {
        vscode.window.showErrorMessage(
          "Please enter at least one valid Brandeis email address."
        );
        return;
      }

      // Create email content
      const emailContent = `
Post-It Note Content:

${note.content}

---
Created: ${new Date(note.timestamp).toLocaleString()}
Sent from VS Code Post-It Extension
            `.trim();

      // Send email
      await sendEmail(
        note.content,
        emailContent,
        userEmail,
        brandeisEmails.join(","),
        "Post-It Note from VS Code Extension"
      );
      // Store the user's email for future use
      this.context.globalState.update("myExtension.userEmail", userEmail);

      vscode.window.showInformationMessage(
        `Note emailed to: ${brandeisEmails.join(", ")}`
      );

      // Exit email mode
      if (this.activePanel) {
        this.activePanel.webview.postMessage({
          type: "exitEmailMode",
          noteId: note.id,
        });
      }
    } catch (error) {
      console.error("Error sending note email:", error);
      vscode.window.showErrorMessage(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * View all notes
   */
  async viewAllNotes() {
    if (this.notes.length === 0) {
      vscode.window.showInformationMessage(
        " No Post-It notes yet! Add one to get started."
      );
      return;
    }

    // If there's already an active panel, just refresh it
    if (this.activePanel) {
      const iconPath = vscode.Uri.file(
        path.join(this.context.extensionPath, "PostIt", "post_it_storage.png")
      );
      this.activePanel.iconPath = iconPath;

      this.activePanel.webview.html = this.getWebviewContent();
      this.activePanel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "postItNotes",
      "My Post-It Notes",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      }
    );

    // Track this panel
    this.activePanel = panel;

    // Clear the reference when panel is disposed
    panel.onDidDispose(() => {
      this.activePanel = null;
    });

    //TODO: modularize this method
    //handles deleting a note
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "deleteNote") {
        const noteId = parseInt(message.id);
        const deletedNote = this.notes.find((n) => n.id === noteId);
        this.notes = this.notes.filter((n) => n.id !== noteId);
        await this.saveNotes();

        // If note has a ticket ID, close the ticket in the database
        if (deletedNote && deletedNote.ticketId) {
          try {
            await this.closeTicket(deletedNote.ticketId);
            console.log(`Ticket ${deletedNote.ticketId} closed after note deletion`);
          } catch (error) {
            console.error("Error closing ticket when deleting note:", error);
            // Don't show error to user - note deletion succeeded
          }
        }

        // Offer Undo option
        vscode.window
          .showInformationMessage("Note deleted.", "Undo")
          .then(async (selection) => {
            if (selection === "Undo" && deletedNote) {
              this.notes.push(deletedNote);
              await this.saveNotes();
              // If ticket was closed, reopen it
              if (deletedNote.ticketId) {
                try {
                  await this.reopenTicket(deletedNote.ticketId);
                  console.log(`Ticket ${deletedNote.ticketId} reopened after note undo`);
                } catch (error) {
                  console.error("Error reopening ticket:", error);
                }
              }
              vscode.window.showInformationMessage("Note restored.");
              panel.webview.html = this.getWebviewContent(); // Refresh view
            }
          });
        
        panel.webview.html = this.getWebviewContent(); // Refresh view
      }

      //handles deleting all notes
      if (message.type === "deleteAll") {
        if (this.notes.length === 0) {
          vscode.window.showInformationMessage("There are no notes to delete.");
          return;
        }

        const deletedNotesBackup = [...this.notes]; // backup for undo
        
        // Close all tickets associated with notes
        const ticketIds = deletedNotesBackup
          .filter(note => note.ticketId)
          .map(note => note.ticketId);
        
        if (ticketIds.length > 0) {
          try {
            await Promise.all(ticketIds.map(ticketId => this.closeTicket(ticketId)));
            console.log(`Closed ${ticketIds.length} tickets after deleting all notes`);
          } catch (error) {
            console.error("Error closing tickets when deleting all notes:", error);
          }
        }

        this.notes = [];
        await this.saveNotes();
        panel.webview.html = this.getWebviewContent();
        vscode.window
          .showInformationMessage("🧹 All notes deleted.", "Undo")
          .then(async (selection) => {
            if (selection === "Undo") {
              this.notes = deletedNotesBackup;
              await this.saveNotes();
              // Reopen all tickets
              if (ticketIds.length > 0) {
                try {
                  await Promise.all(ticketIds.map(ticketId => this.reopenTicket(ticketId)));
                  console.log(`Reopened ${ticketIds.length} tickets after undo`);
                } catch (error) {
                  console.error("Error reopening tickets:", error);
                }
              }
              vscode.window.showInformationMessage("All notes restored.");
              panel.webview.html = this.getWebviewContent();
            }
          });
      }

      //handles editing a note (inline editing)
      if (message.type === "editNote") {
        const noteId = parseInt(message.id);
        const note = this.notes.find((n) => n.id === noteId);
        if (!note) return;

        // Toggle edit mode in the webview
        panel.webview.postMessage({
          type: "toggleEditMode",
          noteId: noteId,
          content: note.content,
        });
      }

      //handles toggling email mode for a note
      if (message.type === "toggleEmailMode") {
        const noteId = parseInt(message.noteId);
        const note = this.notes.find((n) => n.id === noteId);
        if (!note) return;

        // Toggle email mode in the webview
        panel.webview.postMessage({
          type: "toggleEmailMode",
          noteId: noteId,
        });
      }

      //handles sending email for a note
      if (message.type === "sendNoteEmail") {
        const noteId = parseInt(message.noteId);
        // const emails = message.emails;
        const userEmail = message.userEmail;
        const recipientEmail = message.recipientEmail;
        const note = this.notes.find((n) => n.id === noteId);
        if (!note) return;

        await this.sendNoteEmail(note, userEmail, recipientEmail);
      }

      //handles canceling email mode
      if (message.type === "cancelEmail") {
        const noteId = parseInt(message.noteId);
        panel.webview.postMessage({
          type: "exitEmailMode",
          noteId: noteId,
        });
      }

      //handles saving edited note content
      if (message.type === "saveNoteEdit") {
        const noteId = parseInt(message.noteId);
        const newContent = message.content;
        const note = this.notes.find((n) => n.id === noteId);

        if (note && newContent && newContent.trim()) {
          note.content = newContent.trim();
          note.timestamp = new Date().toISOString();
          await this.saveNotes();

          // Exit edit mode and refresh
          panel.webview.postMessage({
            type: "exitEditMode",
            noteId: noteId,
          });
          panel.webview.html = this.getWebviewContent();
        }
      }

      //handles canceling edit
      if (message.type === "cancelEdit") {
        const noteId = parseInt(message.noteId);
        panel.webview.postMessage({
          type: "exitEditMode",
          noteId: noteId,
        });
      }
    });
    const iconPath = vscode.Uri.file(
      path.join(this.context.extensionPath, "PostIt", "post_it_storage.png")
    );
    panel.iconPath = iconPath;

    panel.webview.html = this.getWebviewContent();
  }

  /**
   * Save notes to file
   */
  async saveNotes() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.notesFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Save to file
      fs.writeFileSync(this.notesFilePath, JSON.stringify(this.notes, null, 2));
      console.log("Saved", this.notes.length, "notes to file");

      // Also save to global state as backup
      await this.context.globalState.update("postItNotes", this.notes);

      // Notify that notes have changed
      this.notifyNotesChanged();
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  }

  /**
   * Notify that notes have changed
   */
  notifyNotesChanged() {
    if (this.onNotesChanged) {
      this.onNotesChanged(this.notes.length);
    }
  }

  /**
   * Get floating editor HTML content
   * !Ask why this is here!
   */
  getFloatingEditorHTML(initialContent = "") {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Add New Post-It Note</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    background: #1f1f1f;
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .floating-editor {
                    background: #2c2c2c;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    max-width: 600px;
                    width: 100%;
                }
                h2 {
                    color: white;
                    margin: 0 0 15px 0;
                    text-align: center;
                }
                .editor-textarea {
                    width: 100%;
                    min-height: 200px;
                    padding: 15px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    line-height: 1.5;
                    resize: vertical;
                    outline: none;
                    box-sizing: border-box;
                }
                .editor-textarea:focus {
                    border-color: #74B9FF;
                    background: rgba(255, 255, 255, 0.15);
                }
                .editor-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    justify-content: flex-end;
                }
                .save-btn, .cancel-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                .save-btn {
                    background: #28a745;
                    color: white;
                }
                .save-btn:hover {
                    background: #218838;
                }
                .cancel-btn {
                    background: #6c757d;
                    color: white;
                }
                .cancel-btn:hover {
                    background: #5a6268;
                }
                .postit-email {
                    margin-top: 10px;
                }
                .email-input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    font-size: 12px;
                    outline: none;
                    margin-bottom: 8px;
                }
                .email-input:focus {
                    border-color: #74B9FF;
                    background: rgba(255, 255, 255, 0.15);
                }
                .email-input::placeholder {
                    color: rgba(255, 255, 255, 0.6);
                }
                .email-buttons {
                    display: flex;
                    gap: 6px;
                }
                .send-email-btn, .cancel-email-btn {
                    padding: 4px 8px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                .send-email-btn {
                    background: #28a745;
                    color: white;
                }
                .send-email-btn:hover {
                    background: #218838;
                }
                .cancel-email-btn {
                    background: #6c757d;
                    color: white;
                }
                .cancel-email-btn:hover {
                    background: #5a6268;
                }
                .postit-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px solid rgba(0,0,0,0.1);
                    flex-shrink: 0;
                }
                .email-btn {
                    background: #007bff;
                    border: none;
                    color: white;
                    font-size: 12px;
                    border-radius: 3px;
                    padding: 4px 8px;
                    cursor: pointer;
                    transition: background 0.2s ease;
                    font-weight: 600;
                }
                .email-btn:hover {
                    background: #0056b3;
                }
                .expand-btn {
                    background: rgba(108, 117, 125, 0.1);
                    border: none;
                    color: #6c757d;
                    font-size: 10px;
                    border-radius: 2px;
                    padding: 2px 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    opacity: 0.7;
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    z-index: 5;
                }
                .expand-btn:hover {
                    background: rgba(108, 117, 125, 0.3);
                    opacity: 1;
                }
                .expand-btn.expanded {
                    transform: rotate(180deg);
                }
                .help-text {
                    color: #888;
                    font-size: 12px;
                    margin-top: 10px;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="floating-editor">
                <h2>Personal Note</h2>
                <textarea class="editor-textarea" id="noteContent" placeholder="Enter your note content here...">${this.escapeHtml(
                  initialContent
                )}</textarea>
                <div class="help-text">Perfect for code snippets, ideas, or any notes you want to remember!</div>
                <div class="editor-buttons">
                    <button class="cancel-btn" id="cancelBtn">Cancel</button>
                    <button class="save-btn" id="saveBtn">Save Note</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const textarea = document.getElementById('noteContent');
                const saveBtn = document.getElementById('saveBtn');
                const cancelBtn = document.getElementById('cancelBtn');

                // Focus and select text on load
                textarea.focus();
                if (textarea.value) {
                    textarea.select();
                }

                // Save button handler
                saveBtn.addEventListener('click', () => {
                    const content = textarea.value.trim();
                    if (content) {
                        vscode.postMessage({
                            type: 'saveNote',
                            content: content
                        });
                    } else {
                        alert('Please enter some content for your note.');
                    }
                });

                // Cancel button handler
                cancelBtn.addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'cancelNote'
                    });
                });

                // Handle Enter key (Ctrl+Enter to save)
                textarea.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.key === 'Enter') {
                        saveBtn.click();
                    } else if (e.key === 'Escape') {
                        cancelBtn.click();
                    }
                });
            </script>
        </body>
        </html>`;
  }

  /**
   * Get inline editor HTML content (compact version)
   */
  getInlineEditorHTML(initialContent = "") {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quick Note</title>
            <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  padding: 15px;
                  background: var(--vscode-editor-background);
                  margin: 0;
                  height: 100vh;
                  overflow: hidden;
                  color: var(--vscode-editor-foreground);
              }

              .inline-editor {
                  background: var(--vscode-sideBar-background);
                  border: 1px solid var(--vscode-panel-border);
                  border-radius: 6px;
                  padding: 15px;
                  height: calc(100vh - 30px);
                  display: flex;
                  flex-direction: column;
                  box-sizing: border-box;
                  color: var(--vscode-editor-foreground);
              }

              .editor-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 10px;
                  padding-bottom: 8px;
                  border-bottom: 1px solid var(--vscode-panel-border);
              }

              .editor-title {
                  color: var(--vscode-editor-foreground);
                  font-size: 18px;
                  font-weight: 600;
                  margin: 0;
              }

              .close-btn {
                  background: none;
                  border: none;
                  color: var(--vscode-editor-foreground);
                  cursor: pointer;
                  font-size: 16px;
                  padding: 2px 6px;
                  border-radius: 3px;
              }

              .close-btn:hover {
                  background: var(--vscode-toolbar-hoverBackground);
              }

              .editor-textarea {
                  flex: 1;
                  width: 100%;
                  padding: 10px;
                  border: 1px solid var(--vscode-input-border);
                  border-radius: 4px;
                  background: var(--vscode-editor-background);
                  color: var(--vscode-editor-foreground);
                  font-family: 'Courier New', monospace;
                  font-size: 13px;
                  line-height: 1.4;
                  resize: none;
                  outline: none;
                  box-sizing: border-box;
              }

              .editor-textarea:focus {
                  border-color: var(--vscode-focusBorder);
              }

              .editor-buttons {
                  display: flex;
                  gap: 8px;
                  margin-top: 10px;
                  margin-bottom: 10px;
                  justify-content: flex-end;
              }

              .save-btn, .cancel-btn {
                  padding: 6px 12px;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 12px;
                  font-weight: 600;
                  transition: all 0.2s ease;
              }

              .save-btn {
                  background: var(--vscode-button-background);
                  color: var(--vscode-button-foreground);
              }

              .save-btn:hover {
                  background: var(--vscode-button-hoverBackground);
              }

              .cancel-btn {
                  background: var(--vscode-button-secondaryBackground);
                  color: var(--vscode-button-secondaryForeground);
              }

              .cancel-btn:hover {
                  background: var(--vscode-button-secondaryHoverBackground);
              }
          </style>
        </head>
        <body>
            <div class="inline-editor">
                <div class="editor-header">
                    <h3 class="editor-title"> Quick Note</h3>
                    <button class="close-btn" id="closeBtn">×</button>
                </div>
                <textarea class="editor-textarea" id="noteContent" placeholder="Type your note here...">${this.escapeHtml(
                  initialContent
                )}</textarea>
                <div class="editor-buttons">
                    <button class="cancel-btn" id="cancelBtn">Cancel</button>
                    <button class="save-btn" id="saveBtn">Save</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const textarea = document.getElementById('noteContent');
                const saveBtn = document.getElementById('saveBtn');
                const cancelBtn = document.getElementById('cancelBtn');
                const closeBtn = document.getElementById('closeBtn');

                // Focus and select text on load
                textarea.focus();
                if (textarea.value) {
                    textarea.select();
                }

                // Save button handler
                saveBtn.addEventListener('click', () => {
                    const content = textarea.value.trim();
                    if (content) {
                        vscode.postMessage({
                            type: 'saveNote',
                            content: content
                        });
                    } else {
                        alert('Please enter some content for your note.');
                    }
                });

                // Cancel button handler
                cancelBtn.addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'cancelNote'
                    });
                });

                // Close button handler
                closeBtn.addEventListener('click', () => {
                    vscode.postMessage({
                        type: 'cancelNote'
                    });
                });

                // Handle keyboard shortcuts
                textarea.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.key === 'Enter') {
                        saveBtn.click();
                    } else if (e.key === 'Escape') {
                        cancelBtn.click();
                    }
                });
            </script>
        </body>
        </html>`;
  }

  /**
   * Get webview HTML content
   */
  getWebviewContent() {
    const userEmail = require("../extension").getUserEmail(this.context) || "";

    const notesHtml = this.notes
      .map((note) => {

        // This is the full HTML for each note, including the email form
        return `
            <div class="postit" style="background-color: ${
              note.color
            }" data-id="${note.id}">
                <div class="postit-header">
                    <span class="postit-date">${new Date(
                      note.timestamp
                    ).toLocaleDateString()}</span>
                    <button class="delete-btn" title="Delete Note">×</button>
                </div>
                <div class="postit-content-wrapper">
                    <div class="postit-content" id="content-${
                      note.id
                    }">${this.escapeHtml(note.content)}</div>
                    <div class="postit-edit" id="edit-${
                      note.id
                    }" style="display: none;">
                        <textarea class="edit-textarea" id="textarea-${
                          note.id
                        }" placeholder="Edit your note...">${this.escapeHtml(
                          note.content
                        )}</textarea>
                        <div class="edit-buttons">
                            <button class="save-btn" data-id="${
                              note.id
                            }">Save</button>
                            <button class="cancel-btn" data-id="${
                              note.id
                            }">Cancel</button>
                        </div>
                    </div>

                    <div class="postit-email" id="email-${
                      note.id
                    }" style="display: none;">
                        <input 
                            type="email" 
                            class="email-input" 
                            id="userInput-${note.id}" 
                            placeholder="Your email: you@example.com"
                            value="${this.escapeHtml(userEmail)}" 
                        />
                        
                        <div class="multiselect-container" data-note-id="${
                          note.id
                        }">
                            <div class="select-box" id="recipientSelectBox-${
                              note.id
                            }" tabindex="0">
                                <span class="placeholder-text" id="recipientPlaceholder-${
                                  note.id
                                }">Select recipients...</span>
                            </div>
                            <div id="recipientDropdown-${
                              note.id
                            }" class="dropdown-options">
                                <label class="dropdown-option disabled">
                                    Loading emails...
                                </label>
                            </div>
                        </div>
                        
                        <div class="email-buttons">
                            <button class="send-email-btn" data-id="${
                              note.id
                            }">Send Email</button>
                            <button class="cancel-email-btn" data-id="${
                              note.id
                            }">Cancel</button>
                        </div>
                    </div>
                    </div>
                <div class="postit-footer">
                    <button class="email-btn" title="Email Note" data-id="${
                      note.id
                    }">Email</button>
                    <button class="edit-btn" title="Edit Note">Edit</button>
                </div>
            </div>
        `;
      })
      .join("");

    // This is the full HTML/CSS/JS for the webview page
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Post-It Notes</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    background: var(--vscode-sideBar-background);
                    min-height: 100vh;
                }
                .container {
                    max-width: none;
                    margin: 0 auto;
                }
                h1 {
                    color: white;
                    text-align: center;
                    margin-bottom: 30px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                }
                .notes-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 20px;
                    padding: 20px 0;
                    position: relative;
                }
                .postit {
                    padding: 20px;
                    border-radius: 3px;
                    box-shadow: 5px 5px 15px rgba(0,0,0,0.3);
                    transform: rotate(-2deg);
                    transition: all 0.3s ease;
                    width: 280px;
                    height: 200px;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    overflow: visible;
                    cursor: move;
                }
                .postit.expanded-edit {
                    position: fixed;
                    top: 5%;
                    left: 5%;
                    width: 70vw;
                    height: 70vh;
                    // transform: translate(-50%, -50%);
                    z-index: 1000;
                    overflow: hidden;
                    box-shadow: 0 0 40px rgba(0, 0, 0, 0.7);
                }
                .postit.expanded-edit .edit-textarea {
                    width: 100%;
                    height: calc(100% - 50px);
                    resize: none;
                    overflow-y: auto;
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .postit.expanded-edit .postit-content-wrapper {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .postit.expanded-edit:hover {
                    transform: none;
                    box-shadow: 0 0 40px rgba(0, 0, 0, 0.7);
                }
                .postit.expanded-email {
                    overflow: visible;
                    height: auto;
                    min-height: 200px; /* Adjust as needed */
                    background-color: #f0f0f0; /* Example: different background for email */
                    transition: all 0.3s ease;
                }
                .postit.dimmed {
                    opacity: 0.4;
                    pointer-events: none;
                }
                .postit:hover {
                    transform: rotate(0deg) scale(1.05);
                    box-shadow: 8px 8px 20px rgba(0,0,0,0.4);
                    z-index: 10;
                }
                .postit:nth-child(even) {
                    transform: rotate(2deg);
                }
                .postit:nth-child(even):hover {
                    transform: rotate(0deg) scale(1.05);
                }
                .postit-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(0,0,0,0.1);
                    flex-shrink: 0;
                }
                .postit-content-wrapper {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                    padding-right: 20px;
                }
                .postit.expanded-email .postit-content-wrapper {
                    overflow: visible; 
                }                
                .postit-content {
                    line-height: 1.4;
                    color: #333;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 6;
                    -webkit-box-orient: vertical;
                    transition: all 0.3s ease;
                    max-height: 120px;
                    color: #ffffff;
                    font-size: 14px;
                    line-height: 1.6;
                    word-wrap: break-word;
                    white-space: pre-wrap;
                }
                .postit-content.expanded-email {
                    -webkit-line-clamp: unset;
                    overflow: visible;
                    max-height: none;
                    max-width: none;
                    display: block;
                }
                .postit-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px solid rgba(0,0,0,0.1);
                    flex-shrink: 0;
                    gap: 8px;
                }
                .postit-date {
                    font-size: 11px;
                    color: #ffffff;
                    font-weight: 600;
                }
                .delete-btn {
                    background: rgba(255,0,0,0.6);
                    border: none;
                    color: white;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 14px;
                    line-height: 1;
                    transition: background 0.2s ease;
                }
                .delete-btn:hover {
                    background: rgba(255, 0, 0, 0.9);
                }
                .edit-btn {
                    background: rgba(0, 0, 0, 0.2);
                    border: none;
                    color: white;
                    font-size: 12px;
                    border-radius: 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                .email-btn {
                    background: rgba(0, 0, 0, 0.2);
                    border: none;
                    color: white;
                    font-size: 12px;
                    border-radius: 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }
                .email-btn:hover, .edit-btn:hover {
                    background: rgba(0, 0, 0, 0.4);
                }
                .postit-edit {
                    margin-top: 10px;
                }
                .edit-textarea {
                    min-width: 100%;
                    min-height: 500%;
                    padding: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.4;
                    outline: none;
                    box-sizing: border-box;
                }
                .edit-textarea:focus {
                    border-color: #74B9FF;
                    background: rgba(255, 255, 255, 0.15);
                }
                .edit-buttons {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .save-btn, .cancel-btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                .save-btn {
                    background: #28a745;
                    color: white;
                }
                .save-btn:hover {
                    background: #218838;
                }
                .cancel-btn {
                    background: #6c757d;
                    color: white;
                }
                .cancel-btn:hover {
                    background: #5a6268;
                }
                .postit-email {
                    margin-top: 10px;
                }
                .email-input {
                    width: 100%;
                    padding: 10px;
                    margin-bottom: 8px; 
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-size: 13px;
                    outline: none;
                    box-sizing: border-box;
                }
                .email-input:focus {
                    border-color: #74B9FF;
                    background: rgba(255, 255, 255, 0.15);
                }
                .email-buttons {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                .send-email-btn, .cancel-email-btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                .send-email-btn {
                    background: #007acc; 
                    color: white;
                }
                .send-email-btn:hover {
                    background: #0098e6;
                }
                .cancel-email-btn {
                    background: #6c757d;
                    color: white;
                }
                .cancel-email-btn:hover {
                    background: #5a6268;
                }
                .multiselect-container {
                    position: relative;
                    margin-bottom: 8px; 
                }
                .select-box {
                    width: 100%;
                    padding: 10px;
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    font-size: 13px;
                    cursor: pointer;
                    box-sizing: border-box;
                    user-select: none;
                }
                .select-box:focus {
                    border-color: #74B9FF;
                }
                .select-box .placeholder-text {
                    color: #ccc;
                }
                .dropdown-options {
                    display: none; 
                    position: absolute;
                    top: 100%; 
                    left: 0;
                    width: 100%;
                    background: #3a3a3a;
                    border: 1px solid #74B9FF;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    max-height: 150px;
                    overflow-y: auto;
                    z-index: 20;
                }
                .dropdown-options.show {
                    display: block; 
                }
                .dropdown-option {
                    display: block;
                    padding: 10px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                }
                .dropdown-option:hover {
                    background: #5aa0e6;
                }
                .dropdown-option input[type="checkbox"] {
                    margin-right: 10px;
                }
                .dropdown-option.disabled {
                    color: #888;
                    cursor: default;
                    background: none;
                }
                .empty-state {
                    text-align: center;
                    color: white;
                    padding: 60px 20px;
                }
                .empty-state-icon {
                    font-size: 80px;
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
            <h1 style="display: flex; justify-content: space-between; align-items: center; color: var(--vscode-editor-foreground);">
                <span>My PostIts</span>
                ${
                  this.notes.length > 0
                    ? `
                    <button id="deleteAll" style="
                        background: rgba(255, 50, 50, 0.85);
                        border: none;
                        color: white;
                        padding: 8px 14px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        transition: background 0.2s ease;
                    ">Delete All</button>
                `
                    : ""
                }
            </h1>
                ${
                  this.notes.length === 0
                    ? `
                    <div class="empty-state">
                        <h2>No existing notes</h2>
                    </div>
                `
                    : `
                    <div class="notes-grid">
                        ${notesHtml}
                    </div>
                `
                }
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();

                // --- 1. DATA IS NOW INJECTED DIRECTLY ---
                // (this.emailList comes from your NoteManager class)
                const emailListFromExtension = ${JSON.stringify(
                  this.emailList
                )};

                /**
                 * Populates all dropdowns on the page with the email list.
                 */
                function populateAllDropdowns(emailMap) {
                  document.querySelectorAll('.dropdown-options').forEach(dropdown => {
                    dropdown.innerHTML = '';

                    const names = Object.keys(emailMap);
                    if (names.length > 0) {
                      names.forEach(name => {
                        const email = emailMap[name];
                        const optionLabel = document.createElement('label');
                        optionLabel.className = 'dropdown-option';
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = email; // still send email
                        optionLabel.appendChild(checkbox);
                        optionLabel.appendChild(document.createTextNode(' ' + name)); // display name
                        dropdown.appendChild(optionLabel);
                      });
                    } else {
                      const disabledLabel = document.createElement('label');
                      disabledLabel.className = 'dropdown-option disabled';
                      disabledLabel.textContent = 'No contacts found.';
                      dropdown.appendChild(disabledLabel);
                    }
                  });
                }
                // --- 2. RUN THE POPULATION CODE ONCE THE PAGE IS LOADED ---
                window.addEventListener('DOMContentLoaded', () => {
                    populateAllDropdowns(emailListFromExtension);
                });
                

                // --- (Rest of your script: button listeners, etc.) ---
                
                document.querySelectorAll('.delete-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const noteEl = e.target.closest('.postit');
                        const noteId = noteEl.getAttribute('data-id');
                        vscode.postMessage({ type: 'deleteNote', id: noteId });
                    });
                });

                const deleteAllBtn = document.getElementById('deleteAll');
                    if (deleteAllBtn) {
                        deleteAllBtn.addEventListener('click', () => {
                            vscode.postMessage({ type: 'deleteAll' });
                        });
                    }
                document.querySelectorAll('.edit-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const noteEl = e.target.closest('.postit');
                        const noteId = noteEl.getAttribute('data-id');

                        // Toggle edit mode for this note
                        if (noteEl.classList.contains('expanded-edit')) {
                            exitEditMode(noteId);
                        } else {
                            enterEditMode(noteId);
                            noteEl.classList.add('expanded-edit');
                            noteEl.classList.remove('expanded');   
                        }
                    });
                });

                function enterEditMode(noteId) {
                    const noteElement = document.querySelector(\`.postit[data-id="\${noteId}"]\`);
                    const contentDiv = document.getElementById(\`content-\${noteId}\`);
                    const editDiv = document.getElementById(\`edit-\${noteId}\`);
                    const textarea = document.getElementById(\`textarea-\${noteId}\`);

                    // Expand and center the note
                    noteElement.classList.add('expanded-edit');

                    // Dim other notes
                    document.querySelectorAll('.postit').forEach(otherNote => {
                        if (otherNote !== noteElement) {
                            otherNote.classList.add('dimmed'); // Apply dimming effect to other notes
                        }
                    });

                    // Show the edit form
                    contentDiv.style.display = 'none';
                    editDiv.style.display = 'block';

                    // Set the textarea content to the current content of the note
                    textarea.value = contentDiv.textContent.trim(); // Assuming you're copying the content to the textarea
                    textarea.focus();
                    textarea.select();

                    // Set the editing state to the current noteId
                    editingNoteId = noteId;
                }

                // Function to exit edit mode
                function exitEditMode(noteId) {
                    const noteElement = document.querySelector(\`.postit[data-id="\${noteId}"]\`);
                    const contentDiv = document.getElementById(\`content-\${noteId}\`);
                    const editDiv = document.getElementById(\`edit-\${noteId}\`);

                    if (!noteElement) return;

                    // Revert to normal state
                    noteElement.classList.remove('expanded', 'expanded-edit');
                    noteElement.style.position = '';
                    noteElement.style.top = '';
                    noteElement.style.left = '';
                    noteElement.style.transform = '';
                    noteElement.style.width = '';
                    noteElement.style.height = '';
                    noteElement.style.zIndex = '';
                    noteElement.style.transition = '';

                    // Remove dimming from other notes
                    document.querySelectorAll('.postit').forEach(otherNote => {
                        otherNote.classList.remove('dimmed');
                    });

                    // Show the content and hide the edit form
                    if (contentDiv && editDiv) {
                        contentDiv.style.display = 'block';
                        editDiv.style.display = 'none';
                    }

                    // Remove global expanded-mode lock
                    document.body.classList.remove('expanded-mode');

                    editingNoteId = null;
                }


                document.querySelectorAll('.email-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                      const noteId = e.target.getAttribute('data-id');
                      const noteElement = document.querySelector(\`.postit[data-id="\${noteId}"]\`);
                      const contentDiv = document.getElementById(\`content-\${noteId}\`);
                      const emailDiv = document.getElementById(\`email-\${noteId}\`);
                      const userInput = document.getElementById(\`userInput-\${noteId}\`);

                      // Prevent expanding the note for email mode
                      noteElement.classList.add('expanded-email');  // Use email-specific expanded class
                      noteElement.classList.remove('expanded-edit'); // Remove edit-specific expanded class

                      contentDiv.style.display = 'none';
                      emailDiv.style.display = 'block';
                      userInput.focus();
                  });
                });

                document.querySelectorAll('.save-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const noteId = e.target.getAttribute('data-id');
                        const textarea = document.getElementById(\`textarea-\${noteId}\`);
                        const content = textarea.value;
                        
                        // Post save event
                        vscode.postMessage({ 
                            type: 'saveNoteEdit', 
                            noteId: noteId, 
                            content: content 
                        });

                        // Exit edit mode after save
                        exitEditMode(noteId);
                    });
                });

                document.querySelectorAll('.cancel-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const noteId = e.target.getAttribute('data-id');
                        exitEditMode(noteId);
                    });
                });

                // --- EMAIL FORM HANDLERS ---
                document.querySelectorAll('.send-email-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const noteId = e.target.getAttribute('data-id');
                        const userInput = document.getElementById('userInput-' + noteId);
                        const userEmail = userInput.value.trim();
                        
                        const dropdown = document.getElementById('recipientDropdown-' + noteId);
                        const checkedInputs = dropdown.querySelectorAll('input[type="checkbox"]:checked');
                        const selectedEmails = Array.from(checkedInputs).map(input => input.value);
                        
                        if (selectedEmails.length === 0) {
                            alert('Please select at least one recipient.');
                            return;
                        }
                        if (!userEmail) {
                            alert('Please enter your email address.');
                            userInput.focus();
                            return;
                        }
                        
                        const recipientEmail = selectedEmails.join(', ');

                        vscode.postMessage({ 
                            type: 'sendNoteEmail', 
                            noteId: noteId, 
                            userEmail: userEmail,       
                            recipientEmail: recipientEmail 
                        });
                    });
                });

                document.querySelectorAll('.cancel-email-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const noteId = e.target.getAttribute('data-id');
                        vscode.postMessage({ 
                            type: 'cancelEmail', 
                            noteId: noteId 
                        });
                    });
                });

                // --- DROPDOWN EVENT LISTENERS (DELEGATED) ---
                document.body.addEventListener('click', (e) => {
                    const selectBox = e.target.closest('.select-box');
                    
                    if (selectBox) {
                        e.preventDefault();
                        const container = selectBox.closest('.multiselect-container');
                        const dropdown = container.querySelector('.dropdown-options');
                        
                        document.querySelectorAll('.dropdown-options.show').forEach(d => {
                            if (d !== dropdown) {
                                d.classList.remove('show');
                            }
                        });
                        dropdown.classList.toggle('show');
                        
                    } else if (!e.target.closest('.multiselect-container')) {
                        document.querySelectorAll('.dropdown-options.show').forEach(d => {
                            d.classList.remove('show');
                        });
                    }
                });

                document.body.addEventListener('change', (e) => {
                  if (e.target.type === 'checkbox' && e.target.closest('.dropdown-options')) {
                    const container = e.target.closest('.multiselect-container');
                    const noteId = container.dataset.noteId;
                    const placeholder = document.getElementById(\`recipientPlaceholder-\${noteId}\`);
                    const checkedInputs = container.querySelectorAll('input[type="checkbox"]:checked');
                    const names = Array.from(checkedInputs).map(c => c.parentNode.textContent.trim());
                    
                    // Helper to measure text width
                    function getTextWidth(text, font) {
                      const canvas = document.createElement('canvas');
                      const context = canvas.getContext('2d');
                      context.font = font || getComputedStyle(placeholder).font;
                      return context.measureText(text).width;
                    }

                    if (names.length === 0) {
                      placeholder.textContent = 'Select recipients...';
                      placeholder.classList.add('placeholder-text');
                      return;
                    }

                    placeholder.classList.remove('placeholder-text');
                    const font = getComputedStyle(placeholder).font;
                    const boxWidth = placeholder.closest('.select-box').clientWidth - 20;
                    let displayText = '';

                    if (names.length > 2) {
                      displayText = names.slice(0, names.length - 1).join(', ') + ', and ' + names[names.length - 1];
                    } else if (names.length === 2) {
                      displayText = names.join(' and ');
                    } else {
                      displayText = names[0];
                    }

                    // If the text is too long, shorten it
                    if (getTextWidth(displayText, font) > boxWidth) {
                      let shownNames = [];
                      for (let i = 0; i < names.length; i++) {
                        const testText = shownNames.concat(names[i]).join(', ') + ', and ' + (names.length - i - 1) + ' others';
                        if (getTextWidth(testText, font) > boxWidth) {
                          displayText = shownNames.join(', ') + ', and ' + (names.length - i) + ' others';
                          break;
                        }
                        shownNames.push(names[i]);
                      }
                    }

                    if (displayText.charAt(0) === ',') {
                      displayText = \`\${names.length} selected\`;
                    }

                    placeholder.textContent = displayText;
                  }
                });

                // --- 3. MESSAGE LISTENER NO LONGER NEEDS 'loadEmails' ---
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    // The 'loadEmails' 'if' block has been removed.
                    
                    if (message.type === 'toggleEditMode') {
                        const noteId = message.noteId;
                        const noteElement = document.querySelector(\`.postit[data-id="\${noteId}"]\`);
                        const contentDiv = document.getElementById(\`content-\${noteId}\`);
                        const editDiv = document.getElementById(\`edit-\${noteId}\`);
                        const textarea = document.getElementById(\`textarea-\${noteId}\`);
                        
                        contentDiv.style.display = 'none';
                        editDiv.style.display = 'block';
                        noteElement.classList.add('expanded');
                        
                        textarea.value = message.content;
                        textarea.focus();
                        textarea.select();
                    }
                    
                    if (message.type === 'exitEditMode') {
                        const noteId = message.noteId;
                        const noteElement = document.querySelector(\`.postit[data-id="\${noteId}"]\`);
                        const contentDiv = document.getElementById(\`content-\${noteId}\`);
                        const editDiv = document.getElementById(\`edit-\${noteId}\`);
                        
                        contentDiv.style.display = 'block';
                        editDiv.style.display = 'none';
                        noteElement.classList.remove('expanded');
                    }
                    
                    if (message.type === 'toggleEmailMode') {
                        const noteId = message.noteId;
                        const noteElement = document.querySelector(\`.postit[data-id="\${noteId}"]\`);
                        const contentDiv = document.getElementById(\`content-\${noteId}\`);
                        const emailDiv = document.getElementById(\`email-\${noteId}\`);
                        const userInput = document.getElementById(\`userInput-\${noteId}\`); 
                        
                        contentDiv.style.display = 'none';
                        emailDiv.style.display = 'block';
                        noteElement.classList.add('expanded');
                        userInput.focus();
                    }
                    
                    if (message.type === 'exitEmailMode') {
                        const noteId = message.noteId;
                        const noteElement = document.querySelector(\`.postit[data-id="\${noteId}"]\`);
                        const contentDiv = document.getElementById(\`content-\${noteId}\`);
                        const emailDiv = document.getElementById(\`email-\${noteId}\`);
                        
                        contentDiv.style.display = 'block';
                        emailDiv.style.display = 'none';
                        noteElement.classList.remove('expanded');
                    }
                });
                document.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') {
                        // Find the currently expanded note, if any
                        const expandedNote = document.querySelector('.postit.expanded-edit');
                        if (expandedNote) {
                            const noteId = expandedNote.getAttribute('data-id');
                            if (noteId) {
                                exitEditMode(noteId);
                            }
                        }
                    }
                });
            </script>
        </body>
        </html>`;
  }
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Get notes count
   */
  getNotesCount() {
    return this.notes.length;
  }

  /**
   * Refresh notes from file (useful for debugging)
   */
  async refreshNotes() {
    this.notes = this.loadNotes();
    console.log("Notes refreshed. Total notes:", this.notes.length);
    return this.notes.length;
  }

  /**
   * Close a ticket in the database when a note is deleted
   * @param {string} ticketId - UUID of the ticket to close
   */
  async closeTicket(ticketId) {
    try {
      const { getSupabase } = require("../src/supabaseClient");
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('tickets')
        .update({ 
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error("Error closing ticket:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error in closeTicket:", error);
      throw error;
    }
  }

  /**
   * Reopen a ticket in the database when a note is restored
   * @param {string} ticketId - UUID of the ticket to reopen
   */
  async reopenTicket(ticketId) {
    try {
      const { getSupabase } = require("../src/supabaseClient");
      const supabase = getSupabase();
      
      const { data, error } = await supabase
        .from('tickets')
        .update({ 
          status: 'open',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error("Error reopening ticket:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error in reopenTicket:", error);
      throw error;
    }
  }
}

module.exports = { NoteManager };
