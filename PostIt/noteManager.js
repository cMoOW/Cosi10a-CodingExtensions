const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class NoteManager {
    constructor(context, onNotesChanged = null) {
        this.context = context;
        this.notesFilePath = path.join(context.globalStorageUri.fsPath, 'postItNotes.json');
        this.notes = this.loadNotes();
        this.activePanel = null; // Track the active webview panel
        this.onNotesChanged = onNotesChanged; // Callback for when notes change
        console.log('NoteManager initialized with', this.notes.length, 'existing notes');
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
                const data = fs.readFileSync(this.notesFilePath, 'utf8');
                const notes = JSON.parse(data);
                console.log('Loaded', notes.length, 'notes from file');
                return notes;
            }
        } catch (error) {
            console.error('Error loading notes:', error);
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
                color: await this.selectNoteColor()
            };

            this.notes.push(newNote);
            await this.saveNotes();
            
            vscode.window.showInformationMessage(` Note added: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);

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
    async showFloatingEditor(initialContent = '') {
        const panel = vscode.window.createWebviewPanel(
            'floatingNoteEditor',
            'Add New Post-It Note',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: false
            }
        );

        panel.webview.html = this.getFloatingEditorHTML(initialContent);

        // Handle messages from the floating editor
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'saveNote') {
                const content = message.content.trim();
                if (content) {
                    const newNote = {
                        id: Date.now(),
                        content: content,
                        timestamp: new Date().toISOString(),
                        color: await this.selectNoteColor()
                    };

                    this.notes.push(newNote);
                    await this.saveNotes();
                    
                    vscode.window.showInformationMessage(`Note added: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
                    
                    // Refresh the active panel if it exists
                    if (this.activePanel) {
                        this.activePanel.webview.html = this.getWebviewContent();
                    }
                    
                    panel.dispose();
                } else {
                    vscode.window.showWarningMessage('Note cannot be empty');
                }
            }
            
            if (message.type === 'cancelNote') {
                panel.dispose();
            }
        });
    }



    /**
     * Show inline note editor that appears over the code editor
     */
    async showInlineNoteEditor(initialContent = '') {
        const panel = vscode.window.createWebviewPanel(
            'inlineNoteEditor',
            'Quick Note',
            vscode.ViewColumn.Beside, // Open beside the current editor
            {
                enableScripts: true,
                retainContextWhenHidden: false
            }
        );

        panel.webview.html = this.getInlineEditorHTML(initialContent);

        // Handle messages from the inline editor
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'saveNote') {
                const content = message.content.trim();
                if (content) {
                    const newNote = {
                        id: Date.now(),
                        content: content,
                        timestamp: new Date().toISOString(),
                        color: await this.selectNoteColor()
                    };

                    this.notes.push(newNote);
                    await this.saveNotes();
                    
                    vscode.window.showInformationMessage(`Note added: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
                    
                    // Refresh the active panel if it exists
                    if (this.activePanel) {
                        this.activePanel.webview.html = this.getWebviewContent();
                    }
                    
                    panel.dispose();
                } else {
                    vscode.window.showWarningMessage('Note cannot be empty');
                }
            }
            
            if (message.type === 'cancelNote') {
                panel.dispose();
            }
        });
    }

    /**
     * Select note color
     */
    async selectNoteColor() {
        const colors = [
            '#355E3B', // Dark Green
            '#699987', // Mint Green
            '#8d698d'  // Soft Lavender
        ];
    
        // Pick a random color each time
        const randomIndex = Math.floor(Math.random() * colors.length);
        return colors[randomIndex];

    }

    /**
     * View all notes
     */
    async viewAllNotes() {
        if (this.notes.length === 0) {
            vscode.window.showInformationMessage(' No Post-It notes yet! Add one to get started.');
            return;
        }

        // If there's already an active panel, just refresh it
        if (this.activePanel) {
            this.activePanel.webview.html = this.getWebviewContent();
            this.activePanel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'postItNotes',
            'My Post-It Notes',
            vscode.ViewColumn.One,
            {
                enableScripts: true
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
            if (message.type === 'deleteNote') {
                const noteId = parseInt(message.id);
                const deletedNote = this.notes.find(n => n.id === noteId);
                this.notes = this.notes.filter(n => n.id !== noteId);
                await this.saveNotes();
    
                // Offer Undo option
                vscode.window.showInformationMessage('Note deleted.', 'Undo').then(async (selection) => {
                    if (selection === 'Undo' && deletedNote) {
                        this.notes.push(deletedNote);
                        await this.saveNotes();
                        vscode.window.showInformationMessage('Note restored.');
                        panel.webview.html = this.getWebviewContent(); // Refresh view
                    }
                });
    
                panel.webview.html = this.getWebviewContent(); // Refresh view
            }

            //handles deleting all notes
            if (message.type === 'deleteAll') {
                if (this.notes.length === 0) {
                    vscode.window.showInformationMessage('There are no notes to delete.');
                    return;
                }
        
                const deletedNotesBackup = [...this.notes]; // backup for undo
                this.notes = [];
                await this.saveNotes();
                panel.webview.html = this.getWebviewContent();
        
                vscode.window.showInformationMessage('🧹 All notes deleted.', 'Undo').then(async (selection) => {
                    if (selection === 'Undo') {
                        this.notes = deletedNotesBackup;
                        await this.saveNotes();
                        vscode.window.showInformationMessage('All notes restored.');
                        panel.webview.html = this.getWebviewContent();
                    }
                });
            }

            //handles editing a note (inline editing)
            if (message.type === 'editNote') {
                const noteId = parseInt(message.id);
                const note = this.notes.find(n => n.id === noteId);
                if (!note) return;
            
                // Toggle edit mode in the webview
                panel.webview.postMessage({ 
                    type: 'toggleEditMode', 
                    noteId: noteId,
                    content: note.content 
                });
            }

            //handles saving edited note content
            if (message.type === 'saveNoteEdit') {
                const noteId = parseInt(message.noteId);
                const newContent = message.content;
                const note = this.notes.find(n => n.id === noteId);
                
                if (note && newContent && newContent.trim()) {
                    note.content = newContent.trim();
                    note.timestamp = new Date().toISOString();
                    await this.saveNotes();
                    
                    // Exit edit mode and refresh
                    panel.webview.postMessage({ 
                        type: 'exitEditMode', 
                        noteId: noteId 
                    });
                    panel.webview.html = this.getWebviewContent();
                }
            }

            //handles canceling edit
            if (message.type === 'cancelEdit') {
                const noteId = parseInt(message.noteId);
                panel.webview.postMessage({ 
                    type: 'exitEditMode', 
                    noteId: noteId 
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
            console.log('Saved', this.notes.length, 'notes to file');
            
            // Also save to global state as backup
            await this.context.globalState.update('postItNotes', this.notes);
            
            // Notify that notes have changed
            this.notifyNotesChanged();
        } catch (error) {
            console.error('Error saving notes:', error);
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
    getFloatingEditorHTML(initialContent = '') {
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
                <textarea class="editor-textarea" id="noteContent" placeholder="Enter your note content here...">${this.escapeHtml(initialContent)}</textarea>
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
    getInlineEditorHTML(initialContent = '') {
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
                    <h3 class="editor-title">📝 Quick Note</h3>
                    <button class="close-btn" id="closeBtn">×</button>
                </div>
                <textarea class="editor-textarea" id="noteContent" placeholder="Type your note here...">${this.escapeHtml(initialContent)}</textarea>
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
        const notesHtml = this.notes.map(note => `
            <div class="postit" style="background-color: ${note.color}" data-id="${note.id}">
                <div class="postit-header">
                    <span class="postit-date">${new Date(note.timestamp).toLocaleDateString()}</span>
                    <button class="delete-btn" title="Delete Note">×</button>
                </div>
                <div class="postit-content" id="content-${note.id}">${this.escapeHtml(note.content)}</div>
                <div class="postit-edit" id="edit-${note.id}" style="display: none;">
                    <textarea class="edit-textarea" id="textarea-${note.id}" placeholder="Edit your note...">${this.escapeHtml(note.content)}</textarea>
                    <div class="edit-buttons">
                        <button class="save-btn" data-id="${note.id}">Save</button>
                        <button class="cancel-btn" data-id="${note.id}">Cancel</button>
                    </div>
                </div>
                <button class="edit-btn" title="Edit Note">Edit</button>
            </div>
        `).join('');

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
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 20px;
                    padding: 20px 0;
                }
                .postit {
                    padding: 20px;
                    border-radius: 3px;
                    box-shadow: 5px 5px 15px rgba(0,0,0,0.3);
                    transform: rotate(-2deg);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    min-height: 150px;
                    position: relative;
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
                position: absolute;
                bottom:8px;
                right:8px;
                background: rgba(0, 0, 0, 0.2);
                border: none;
                color: white;
                font-size: 14px;
                border-radius: 4px;
                padding: 4px 6px;
                cursor: pointer;
                transition: background 0.2s ease;
                }
                .edit-btn:hover {
                    background: rgba(0, 0, 0, 0.4);
                }
                .postit-content {
                    color: #ffffff;
                    font-size: 14px;
                    line-height: 1.6;
                    word-wrap: break-word;
                    white-space: pre-wrap;
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
                ${this.notes.length > 0 ? `
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
                ` : ''}
            </h1>
                ${this.notes.length === 0 ? `
                    <div class="empty-state">
                        <h2>No existing notes</h2>
                    </div>
                ` : `
                    <div class="notes-grid">
                        ${notesHtml}
                    </div>
                `}
            </div>
            <script>
                const vscode = acquireVsCodeApi();
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

                // Handle save and cancel buttons for inline editing
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

                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.type === 'toggleEditMode') {
                        const noteId = message.noteId;
                        const contentDiv = document.getElementById('content-' + noteId);
                        const editDiv = document.getElementById('edit-' + noteId);
                        const textarea = document.getElementById('textarea-' + noteId);
                        
                        // Hide content, show edit mode
                        contentDiv.style.display = 'none';
                        editDiv.style.display = 'block';
                        
                        // Set textarea content and focus
                        textarea.value = message.content;
                        textarea.focus();
                        textarea.select();
                    }
                    
                    if (message.type === 'exitEditMode') {
                        const noteId = message.noteId;
                        const contentDiv = document.getElementById('content-' + noteId);
                        const editDiv = document.getElementById('edit-' + noteId);
                        
                        // Show content, hide edit mode
                        contentDiv.style.display = 'block';
                        editDiv.style.display = 'none';
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
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
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
        console.log('Notes refreshed. Total notes:', this.notes.length);
        return this.notes.length;
    }
}

module.exports = { NoteManager };

