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
        sendHelloEmail()
            .then((messageId) => {
                vscode.window.showInformationMessage(`Email sent successfully! Message ID: ${messageId}`);
            })
            .catch((error) => {
                vscode.window.showErrorMessage(`Failed to send email: ${error.message}`);
            });
	});

	context.subscriptions.push(disposable);
    // Activate the highlighter functionality
    activateHighlighter(context);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
