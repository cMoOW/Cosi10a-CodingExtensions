// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// Import the highlighter functionality from the new file
const { activateHighlighter } = require('./src/highlight.js');
const { sendHelloEmail } = require('./src/send-email.js');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "test" is now active!');
	vscode.window.showInformationMessage('this extension is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('test.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('This is proof of our work so far');
        // Send the email when the command is executed
        sendEmailCommandHandler();
	});

	context.subscriptions.push(disposable);
    // Activate the highlighter functionality
    activateHighlighter(context);
}

/**
 * Handles the logic for the "helloWorld" command.
 * It prompts the user for email details and calls the email service.
 */
async function sendEmailCommandHandler() {
  try {
    
    // 1. Prompt for the email body
    const body = await vscode.window.showInputBox({
      prompt: "Enter the email body (can be HTML)",
      placeHolder: "Type your message here."
    });
    if (!body) return vscode.window.showInformationMessage('Email sending cancelled.');

    // 4. Call the email service with all the user's input
    const messageId = await sendHelloEmail(body);

    console.log('Email sent successfully. Message ID:', messageId);
    vscode.window.showInformationMessage(`Email successfully sent! Message ID: ${messageId}`);

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
