// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const { getNoteFromUser } = require('./PostIt/noteInput');

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
	vscode.window.showInformationMessage('this extension is now active!');
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('test.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('This is proof of our work so far');
	});


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
