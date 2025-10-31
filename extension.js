// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
// Import the highlighter functionality from the new file
//const { activateHighlighter } = require('./src/highlight.js');
const { sendEmail } = require("./src/send-email.js");
const { NoteManager } = require("./PostIt/noteManager");

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

function getEmailFormHTML(context) {
  // Retrieve stored user email if available
  const storedEmail = context.globalState.get(EMAIL_KEY);
  if (storedEmail) {
    console.log("Retrieved stored email:", storedEmail);
  }
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
            /* Base styles for inputs */
            input[type="email"], 
            textarea {
                width: 100%;
                padding: 10px;
                border-radius: 4px;
                border: none;
                font-size: 14px;
                background: #3a3a3a;
                color: white;
                outline: none;
                box-sizing: border-box; 
            }
            input[type="email"]:focus, 
            textarea:focus {
                border: 1px solid #74B9FF;
            }

            /* --- NEW CSS for Custom Dropdown --- */

            .multiselect-container {
                position: relative; /* Allows dropdown to be positioned below */
            }

            /* This is the box that looks like an input */
            .select-box {
                width: 100%;
                padding: 10px;
                border-radius: 4px;
                background: #3a3a3a;
                color: white;
                font-size: 14px;
                cursor: pointer;
                box-sizing: border-box;
                user-select: none; /* Prevents text selection on click */
            }
            .select-box:focus {
                border: 1px solid #74B9FF;
            }
            .select-box .placeholder {
                color: #888;
            }

            /* This is the dropdown panel that hides/shows */
            .dropdown-options {
                display: none; /* Hidden by default */
                position: absolute;
                top: 100%; /* Position right below the select box */
                left: 0;
                width: 100%;
                background: #3a3a3a;
                border: 1px solid #74B9FF;
                border-top: none;
                border-radius: 0 0 4px 4px;
                max-height: 150px;
                overflow-y: auto;
                z-index: 10;
            }
            .dropdown-options.show {
                display: block; /* Show the dropdown */
            }
            
            /* Individual checkbox options */
            .dropdown-option {
                display: block;
                padding: 10px;
                color: white;
                cursor: pointer;
                font-size: 14px;
            }
            .dropdown-option:hover {
                background: #5aa0e6;
            }
            .dropdown-option input[type="checkbox"] {
                margin-right: 10px;
            }
            .dropdown-option.disabled {
                color: #888;
                cursor: default;
                background: none;
            }

            /* --- End Custom Dropdown CSS --- */

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
                <label for="userEmail">Your Email:</label>
                <input type="email" id="userEmail" value="${
                  storedEmail || ""
                }" placeholder="your-email@brandeis.edu" required />
            </div>
            
            <div>
                <label for="recipientSelectBox">Recipient Email(s):</label>
                <div class="multiselect-container">
                    <div class="select-box" id="recipientSelectBox" tabindex="0">
                        <span class="placeholder" id="recipientPlaceholder">Select recipients...</span>
                    </div>
                    <div id="recipientDropdown" class="dropdown-options">
                        <label class="dropdown-option disabled">
                            Loading emails...
                        </label>
                    </div>
                </div>
            </div>
            <div>
                <label for="message">Message:</label>
                <textarea id="message" rows="4" placeholder="Enter your message..." required></textarea>
            </div>
            <button type="submit">Send Email</button>
        </form>

        <script>
            const vscode = acquireVsCodeApi();

            const selectBox = document.getElementById('recipientSelectBox');
            const dropdown = document.getElementById('recipientDropdown');
            const placeholder = document.getElementById('recipientPlaceholder');

            // --- NEW: Toggle dropdown visibility ---
            selectBox.addEventListener('click', () => {
                dropdown.classList.toggle('show');
            });

            // --- NEW: Close dropdown when clicking outside ---
            window.addEventListener('click', (e) => {
                if (!selectBox.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });

            // --- NEW: Update placeholder text when checkboxes change ---
            dropdown.addEventListener('change', () => {
                const checkedInputs = dropdown.querySelectorAll('input[type="checkbox"]:checked');
                if (checkedInputs.length === 0) {
                    placeholder.textContent = 'Select recipients...';
                    placeholder.classList.add('placeholder');
                } else if (checkedInputs.length === 1) {
                    placeholder.textContent = checkedInputs[0].value;
                    placeholder.classList.remove('placeholder');
                } else {
                    placeholder.textContent = checkedInputs.length + ' recipients selected';
                    placeholder.classList.remove('placeholder');
                }
            });

            // --- MODIFIED: Listen for emails from the extension ---
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.type === 'loadEmails' && Array.isArray(message.emails)) {
                    
                    // Clear "Loading..." message
                    dropdown.innerHTML = ''; 

                    // Populate with checkbox options
                    if (message.emails.length > 0) {
                        message.emails.forEach(email => {
                            const optionLabel = document.createElement('label');
                            optionLabel.className = 'dropdown-option';
                            
                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.value = email;
                            
                            optionLabel.appendChild(checkbox);
                            optionLabel.appendChild(document.createTextNode(' ' + email));
                            dropdown.appendChild(optionLabel);
                        });
                    } else {
                        // Show disabled message if no emails are loaded
                        const disabledLabel = document.createElement('label');
                        disabledLabel.className = 'dropdown-option disabled';
                        disabledLabel.textContent = 'No emails found.';
                        dropdown.appendChild(disabledLabel);
                    }
                }
            });

            // --- MODIFIED: Listen for the form submit button ---
            document.getElementById('emailForm').addEventListener('submit', (e) => {
                e.preventDefault();
                
                const userEmail = document.getElementById('userEmail').value.trim();
                const message = document.getElementById('message').value.trim();

                // --- NEW: Get emails from checked boxes ---
                const checkedInputs = dropdown.querySelectorAll('input[type="checkbox"]:checked');
                const selectedEmails = Array.from(checkedInputs).map(input => input.value);
                
                // Simple validation since "required" doesn't work on custom elements
                if (selectedEmails.length === 0) {
                    alert('Please select at least one recipient.');
                    // Focus the box for accessibility
                    selectBox.focus();
                    return; 
                }
                
                const recipientEmail = selectedEmails.join(', ');
                
                // Post all three values back to the extension
                vscode.postMessage({
                    type: 'submitEmailForm',
                    data: { userEmail, recipientEmail, message }
                });
            });
        </script>
    </body>
    </html>
        `;
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
