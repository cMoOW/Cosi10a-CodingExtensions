// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// Import the highlighter functionality from the new file
//const { activateHighlighter } = require('./src/highlight.js');
const { sendHelloEmail } = require('./src/send-email.js');

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
     // 1. Prompt for the email body, need validation!!
    let email = await vscode.window.showInputBox({
      prompt: "Enter your Brandeis email",
      placeHolder: "Type your Brandeis email here..."
    });
    while (!email || !email.includes('@brandeis.edu')) {
      vscode.window.showInformationMessage('Please enter a valid Brandeis email address.');
      email = await vscode.window.showInputBox({
        prompt: "Enter your Brandeis email",
        placeHolder: "Type your Brandeis email here..."
      });
    }

    // redundant now with validation loop above
    //if (!email) return vscode.window.showInformationMessage('Email sending cancelled.');
   
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


// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
