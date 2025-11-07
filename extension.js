// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// Import the highlighter functionality from the new file
//const { activateHighlighter } = require('./src/highlight.js');
const { sendEmail } = require('./src/send-email.js');
const { NoteManager } = require('./PostIt/noteManager');
const path = require('path');
const {spawn} = require('child_process');

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
	
		panel.webview.html = getEmailFormHTML(context);
		// In your extension.ts/js file, after creating the webview panel
		const emailList = ["brianshen@brandeis.edu", "auppal@brandeis.edu", "jacobcarminati@brandeis.edu", "siminglin@brandeis.edu"];

		panel.webview.postMessage({
    		type: 'loadEmails',
    		emails: emailList
		});
	
		// Listen for messages from the webview
		panel.webview.onDidReceiveMessage(async (message) => {
			if (message.type === 'submitEmailForm') {
				const { userEmail, recipientEmail, userMessage } = message.data;

				// Validate multiple emails
				const emails = recipientEmail.split(',').map(e => e.trim());
				const invalidEmails = emails.filter(e => !e.endsWith('@brandeis.edu'));

                const userEmailValid = userEmail.endsWith('@brandeis.edu');
                if (!userEmailValid) {
                    vscode.window.showErrorMessage(`Your email must be a valid Brandeis email address.`);
                    return;
                }
				if (invalidEmails.length > 0) {
					vscode.window.showErrorMessage(`Invalid Brandeis emails: ${invalidEmails.join(', ')}`);
					return;
				}
	
				try {
                    // Store the user's email for future use
                    context.globalState.update(EMAIL_KEY, userEmail);
                    // Call the email service with all the user's input
                    await sendEmail(highlightedText, documentText, userEmail,recipientEmail, userMessage);
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
   
    // Store the panel globally so we only have one
    let panel = undefined;

    let visualizer = vscode.commands.registerCommand('visualizer.start', () => {
        
        // 1. Get the active Python file
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'python') {
            vscode.window.showErrorMessage('Please open a Python file to visualize.');
            return;
        }

        // If the panel already exists, just show it.
        if (panel) {
            panel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        // 2. Create the Webview Panel (runs only ONCE)
        panel = vscode.window.createWebviewPanel(
            'pythonVisualizer',     // Internal ID
            'Python Visualizer',    // Title
            vscode.ViewColumn.Beside, // Show in a new column
            {
                enableScripts: true, // Allow JavaScript to run
                // Retain state even when panel is not visible
                retainContextWhenHidden: true 
            }
        );

        // 3. Set up a listener for messages from the Webview
        panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'rerun') {
                    // User clicked 'Re-run', so we run the tracer again
                    // with the new input from the webview.
                    runTracerAndRefresh(editor, context, panel, message.text);
                }
            },
            undefined,
            context.subscriptions
        );

        // 4. Set a listener for when the panel is closed
        panel.onDidDispose(() => {
            panel = undefined; // Clear the panel so we can create a new one
        },
        undefined,
        context.subscriptions
        );

        // 5. Run the visualizer for the FIRST time with empty input
        runTracerAndRefresh(editor, context, panel, "");
    });

    context.subscriptions.push(visualizer);

}


/**
 * This is our new main function. It runs the tracer and updates the panel.
 * @param {vscode.TextEditor} editor
 * @param {vscode.ExtensionContext} context
 * @param {vscode.WebviewPanel} panel
 * @param {string} allInputs - The input string from the user.
 */
function runTracerAndRefresh(editor, context, panel, allInputs) {

    const scriptPath = editor.document.fileName;
    const scriptDir = path.dirname(scriptPath);
    const sourceCode = editor.document.getText();
    const tracerPath = path.join(context.extensionPath, 'src/tracer.py');
    const pythonCommand = 'python3'; // Or 'python'

    // Set the panel's HTML to a "Loading..." message
    panel.webview.html = "<h1>Running tracer...</h1>";

    // Run the tracer (this is the same logic as before)
    const tracerProcess = spawn(
        pythonCommand,
        [tracerPath, scriptPath, allInputs],
        { cwd: scriptDir }
    );

    let traceDataJson = '';
    let errorData = '';

    tracerProcess.stdout.on('data', (data) => {
        traceDataJson += data.toString();
    });

    tracerProcess.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    // When the tracer finishes...
    tracerProcess.on('close', (code) => {
        if (code !== 0) {
            // --- THIS IS THE CHANGE ---
            // It failed, so we render the full UI but pass in
            // an empty trace ("[]") and the error message.
            panel.webview.html = getWebviewContent(sourceCode, "[]", allInputs, errorData);
            return;
        }

        // If it succeeded, update the webview HTML with the new data
        // We pass 'null' for the errorData.
        panel.webview.html = getWebviewContent(sourceCode, traceDataJson, allInputs, null);
    });
}


