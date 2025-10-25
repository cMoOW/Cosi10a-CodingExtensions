const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

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
    this.emailList = [
      "brianshen@brandeis.edu",
      "auppal@brandeis.edu",
      "jacobcarminati@brandeis.edu",
      "siminglin@brandeis.edu",
    ];
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
   */
  async addNote(message) {
    if (message && message.trim()) {
      const newNote = {
        id: Date.now(),
        content: message.trim(),
        timestamp: new Date().toISOString(),
        color: await this.selectNoteColor(),
      };

      this.notes.push(newNote);
      await this.saveNotes();

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
          const newNote = {
            id: Date.now(),
            content: content,
            timestamp: new Date().toISOString(),
            color: await this.selectNoteColor(),
          };

          this.notes.push(newNote);
          await this.saveNotes();

          vscode.window.showInformationMessage(
            `Note added: "${content.substring(0, 30)}${
              content.length > 30 ? "..." : ""
            }"`
          );

          // Refresh the active panel if it exists
          if (this.activePanel) {
            this.activePanel.webview.html = this.getWebviewContent();
          }

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

    panel.webview.html = this.getInlineEditorHTML(initialContent);

    // Handle messages from the inline editor
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "saveNote") {
        const content = message.content.trim();
        if (content) {
          const newNote = {
            id: Date.now(),
            content: content,
            timestamp: new Date().toISOString(),
            color: await this.selectNoteColor(),
          };

          this.notes.push(newNote);
          await this.saveNotes();

          vscode.window.showInformationMessage(
            `Note added: "${content.substring(0, 30)}${
              content.length > 30 ? "..." : ""
            }"`
          );

          // Refresh the active panel if it exists
          if (this.activePanel) {
            this.activePanel.webview.html = this.getWebviewContent();
          }

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
    this.context.globalState.update('myExtension.userEmail', userEmail);

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

        // Offer Undo option
        vscode.window
          .showInformationMessage("Note deleted.", "Undo")
          .then(async (selection) => {
            if (selection === "Undo" && deletedNote) {
              this.notes.push(deletedNote);
              await this.saveNotes();
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
        this.notes = [];
        await this.saveNotes();
        panel.webview.html = this.getWebviewContent();
        vscode.window
          .showInformationMessage("🧹 All notes deleted.", "Undo")
          .then(async (selection) => {
            if (selection === "Undo") {
              this.notes = deletedNotesBackup;
              await this.saveNotes();
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
                    background: #1e1e1e;
                    margin: 0;
                    height: 100vh;
                    overflow: hidden;
                }
                .inline-editor {
                    background: #2d2d30;
                    border: 1px solid #3e3e42;
                    border-radius: 6px;
                    padding: 15px;
                    height: calc(100vh - 30px);
                    display: flex;
                    flex-direction: column;
                }
                .editor-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #3e3e42;
                }
                .editor-title {
                    color: #cccccc;
                    font-size: 14px;
                    font-weight: 600;
                    margin: 0;
                }
                .close-btn {
                    background: none;
                    border: none;
                    color: #cccccc;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 2px 6px;
                    border-radius: 3px;
                }
                .close-btn:hover {
                    background: #3e3e42;
                }
                .editor-textarea {
                    flex: 1;
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #3e3e42;
                    border-radius: 4px;
                    background: #1e1e1e;
                    color: #cccccc;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.4;
                    resize: none;
                    outline: none;
                    box-sizing: border-box;
                }
                .editor-textarea:focus {
                    border-color: #007acc;
                }
                .editor-buttons {
                    display: flex;
                    gap: 8px;
                    margin-top: 10px;
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
                    background: #0e639c;
                    color: white;
                }
                .save-btn:hover {
                    background: #1177bb;
                }
                .cancel-btn {
                    background: #5a5a5a;
                    color: white;
                }
                .cancel-btn:hover {
                    background: #6a6a6a;
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
        // Check if content is long enough to need expand button
        const needsExpand =
          note.content.length > 200 || note.content.split("\n").length > 6;
        const expandButtonStyle = needsExpand ? "" : "display: none;";

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
                    <button class="expand-btn" title="Expand/Collapse Note" data-id="${
                      note.id
                    }" style="${expandButtonStyle}">▼</button>
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
                    background: #1f1f1f;
                    min-height: 100vh;
                }
                .container {
                    max-width: 1200px;
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
                    overflow: hidden;
                }
                .postit.expanded {
                    overflow: visible;
                    height: auto;
                    min-height: 200px;
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
                .postit.expanded .postit-content-wrapper {
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
                .postit-content.expanded {
                    -webkit-line-clamp: unset;
                    overflow: visible;
                    max-height: none;
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
                .edit-btn:hover, .email-btn:hover {
                    background: rgba(0, 0, 0, 0.4);
                }
                .postit-edit {
                    margin-top: 10px;
                }
                .edit-textarea {
                    width: 100%;
                    min-height: 100px;
                    padding: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.4;
                    resize: vertical;
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
            <h1 style="display: flex; justify-content: space-between; align-items: center; color: white;">
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
                function populateAllDropdowns(emails) {
                    document.querySelectorAll('.dropdown-options').forEach(dropdown => {
                        dropdown.innerHTML = ''; // Clear "Loading..."
                        
                        if (emails && emails.length > 0) {
                            emails.forEach(email => {
                                const optionLabel = document.createElement('label');
                                optionLabel.className = 'dropdown-option';
                                
                                const checkbox = document.createElement('input');
                                checkbox.type = 'checkbox';
                                checkbox.value = email;
                                
                                optionLabel.appendChild(checkbox);
                                optionLabel.appendChild(document.createTextNode(' ' + email));
                                dropdown.appendChild(optionLabel);
                            });
                        } else {
                            const disabledLabel = document.createElement('label');
                            disabledLabel.className = 'dropdown-option disabled';
                            disabledLabel.textContent = 'No emails found.';
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
                        vscode.postMessage({ type: 'editNote', id: noteId });
                    });
                });

                document.querySelectorAll('.email-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const noteId = e.target.getAttribute('data-id');
                        vscode.postMessage({ type: 'toggleEmailMode', noteId: noteId });
                    });
                });

                document.querySelectorAll('.expand-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const noteId = e.target.getAttribute('data-id');
                        const noteElement = e.target.closest('.postit');
                        const content = document.getElementById('content-' + noteId);
                        const expandBtn = e.target;
                        
                        if (noteElement.classList.contains('expanded')) {
                            noteElement.classList.remove('expanded');
                            content.classList.remove('expanded');
                            expandBtn.textContent = '▼';
                            expandBtn.classList.remove('expanded');
                        } else {
                            noteElement.classList.add('expanded');
                            content.classList.add('expanded');
                            expandBtn.textContent = '▲';
                            expandBtn.classList.add('expanded');
                        }
                    });
                });

                document.querySelectorAll('.save-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const noteId = e.target.getAttribute('data-id');
                        const textarea = document.getElementById('textarea-' + noteId);
                        const content = textarea.value;
                        vscode.postMessage({ 
                            type: 'saveNoteEdit', 
                            noteId: noteId, 
                            content: content 
                        });
                    });
                });

                document.querySelectorAll('.cancel-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const noteId = e.target.getAttribute('data-id');
                        vscode.postMessage({ 
                            type: 'cancelEdit', 
                            noteId: noteId 
                        });
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
        
                        // 1. Get the note's ID from the container
                        const noteId = container.dataset.noteId;
        
                        // 2. Find the placeholder by its unique ID, not its class
                        const placeholder = document.getElementById(\`recipientPlaceholder-\${noteId}\`);
                        
                        // 3. Find the checkboxes
                        const checkedInputs = container.querySelectorAll('input[type="checkbox"]:checked');
                        
                        // 4. This logic is now safe because 'placeholder' will always be found
                        if (checkedInputs.length === 0) {
                            placeholder.textContent = 'Select recipients...';
                            placeholder.classList.add('placeholder-text');
                        } else if (checkedInputs.length === 1) {
                            placeholder.textContent = checkedInputs[0].value;
                            placeholder.classList.remove('placeholder-text');
                        } else {
                            placeholder.textContent = \`\${checkedInputs.length} recipients selected\`;
                            placeholder.classList.remove('placeholder-text');
                        }
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
}

module.exports = { NoteManager };
