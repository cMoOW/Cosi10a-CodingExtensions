const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');


// --- State is owned by this module ---
let visualizerPanel = undefined;
let associatedDocument = undefined;
let currentInput = "";
let debounceTimer = undefined;
let extensionContext = undefined; // <-- NEW: To store the context

/**
 * Logic from the 'startCommand'
 */
function createOrShowPanel() { // <-- No 'context' parameter
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'python') {
        vscode.window.showErrorMessage('Please open a Python file to visualize.');
        return;
    }

    if (visualizerPanel) {
        visualizerPanel.reveal(vscode.ViewColumn.Beside);
        return;
    }

    visualizerPanel = vscode.window.createWebviewPanel(
        'pythonVisualizer', 'Python Visualizer', vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    // Store state
    associatedDocument = editor.document;
    currentInput = ""; 
    // --- THIS IS THE CHANGE ---
    const sourceCode = editor.document.getText();
    const showInputBox = checkCodeForInput(sourceCode);

    // Load the initial HTML shell, passing the new boolean
    visualizerPanel.webview.html = getVisualizerHTML(sourceCode, "[]", "", null, showInputBox);

    // Listen for messages FROM the Webview
    visualizerPanel.webview.onDidReceiveMessage(
        message => {
            if (message.command === 'rerun') {
                currentInput = message.text;
                runTracerAndPostUpdate(); // <-- No 'context' parameter
            }
        },
        undefined, extensionContext.subscriptions // <-- Use stored context
    );

    // Listen for when the panel is closed
    visualizerPanel.onDidDispose(() => {
        visualizerPanel = undefined;
        associatedDocument = undefined;
        currentInput = "";
        clearTimeout(debounceTimer);
    },
    undefined, extensionContext.subscriptions // <-- Use stored context
    );

    // Run the *first* trace AFTER loading the shell
    runTracerAndPostUpdate(); // <-- No 'context' parameter
}

// --- NEW: Helper function to check for input() ---
/**
 * Scans the code line-by-line to see if 'input()' is
 * present and *not* inside a comment.
 * @param {string} sourceCode
 */
function checkCodeForInput(sourceCode) {
    const lines = sourceCode.split('\n');
    const inputRegex = /\binput\s*\(/; // Looks for "input("
    const commentRegex = /^\s*#/; // Looks for a line starting with #
    
    for (const line of lines) {
        // If the line is NOT a comment AND it contains "input("...
        if (!commentRegex.test(line) && inputRegex.test(line)) {
            // We found it!
            return true;
        }
    }
    // We went through the whole file and didn't find it
    return false;
}

/**
 * Logic from the 'changeListener'
 */
function onDocumentChange(event) { // <-- No 'context' parameter
    if (!visualizerPanel || event.document.uri !== associatedDocument.uri) {
        return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        associatedDocument = event.document;
        runTracerAndPostUpdate(); // <-- No 'context' parameter
    }, 500);
}

/**
 * Logic from 'tracerRunner.js'
 * It now reads 'extensionContext' from the module scope.
 */
