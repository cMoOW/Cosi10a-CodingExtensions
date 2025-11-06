// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
// Import the highlighter functionality from the new file
//const { activateHighlighter } = require('./src/highlight.js');
const { sendEmail } = require('./src/send-email.js');
const { NoteManager } = require('./PostIt/noteManager');
const { EmailUIManager } = require('./PostIt/emailUIManager');

const EMAIL_KEY = "myExtension.userEmail";

// This method is called when your extension is activated
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // --- NEW COMMAND TO CLEAR EMAIL ---
  let clearEmailDisposable = vscode.commands.registerCommand(
    "extension.clearEmail",
    async () => {
      // 1. Clear our stored email
      await context.globalState.update(EMAIL_KEY, undefined);
      vscode.window.showInformationMessage(
        "Your stored email has been cleared."
      );
    }
  );
  context.subscriptions.push(clearEmailDisposable);

  // Command to get email
  let getEmailDisposable = vscode.commands.registerCommand(
    "extension.getUserEmail",
    () => {
      getUserEmail(context);
    }
  );
  context.subscriptions.push(getEmailDisposable);

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "test" is now active!');
  vscode.window.showInformationMessage("This extension is now active!");

  // Create status bar item for notes
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "test.viewNotes";
  statusBarItem.tooltip = "Click to view your Post-It notes";
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

  const disposable = vscode.commands.registerCommand(
    "test.helloWorld",
    function () {
      // The code you place here will be executed every time your command is executed

      // Display a message box to the user
      vscode.window.showInformationMessage("Hello world has been run");
    }
  );

  // View Notes Command
  let viewNotesCommand = vscode.commands.registerCommand(
    "test.viewNotes",
    async () => {
      await updateStatusBar(); // Refresh notes before viewing
      await noteManager.viewAllNotes();
    }
  );

  // Add Note Command
  let addNoteCommand = vscode.commands.registerCommand(
    "test.addNote",
    async () => {
      await noteManager.showFloatingEditor();
    }
  );

  // Add Note from Selection Command
  let addNoteFromSelectionCommand = vscode.commands.registerCommand(
    "test.addNoteFromSelection",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (selectedText.trim()) {
          await noteManager.showInlineNoteEditor(selectedText);
        } else {
          vscode.window.showWarningMessage(
            "Please select some text to add as a note."
          );
        }
      }
    }
  );

  async function sendEmailCommandHandler(
    highlightedText,
    documentText,
    noteManager
  ) {
    const panel = vscode.window.createWebviewPanel(
      "emailPopup",
      "Send Code Snippet via Email",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    panel.webview.html = getEmailFormHTML(context);
    // In your extension.ts/js file, after creating the webview panel
    const emailList = [
      "brianshen@brandeis.edu",
      "auppal@brandeis.edu",
      "jacobcarminati@brandeis.edu",
      "siminglin@brandeis.edu",
    ];

    panel.webview.postMessage({
      type: "loadEmails",
      emails: emailList,
    });

    // Listen for messages from the webview
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "submitEmailForm") {
        const { userEmail, recipientEmail, userMessage } = message.data;

        // Validate multiple emails
        const emails = recipientEmail.split(",").map((e) => e.trim());
        const invalidEmails = emails.filter(
          (e) => !e.endsWith("@brandeis.edu")
        );

        const userEmailValid = userEmail.endsWith("@brandeis.edu");
        if (!userEmailValid) {
          vscode.window.showErrorMessage(
            `Your email must be a valid Brandeis email address.`
          );
          return;
        }
        if (invalidEmails.length > 0) {
          vscode.window.showErrorMessage(
            `Invalid Brandeis emails: ${invalidEmails.join(", ")}`
          );
          return;
        }

        try {
          // Store the user's email for future use
          context.globalState.update(EMAIL_KEY, userEmail);
          // Call the email service with all the user's input
          await sendEmail(
            highlightedText,
            documentText,
            userEmail,
            recipientEmail,
            userMessage
          );
          vscode.window.showInformationMessage("Email successfully sent!");
          panel.dispose();

          // Optional: Add the message as a Post-It note
          await noteManager.addNote(userMessage);
          await updateStatusBar(); // Refresh and update status bar
        } catch (error) {
          vscode.window.showErrorMessage(
            "Failed to send email: " + error.message
          );
        }
      }
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
        const emailList = {"Brian Shen": "brianshen@brandeis.edu", 
                            "Apoorva Uppal": "auppal@brandeis.edu", 
                            "Jacob Carminati": "jacobcarminati@brandeis.edu", 
                            "SiMing Lin": "siminglin@brandeis.edu"};
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
	context.subscriptions.push(viewNotesCommand);
	context.subscriptions.push(addNoteCommand);
	context.subscriptions.push(addNoteFromSelectionCommand);
	context.subscriptions.push(emailCodeDisposable);

	// highlight TODO: Uncomment this line to enable the highlighter functionality
	// activateHighlighter(context);
}

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

  let emailCodeDisposable = vscode.commands.registerCommand(
    "test.emailCodeSnippet",
    function () {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        sendEmailCommandHandler(
          selectedText,
          editor.document.getText(),
          noteManager
        );
      }
    }
  );

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

function getUserEmail(context) {
  const storedEmail = context.globalState.get(EMAIL_KEY);
  if (storedEmail) {
    //vscode.window.showInformationMessage(`Your stored email is: ${storedEmail}`);
    console.log("Retrieved stored email:", storedEmail);
    return storedEmail;
  } else {
    //vscode.window.showInformationMessage('No stored email found.');
    console.log("No stored email found.");
    return null;
  }
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
  getUserEmail,
};