function getEmailFormHTML(context) {
    // Retrieve stored user email if available
    const storedEmail = context.globalState.get(EMAIL_KEY);
    if (storedEmail) {
        console.log('Retrieved stored email:', storedEmail);
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
            <input type="email" id="userEmail" value="${storedEmail || ''}" placeholder="your-email@brandeis.edu" required />
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
		console.log('Retrieved stored email:', storedEmail);
        return storedEmail;
    }else{
        //vscode.window.showInformationMessage('No stored email found.');
		console.log('No stored email found.');
        return null;
    }

}


/**
 * Generates the full HTML/CSS/JS for the Webview.
 * @param {string} sourceCode - The Python source code.
 * @param {string} traceData - The JSON string of the execution trace.
 * @param {string} currentInputs - The input string that was used for this run.
 * @param {string | null} errorData - The error message, if any.
 */
function getWebviewContent(sourceCode, traceData, currentInputs, errorData) {
    
    // Safely embed all the data into the HTML
    const safeSourceCode = JSON.stringify(sourceCode);
    const safeErrorData = JSON.stringify(errorData || null);
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Python Visualizer</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
                    display: flex; 
                    flex-direction: column; 
                    height: 100vh; 
                    margin: 0; 
                }

                /* --- Error Display --- */
                #errorDisplay {
                    padding: 10px;
                    background-color: #5c2121; /* Dark red background */
                    border-bottom: 1px solid #333;
                }
                #errorDisplay h4 {
                    margin: 0 0 5px 0;
                    color: #ffcccc; /* Light red text */
                }
                #errorDisplay pre {
                    white-space: pre-wrap;
                    color: white;
                    margin: 0;
                }

                /* --- Input Area --- */
                #inputArea {
                    padding: 10px;
                    border-bottom: 1px solid #333;
                }
                #inputArea h4 { margin: 0 0 5px 0; }
                #inputBox {
                    width: calc(100% - 10px);
                    font-family: "Consolas", "Courier New", monospace;
                }
                #rerunBtn {
                    margin-top: 5px;
                    background-color: #098309; /* Green for re-run */
                }

                /* --- Controls --- */
                #controls { 
                    padding: 10px; 
                    border-bottom: 1px solid #333; 
                    display: flex; 
                    align-items: center; 
                }
                #stepLabel { 
                    margin: 0 10px; 
                    min-width: 100px; 
                    text-align: right; 
                }
                button { 
                    background-color: #007acc; 
                    color: white; 
                    border: none; 
                    padding: 5px 10px; 
                    border-radius: 3px; 
                    cursor: pointer; 
                }
                button:disabled { background-color: #555; }
                #stepSlider { 
                    flex-grow: 1; 
                    margin: 0 10px; 
                }

                /* --- Main Layout --- */
                #main { 
                    display: flex; 
                    flex: 1; 
                    overflow: hidden; 
                }
                #codeDisplay {
                    font-family: "Consolas", "Courier New", monospace;
                    padding: 15px;
                    white-space: pre;
                    overflow-y: auto;
                    width: 60%;
                    border-right: 1px solid #333;
                }
                #sidebar {
                    width: 40%;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                /* --- Sidebar Panes --- */
                #varsDisplay, #outputDisplay {
                    font-family: "Consolas", "Courier New", monospace;
                    padding: 15px;
                    overflow-y: auto;
                }
                #varsDisplay {
                    flex-shrink: 1;
                    min-height: 100px;
                    border-bottom: 1px solid #333;
                }
                #outputDisplay { flex-grow: 1; }
                #outputDisplay h4 { margin-top: 0; }
                #outputContent { white-space: pre-wrap; }
                
                .highlight-line { 
                    background-color: rgba(255, 255, 0, 0.3); 
                }
            </style>
        </head>
        <body>
            <div id="errorDisplay"></div>

            <div id="inputArea">
                <h4>Program Input (one per line)</h4>
                <textarea id="inputBox" rows="3">${currentInputs.replace(/\\n/g, '\n')}</textarea>
                <button id="rerunBtn">Re-run Visualization</button>
            </div>
            
            <div id="controls">
                <button id="prevBtn">« Prev</button>
                <input type="range" id="stepSlider" value="0" min="0" max="0" />
                <button id="nextBtn">Next »</button>
                <span id="stepLabel">Step: 0 / 0</span>
            </div>
            
            <div id="main">
                <div id="codeDisplay"></div>
                <div id="sidebar">
                    <div id="varsDisplay"></div>
                    <div id="outputDisplay">
                        <h4>Program Output</h4>
                        <pre id="outputContent"></pre>
                    </div>
                </div>
            </div>

            <script>
                // --- Setup ---
                const vscode = acquireVsCodeApi();
                
                // --- Injected Data ---
                const sourceCode = ${safeSourceCode};
                const trace = ${traceData}; // This will be [] if it failed
                const errorData = ${safeErrorData}; // This will have the error
                
                // --- State ---
                let currentIndex = -1;
                const codeLines = sourceCode.split('\\n');

                // --- Get All DOM Elements ---
                const errorDisplay = document.getElementById('errorDisplay');
                const inputBox = document.getElementById('inputBox');
                const rerunBtn = document.getElementById('rerunBtn');
                const prevBtn = document.getElementById('prevBtn');
                const nextBtn = document.getElementById('nextBtn');
                const stepLabel = document.getElementById('stepLabel');
                const stepSlider = document.getElementById('stepSlider');
                const codeDisplay = document.getElementById('codeDisplay');
                const varsDisplay = document.getElementById('varsDisplay');
                const outputContent = document.getElementById('outputContent');
                
                // --- Error Display Logic ---
                if (errorData) {
                    errorDisplay.innerHTML = \`
                        <h4>Tracer Failed (check inputs or code):</h4>
                        <pre>\${errorData}</pre>
                    \`;
                } else {
                    errorDisplay.style.display = 'none'; // Hide if no error
                }

                // --- Main Render Function ---
                function render() {
                    // 1. Update Buttons, Label, Slider
                    prevBtn.disabled = (currentIndex <= 0);
                    nextBtn.disabled = (currentIndex >= trace.length - 1);
                    stepLabel.textContent = \`Step: \${currentIndex + 1} / \${trace.length}\`;
                    if (stepSlider) {
                        stepSlider.value = currentIndex;
                    }

                    if (currentIndex < 0 || currentIndex >= trace.length) return;
                    
                    const step = trace[currentIndex];
                    const currentLine = step.line_no;

                    // 2. Render Code + Highlight
                    let codeHtml = '';
                    for (let i = 0; i < codeLines.length; i++) {
                        const lineClass = (i + 1 === currentLine) ? 'highlight-line' : '';
                        const lineText = codeLines[i].replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        codeHtml += \`<div class="\${lineClass}">\${lineText || '&nbsp;'}</div>\`;
                    }
                    codeDisplay.innerHTML = codeHtml;

                    // 3. Render Variables
                    let varsHtml = '<h4>Local Variables</h4>';
                    varsHtml += JSON.stringify(step.local_vars, null, 2);
                    varsDisplay.innerHTML = varsHtml;
                    
                    // 4. Render Cumulative Output
                    let cumulativeOutput = '';
                    for (let i = 0; i <= currentIndex; i++) {
                        if (trace[i].output) {
                            cumulativeOutput += trace[i].output;
                        }
                    }
                    outputContent.textContent = cumulativeOutput;
                }
                
                // --- Event Listeners ---
                prevBtn.onclick = () => {
                    if (currentIndex > 0) {
                        currentIndex--;
                        render();
                    }
                };
                
                nextBtn.onclick = () => {
                    if (currentIndex < trace.length - 1) {
                        currentIndex++;
                        render();
                    }
                };

                stepSlider.oninput = () => {
                    currentIndex = parseInt(stepSlider.value, 10);
                    render();
                };
                
                rerunBtn.onclick = () => {
                    const inputText = inputBox.value;
                    // Convert literal newlines (from 'Enter') into the '\\n' string
                    // that the command line argument expects.
                    const safeInput = inputText.replace(/\\n/g, '\\\\n').replace(/\\n/g, '\\\\n');
                    
                    // Send this new input back to the extension
                    vscode.postMessage({
                        command: 'rerun',
                        text: safeInput
                    });
                };

                // --- Initial Render ---
                if (trace.length > 0) {
                    stepSlider.max = trace.length - 1;
                    currentIndex = 0;
                    render();
                } else {
                    stepLabel.textContent = "No steps recorded.";
                }
            </script>
        </body>
        </html>
    `;
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate,
	getUserEmail
}