function runTracerAndPostUpdate() { // <-- No 'context' parameter
    if (!visualizerPanel || !associatedDocument) {
        return;
    }

    visualizerPanel.webview.postMessage({ command: 'showLoading' });

    const document = associatedDocument;
    const allInputs = currentInput;
    
    const scriptPath = document.fileName;
    const scriptDir = path.dirname(scriptPath);
    const sourceCode = document.getText();

    const tracerPath = path.join(extensionContext.extensionPath, 'src/tracer.py');
    const pythonCommand = 'python3';
    const showInputBox = checkCodeForInput(sourceCode);
    const tracerProcess = spawn(
        pythonCommand,
        [tracerPath, allInputs, scriptPath], // Pass scriptPath as argv[2]
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

    // --- THIS IS THE UPDATED LOGIC ---
    tracerProcess.on('close', (code) => {
        if (!visualizerPanel) {
            return; 
        }

        const EXIT_CODE_SUCCESS = 0;
        const EXIT_CODE_RUNTIME_ERROR = 1;
        const EXIT_CODE_SYNTAX_ERROR = 2;

        if (code === EXIT_CODE_SUCCESS) {
            visualizerPanel.webview.postMessage({
                command: 'updateTrace',
                sourceCode: sourceCode,
                traceData: traceDataJson,
                errorData: null,
                currentInputs: allInputs,
                showInputBox: showInputBox
            });
        } else if (code === EXIT_CODE_RUNTIME_ERROR) {
            visualizerPanel.webview.postMessage({
                command: 'updateTrace',
                sourceCode: sourceCode,
                traceData: "[]",
                errorData: errorData,
                currentInputs: allInputs,
                showInputBox: showInputBox
            });
        } else if (code === EXIT_CODE_SYNTAX_ERROR) {
            visualizerPanel.webview.postMessage({ command: 'hideLoading' });
        } else {
            visualizerPanel.webview.postMessage({
                command: 'updateTrace',
                sourceCode: sourceCode,
                traceData: "[]",
                errorData: `Tracer exited with unexpected code ${code}: ${errorData}`,
                currentInputs: allInputs,
                showInputBox: showInputBox
            });
        }
    });
    tracerProcess.stdin.write(sourceCode);
    tracerProcess.stdin.end();
}

/**
 * The 'activate' function, exported for extension.js
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // --- FIX: Store the context in our module variable ---
    extensionContext = context;

    // 1. Register the "start" command
    let startCommand = vscode.commands.registerCommand('visualizer.start', 
        createOrShowPanel // No need to pass context, it's already stored
    );

    // 2. Register the "file change" listener
    let changeListener = vscode.workspace.onDidChangeTextDocument(
        onDocumentChange // No need to pass context
    );
    // --- NEW: Register the "tab change" listener ---
    let tabChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        // Check 1: Is our panel open?
        if (!visualizerPanel) {
            return;
        }

        // Check 2: Is the new editor valid and a Python file?
        if (editor && editor.document.languageId === 'python') {
            
            // Check 3: Is it a *new* file (not the one we're already watching)?
            if (editor.document.uri !== associatedDocument.uri) {
                // It's a new Python file!
                // Update our state to follow it
                associatedDocument = editor.document;
                currentInput = ""; // Reset input for the new file

                // Run the tracer on this new file
                runTracerAndPostUpdate();
            }
        }
        // If it's not a Python file (e.g., package.json), we do nothing.
        // The visualizer remains associated with the *previous* Python file.
    });
    context.subscriptions.push(startCommand, changeListener, tabChangeListener);
}

/**
 * Generates the full HTML/CSS/JS "shell" for the Webview.
 * @param {string} sourceCode
 * @param {string} traceData
 * @param {string} currentInputs
 * @param {string | null} errorData
 * @param {boolean} initialShowInputBox
 */
function getVisualizerHTML(sourceCode, traceData, currentInputs, errorData, initialShowInputBox) {
    
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
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h4 { margin-top: 0; }
                #errorDisplay {
                    padding: 10px;
                    background-color: #5c2121;
                    border-bottom: 1px solid var(--vscode-sideBar-border, #333);
                }
                #errorDisplay h4 { margin: 0 0 5px 0; color: #ffcccc; }
                #errorDisplay pre { white-space: pre-wrap; color: white; margin: 0; }
                
                #inputArea {
                    padding: 10px;
                    border-bottom: 1px solid var(--vscode-sideBar-border, #333);
                    display: none; /* Hidden by default */
                }
                #inputArea h4 { margin: 0 0 5px 0; }
                #inputBox {
                    width: calc(100% - 10px);
                    font-family: "Consolas", "Courier New", monospace;
                    color: var(--vscode-input-foreground);
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                }
                #rerunBtn { margin-top: 5px; background-color: #098309; }
                #controls { 
                    padding: 10px; 
                    border-bottom: 1px solid var(--vscode-sideBar-border, #333); 
                    display: flex; 
                    align-items: center; 
                    transition: opacity 0.15s ease-in-out;
                }
                #stepLabel { margin: 0 10px; min-width: 100px; text-align: right; }
                button { 
                    background-color: #007acc; 
                    color: white; 
                    border: none; 
                    padding: 5px 10px; 
                    border-radius: 3px; 
                    cursor: pointer; 
                }
                button:disabled { background-color: #555; }
                #stepSlider { flex-grow: 1; margin: 0 10px; }
                #main { 
                    display: flex; 
                    flex: 1; 
                    overflow: hidden; 
                    transition: opacity 0.15s ease-in-out;
                }
                #codeDisplay {
                    font-family: "Consolas", "Courier New", monospace;
                    padding: 15px;
                    white-space: pre;
                    overflow-y: auto;
                    width: 60%;
                    border-right: 1px solid var(--vscode-sideBar-border, #333);
                }
                #sidebar {
                    width: 40%;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                #varsDisplay, #outputDisplay {
                    font-family: "Consolas", "Courier New", monospace;
                    padding: 15px;
                    overflow-y: auto;
                }
                #varsDisplay {
                    flex-shrink: 1;
                    min-height: 100px;
                    border-bottom: 1px solid var(--vscode-sideBar-border, #333);
                }
                #outputDisplay { flex-grow: 1; }
                #outputContent { white-space: pre-wrap; }
                .highlight-line { 
                    background-color: var(--vscode-editor-selectionBackground, rgba(255, 255, 0, 0.3)); 
                }
                body.loading #main,
                body.loading #controls {
                    opacity: 0.5;
                }
            </style>
        </head>
        <body>
            <div id="errorDisplay"></div>

            <div id="inputArea" style="display: ${initialShowInputBox ? 'block' : 'none'}">
                <h4>Program Input (one per line)</h4>
                <textarea id="inputBox" rows="3"></textarea>
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
                const vscode = acquireVsCodeApi();
                
                let sourceCode = ${safeSourceCode};
                let trace = ${traceData};
                let errorData = ${safeErrorData};
                let showInputBox = ${initialShowInputBox};
                let currentIndex = -1;
                let codeLines = sourceCode.split('\\n');

                const inputArea = document.getElementById('inputArea');
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
                
                function render() {
                    prevBtn.disabled = (currentIndex <= 0);
                    nextBtn.disabled = (currentIndex >= trace.length - 1);
                    stepLabel.textContent = \`Step: \${currentIndex + 1} / \${trace.length}\`;
                    if (stepSlider) { stepSlider.value = currentIndex; }
                    if (currentIndex < 0 || currentIndex >= trace.length) return;
                    
                    const step = trace[currentIndex];
                    const currentLine = step.line_no;
                    let codeHtml = '';
                    for (let i = 0; i < codeLines.length; i++) {
                        const lineClass = (i + 1 === currentLine) ? 'highlight-line' : '';
                        const lineText = codeLines[i].replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        codeHtml += \`<div class="\${lineClass}">\${lineText || '&nbsp;'}</div>\`;
                    }
                    codeDisplay.innerHTML = codeHtml;
                    let varsHtml = '<h4>Local Variables</h4>';
                    varsHtml += JSON.stringify(step.local_vars, null, 2);
                    varsDisplay.innerHTML = varsHtml;
                    let cumulativeOutput = '';
                    for (let i = 0; i <= currentIndex; i++) {
                        if (trace[i].output) {
                            cumulativeOutput += trace[i].output;
                        }
                    }
                    outputContent.textContent = cumulativeOutput;
                }

                function updateUI(newSourceCode, newTraceData, newErrorData, newInputs, newShowInputBox) {
                    sourceCode = newSourceCode;
                    trace = JSON.parse(newTraceData);
                    errorData = newErrorData;
                    codeLines = sourceCode.split('\\n');
                    
                    inputArea.style.display = newShowInputBox ? 'block' : 'none';

                    if (document.activeElement !== inputBox) {
                        inputBox.value = newInputs.replace(/\\n/g, '\\n');
                    }
                    if (errorData) {
                        errorDisplay.innerHTML = \`
                            <h4>Tracer Failed (check inputs or code):</h4>
                            <pre>\${errorData}</pre>
                        \`;
                        errorDisplay.style.display = 'block';
                    } else {
                        errorDisplay.style.display = 'none';
                    }
                    
                    if (trace.length > 0) {
                        stepSlider.max = trace.length - 1;
                        stepSlider.disabled = false;
                        currentIndex = 0;
                        render();
                    } else {
                        stepLabel.textContent = "No steps recorded.";
                        prevBtn.disabled = true;
                        nextBtn.disabled = true;
                        stepSlider.disabled = true;
                        codeDisplay.innerHTML = '';
                        varsDisplay.innerHTML = '<h4>Local Variables</h4>';
                        outputContent.textContent = '';
                    }
                }
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'showLoading':
                            document.body.classList.add('loading');
                            break;
                        case 'hideLoading':
                            document.body.classList.remove('loading');
                            break;
                        case 'updateTrace':
                            document.body.classList.remove('loading');
                            updateUI(
                                message.sourceCode,
                                message.traceData,
                                message.errorData,
                                message.currentInputs,
                                message.showInputBox
                            );
                            break;
                    }
                });

                prevBtn.onclick = () => {
                    if (currentIndex > 0) { currentIndex--; render(); }
                };
                nextBtn.onclick = () => {
                    if (currentIndex < trace.length - 1) { currentIndex++; render(); }
                };
                stepSlider.oninput = () => {
                    currentIndex = parseInt(stepSlider.value, 10);
                    render();
                };
                rerunBtn.onclick = () => {
                    const inputText = inputBox.value;
                    const safeInput = inputText.replace(/\\n/g, '\\\\n').replace(/\\n/g, '\\\\n');
                    vscode.postMessage({
                        command: 'rerun',
                        text: safeInput
                    });
                };

                // Initial Render
                updateUI(sourceCode, JSON.stringify(trace), errorData, "${currentInputs}", showInputBox);
            </script>
        </body>
        </html>
    `;
}

/**
 * The 'deactivate' function
 */
function deactivate() {
    if (visualizerPanel) {
        visualizerPanel.dispose();
    }
    clearTimeout(debounceTimer);
    visualizerPanel = undefined;
    associatedDocument = undefined;
    currentInput = "";
    extensionContext = undefined;
}

// Export the two main entry points
module.exports = {
    activate,
    deactivate
}