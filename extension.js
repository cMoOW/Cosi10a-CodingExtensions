// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// Import the highlighter functionality from the new file
//const { activateHighlighter } = require('./src/highlight.js');
const { sendHelloEmail } = require('./src/send-email.js');
const { NoteManager } = require('./PostIt/noteManager');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "test" is now active!');
	vscode.window.showInformationMessage('This extension is now active!');
	
	// Create status bar item for notes
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'test.viewNotes';
	statusBarItem.tooltip = 'Click to view your Post-It notes';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// Initialize Note Manager with callback for status bar updates
	const noteManager = new NoteManager(context, (notesCount) => {
		statusBarItem.text = `$(note) ${notesCount} notes`;
	});
	
	// Set initial status bar text
	statusBarItem.text = `$(note) ${noteManager.getNotesCount()} notes`; 

	// Helper function to update status bar (now handled by callback)
	const updateStatusBar = async () => {
		await noteManager.refreshNotes();
		// Status bar will be updated automatically by the callback
	};

	const disposable = vscode.commands.registerCommand('test.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello world has been run');
	});

	// View Notes Command
	let viewNotesCommand = vscode.commands.registerCommand('test.viewNotes', async () => {
		await updateStatusBar(); // Refresh notes before viewing
		await noteManager.viewAllNotes();
	});

	// Add Note Command 
	let addNoteCommand = vscode.commands.registerCommand('test.addNote', async () => {
		await noteManager.showFloatingEditor();
	});

	// Add Note from Selection Command
	let addNoteFromSelectionCommand = vscode.commands.registerCommand('test.addNoteFromSelection', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const selection = editor.selection;
			const selectedText = editor.document.getText(selection);
			
			if (selectedText.trim()) {
				await noteManager.showInlineNoteEditor(selectedText);
			} else {
				vscode.window.showWarningMessage('Please select some text to add as a note.');
			}
		}
	});


	async function sendEmailCommandHandler(highlightedText, documentText, noteManager) {
		const panel = vscode.window.createWebviewPanel(
			'emailPopup',
			'Send Code Snippet via Email',
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: false
			}
		);
	
		panel.webview.html = getEmailFormHTML();
	
		// Listen for messages from the webview
		panel.webview.onDidReceiveMessage(async (message) => {
			if (message.type === 'submitEmailForm') {
				const { email, userMessage } = message.data;
	
				// Validate multiple emails
				const emails = email.split(',').map(e => e.trim());
				const invalidEmails = emails.filter(e => !e.endsWith('@brandeis.edu'));
				
				if (invalidEmails.length > 0) {
					vscode.window.showErrorMessage(`Invalid Brandeis emails: ${invalidEmails.join(', ')}`);
					return;
				}
	
				try {
					await sendHelloEmail(highlightedText, documentText, email, userMessage);
					vscode.window.showInformationMessage('Email successfully sent!');
					panel.dispose();
	
					// Optional: Add the message as a Post-It note
					await noteManager.addNote(userMessage);
					await updateStatusBar(); // Refresh and update status bar

				} catch (error) {
					vscode.window.showErrorMessage('Failed to send email: ' + error.message);
				}
			}
		});
		
		// try {
		//    // 1. Prompt for the email body, need validation!!
		//   let email = await vscode.window.showInputBox({
		// 	prompt: "Enter your Brandeis email",
		// 	placeHolder: "Type your Brandeis email here..."
		//   });
		//   while (!email || !email.includes('@brandeis.edu')) {
		// 	vscode.window.showInformationMessage('Please enter a valid Brandeis email address.');
		// 	email = await vscode.window.showInputBox({
		// 	  prompt: "Enter your Brandeis email",
		// 	  placeHolder: "Type your Brandeis email here..."
		// 	});
		//   }
	  
		//   // redundant now with validation loop above
		//   //if (!email) return vscode.window.showInformationMessage('Email sending cancelled.');
		 
		//   const message = await vscode.window.showInputBox({
		// 	prompt: "Enter your message",
		// 	placeHolder: "Type your message here..."
		//   });
	  
		//   if (!message) return vscode.window.showInformationMessage('Email sending cancelled.');
		//   // Call the email service with all the user's input
		//   const messageId = await sendHelloEmail(highlightedText, documentText, email, message);
	  
		//   console.log('Email sent successfully. Message ID:', messageId);
		//   // vscode.window.showInformationMessage(`Email successfully sent! Message ID: ${messageId}`);
		//   vscode.window.showInformationMessage('Email successfully sent!');
	  
	  
		//   await noteManager.addNote(message);
		// 	statusBarItem.text = `$(note) ${noteManager.getNotesCount()} notes`;
	  
		// } catch (error) {
		//   console.error('Error sending email:', error);
		//   vscode.window.showErrorMessage('Failed to send email: ' + error.message);
		// }
	  }

	  let emailCodeDisposable = vscode.commands.registerCommand('test.emailCodeSnippet', function () {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const selection = editor.selection;
			const selectedText = editor.document.getText(selection);
			sendEmailCommandHandler(selectedText, editor.document.getText(), noteManager);
		}
	});
 
	// const emailCodeDisposable = vscode.commands.registerCommand('test.emailCodeSnippet', function () {
	// 	// Get the active text editor
		
	// 	const editor = vscode.window.activeTextEditor;
	// 	if (editor) {
	// 		const selection = editor.selection;
	// 		const selectedText = editor.document.getText(selection);
	// 		console.log('Selected text:', selectedText);
	// 		vscode.window.showInformationMessage(`Selected text logged to console: ${selectedText}`);
			
	// 		sendEmailCommandHandler(selectedText, editor.document.getText());
	// 	}
	// });

	// Register all commands
	context.subscriptions.push(disposable);
	context.subscriptions.push(viewNotesCommand);
	context.subscriptions.push(addNoteCommand);
	context.subscriptions.push(addNoteFromSelectionCommand);
	context.subscriptions.push(emailCodeDisposable);

	// highlight TODO: Uncomment this line to enable the highlighter functionality
	// activateHighlighter(context);
}


