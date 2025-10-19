const vscode = require('vscode');

class NoteManager {
    constructor(context) {
        this.context = context;
        this.notes = context.globalState.get('postItNotes', []);
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

            await this.viewAllNotes();


            return newNote;
        }

        return null;
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

        const panel = vscode.window.createWebviewPanel(
            'postItNotes',
            'My Post-It Notes',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

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

            //handles editing a note
            if (message.type === 'editNote') {
                const noteId = parseInt(message.id);
                const note = this.notes.find(n => n.id === noteId);
                if (!note) return;
            
                const newContent = await vscode.window.showInputBox({
                    prompt: 'Edit your note',
                    value: note.content,
                    ignoreFocusOut: true,
                    validateInput: (text) => {
                        return text.trim().length === 0 ? 'Note cannot be empty' : null;
                    }
                });
            
                if (newContent && newContent.trim()) {
                    note.content = newContent.trim();
                    note.timestamp = new Date().toISOString();
                    await this.saveNotes();
            
                    vscode.window.showInformationMessage('Note updated successfully.');
                    panel.webview.html = this.getWebviewContent(); // Refresh the view
                }
            }
            
        });

        panel.webview.html = this.getWebviewContent();

        
    }


    /**
     * Save notes to global state
     */
    async saveNotes() {
        await this.context.globalState.update('postItNotes', this.notes);
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
                <div class="postit-content">${this.escapeHtml(note.content)}</div>
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
                <span>My Post-It Notes</span>
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
                <h1> My Post-It Notes</h1>
                ${this.notes.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <h2>No notes yet!</h2>
                        <p>Use the "Add Note" command to create your first Post-It note.</p>
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
}

module.exports = { NoteManager };

