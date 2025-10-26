// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// Import the highlighter functionality from the new file
//const { activateHighlighter } = require('./src/highlight.js');
const { sendEmail } = require('./src/send-email.js');
const { NoteManager } = require('./PostIt/noteManager');
const { EmailUIManager } = require('./PostIt/emailUIManager');

const EMAIL_KEY = 'myExtension.userEmail';

// This method is called when your extension is activated
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

    // --- NEW COMMAND TO CLEAR EMAIL ---
    let clearEmailDisposable = vscode.commands.registerCommand('extension.clearEmail', async () => {
        // 1. Clear our stored email
        await context.globalState.update(EMAIL_KEY, undefined);
        vscode.window.showInformationMessage('Your stored email has been cleared.');
    });
    context.subscriptions.push(clearEmailDisposable);

    // Command to get email
    let getEmailDisposable = vscode.commands.registerCommand('extension.getUserEmail', () => {
        getUserEmail(context);
    });
    context.subscriptions.push(getEmailDisposable);

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

	let emailCodeDisposable = vscode.commands.registerCommand('test.emailCodeSnippet', async function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        const documentText = editor.document.getText();

        const emailUI = new EmailUIManager(context);
        const emailList = ["brianshen@brandeis.edu", "auppal@brandeis.edu", "jacobcarminati@brandeis.edu", "siminglin@brandeis.edu"];
        const storedEmail = context.globalState.get(EMAIL_KEY) || '';

        // Show the email editor window
        await emailUI.showEmailEditor(selectedText, emailList, storedEmail);

        // When user clicks "Send"
        emailUI.onSend(async ({ userEmail, recipients, noteContent }) => {
            try {
                // Validate user email
                if (!userEmail.endsWith('@brandeis.edu')) {
                    vscode.window.showErrorMessage('Your email must be a valid Brandeis email address.');
                    return;
                }
                // Validate recipient emails
                const invalidEmails = recipients.filter(e => !e.endsWith('@brandeis.edu'));
                if (invalidEmails.length > 0) {
                    vscode.window.showErrorMessage(`Invalid Brandeis emails: ${invalidEmails.join(', ')}`);
                    return;
                }

                // Store user email for next time
                await context.globalState.update(EMAIL_KEY, userEmail);

                // Send the actual email
                await sendEmail(selectedText, documentText, userEmail, recipients.join(','), noteContent);
                vscode.window.showInformationMessage('Email successfully sent!');

                // Optional: Add as a note
                await noteManager.addNote(noteContent);

            } catch (error) {
                vscode.window.showErrorMessage('Failed to send email: ' + error.message);
            }
        });
    });

 
	// Register all commands
	context.subscriptions.push(disposable);
	context.subscriptions.push(viewNotesCommand);
	context.subscriptions.push(addNoteCommand);
	context.subscriptions.push(addNoteFromSelectionCommand);
	context.subscriptions.push(emailCodeDisposable);

	// highlight TODO: Uncomment this line to enable the highlighter functionality
	// activateHighlighter(context);
}


function getUserEmail(context) {
    const storedEmail = context.globalState.get(EMAIL_KEY);
    if (storedEmail) {
        //vscode.window.showInformationMessage(`Your stored email is: ${storedEmail}`);
		console.log('Retrieved stored email:', storedEmail);
        return storedEmail;
    }else{
        //vscode.window.showInformationMessage('No stored email found.');
		console.log('No stored email found.');
        return null;
    }

}


// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate,
	getUserEmail
}