function getEmailFormHTML() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Code Snippet</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, sans-serif;
                padding: 20px;
                background: #1e1e1e;
                color: #fff;
            }
            h2 {
                text-align: center;
                color: #fff;
                margin-bottom: 20px;
            }
            form {
                display: flex;
                flex-direction: column;
                gap: 15px;
                background: #2c2c2c;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
            }
            label {
                font-weight: 500;
            }
            input, textarea {
                width: 100%;
                padding: 10px;
                border-radius: 4px;
                border: none;
                font-size: 14px;
                background: #3a3a3a;
                color: white;
                outline: none;
            }
            input:focus, textarea:focus {
                border: 1px solid #74B9FF;
            }
            button {
                background: #74B9FF;
                color: #1e1e1e;
                padding: 10px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                transition: 0.2s ease;
            }
            button:hover {
                background: #5aa0e6;
            }
        </style>
    </head>
    <body>
        <h2>Send Your Code Snippet</h2>
        <form id="emailForm">
            <div>
                <label for="email">Brandeis Email(s):</label>
                <input type="text" id="email" placeholder="name@brandeis.edu, name1@brandeis.edu, ... required />
                <small style="color: #888; font-size: 12px;">Separate multiple emails with commas</small>
            </div>
            <div>
                <label for="message">Message:</label>
                <textarea id="message" rows="4" placeholder="Enter your message..." required></textarea>
            </div>
            <button type="submit">Send Email</button>
        </form>

        <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('emailForm').addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value.trim();
                const userMessage = document.getElementById('message').value.trim();
                vscode.postMessage({
                    type: 'submitEmailForm',
                    data: { email, userMessage }
                });
            });
        </script>
    </body>
    </html>
    `;
}


/**
 * Handles the logic for the "helloWorld" command.
 * It prompts the user for email details and calls the email service.
 */


// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
