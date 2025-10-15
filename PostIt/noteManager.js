const vscode = require('vscode');

class NoteManager {
    constructor(context) {
        this.context = context;
        this.notes = context.globalState.get('postItNotes', []);
    }

    /**
     * Add a new note
     */
    async addNote() {
        const note = await vscode.window.showInputBox({
            prompt: ' Enter your Post-It note',
            placeHolder: 'Type your note here...',
            ignoreFocusOut: true,
            validateInput: (text) => {
                return text.trim().length === 0 ? 'Note cannot be empty' : null;
            }
        });

        if (note && note.trim()) {
            const newNote = {
                id: Date.now(),
                content: note.trim(),
                timestamp: new Date().toISOString(),
                color: await this.selectNoteColor()
            };

            this.notes.push(newNote);
            await this.saveNotes();
            
            vscode.window.showInformationMessage(` Note added: "${note.substring(0, 30)}${note.length > 30 ? '...' : ''}"`);
            return newNote;
        }

        return null;
    }

    /**
     * Select note color
     */
    async selectNoteColor() {
        const colors = [
            { label: ' Yellow (Classic)', value: '#fff740' },
            { label: ' Pink', value: '#ff6b9d' },
            { label: ' Blue', value: '#00d4ff' },
            { label: ' Green', value: '#7bed9f' },
            { label: ' Orange', value: '#ffa502' },
            { label: ' Purple', value: '#a29bfe' }
        ];

        const selected = await vscode.window.showQuickPick(colors, {
            placeHolder: 'Choose a Post-It note color',
            ignoreFocusOut: true
        });

        return selected ? selected.value : '#fff740'; // Default to yellow
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
            ' My Post-It Notes',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'deleteNote') {
                const noteId = parseInt(message.id);
                this.notes = this.notes.filter(n => n.id !== noteId);
                await this.saveNotes();
                vscode.window.showInformationMessage('Note deleted.');
                panel.webview.html = this.getWebviewContent(); // Refresh the view
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
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                    color: rgba(0,0,0,0.5);
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
                .postit-content {
                    color: #333;
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

