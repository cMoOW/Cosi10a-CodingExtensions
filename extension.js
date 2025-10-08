// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// Import the highlighter functionality from the new file
//const { activateHighlighter } = require('./src/highlight.js');
const { sendHelloEmail } = require('./src/send-email.js');
const { NoteManager } = require('./PostIt/noteManager');

// Create a decoration type - this is like defining a CSS class
let todoDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 255, 0, 0.3)', // Yellow background
    borderColor: 'rgba(255, 255, 0, 0.5)',
    borderWidth: '1px',
    borderStyle: 'solid',
    overviewRulerColor: 'yellow', // Shows a mark in the overview ruler
    overviewRulerLane: vscode.OverviewRulerLane.Right,
});


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
	
	const disposable = vscode.commands.registerCommand('test.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello world has been run');
    // Send the email when the command is executed
   // sendEmailCommandHandler();
    context.subscriptions.push(disposable);
	});
 
  const emailCodeDisposable = vscode.commands.registerCommand('test.emailCodeSnippet', function () {
    // Get the active text editor
    
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        console.log('Selected text:', selectedText);
        vscode.window.showInformationMessage(`Selected text logged to console: ${selectedText}`);
        
        sendEmailCommandHandler(selectedText, editor.document.getText());
    }
    
    context.subscriptions.push(emailCodeDisposable);
  });
  // highlight TODO: Uncomment this line to enable the highlighter functionality
    //activateHighlighter(context);
}

/**
 * Handles the logic for the "helloWorld" command.
 * It prompts the user for email details and calls the email service.
 */
async function sendEmailCommandHandler(highlightedText, documentText) {
  try {
     // 1. Prompt for the email body
    const email = await vscode.window.showInputBox({
      prompt: "Enter your email",
      placeHolder: "Type your email here..."
    });
    if (!email) return vscode.window.showInformationMessage('Email sending cancelled.');
    const message = await vscode.window.showInputBox({
      prompt: "Enter your message",
      placeHolder: "Type your message here..."
    });
    if (!message) return vscode.window.showInformationMessage('Email sending cancelled.');
    // Call the email service with all the user's input
    const messageId = await sendHelloEmail(highlightedText, documentText, email, message);

    console.log('Email sent successfully. Message ID:', messageId);
    // vscode.window.showInformationMessage(`Email successfully sent! Message ID: ${messageId}`);
    vscode.window.showInformationMessage('Email successfully sent!');

  } catch (error) {
    console.error('Error sending email:', error);
    vscode.window.showErrorMessage('Failed to send email: ' + error.message);
  }
}



	let codeEditor = vscode.commands.registerCommand('test.logSelection', () => {
        // Get the active text editor
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            const document = editor.document;
            const selection = editor.selection;

            // Get the text within the selection
            const selectedText = document.getText(selection);

            // Show the selected text in a message
            vscode.window.showInformationMessage(`You selected: ${selectedText}`);
        } else {
            vscode.window.showInformationMessage('No editor is active.');
        }
    });

    //handles adding a note 
    let addNoteCommand = vscode.commands.registerCommand('test.addNote', async () => {
        const note = await getNoteFromUser();
        if(note){
            console.log(`Note added: ${note}`);
        }
    });

    //Register all commands 
    context.subscriptions.push(codeEditor);
	context.subscriptions.push(disposable);
    context.subscriptions.push(addNoteCommand);

	// Create the decoration type
    todoDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        borderColor: 'rgba(255, 255, 0, 0.5)',
        borderWidth: '1px',
        borderStyle: 'solid',
        cursor: 'crosshair',
        // Use a light theme color for the ruler
        light: {
            overviewRulerColor: 'yellow'
        },
        // Use a dark theme color for the ruler
        dark: {
            overviewRulerColor: 'darkorange'
        }
    });

    let timeout; // A timeout variable for debouncing

    // A function to find and apply decorations
    function updateDecorations() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const text = editor.document.getText();
        const todoMatches = [];
        const regex = /TODO/g;
        let match;
        while ((match = regex.exec(text))) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);
            // Add the range to our array
            todoMatches.push({ range, hoverMessage: 'This is a TODO item.' });
        }

        // Apply the decorations
        editor.setDecorations(todoDecorationType, todoMatches);
    }

    // A function to trigger the update with a debounce
    function triggerUpdateDecorations() {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(updateDecorations, 500); // 500ms debounce
    }

    // Trigger the initial update
    if (vscode.window.activeTextEditor) {
        triggerUpdateDecorations();
    }

    // Add event listeners
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
