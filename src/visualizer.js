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
    
    // Load the initial HTML shell
    visualizerPanel.webview.html = getVisualizerHTML(editor.document.getText(), "[]", "", null);

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
    }, 750);
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
    // --- FIX: Read 'extensionContext' from module scope ---
    const tracerPath = path.join(extensionContext.extensionPath, 'src/tracer.py');
    const pythonCommand = 'python3';

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

    tracerProcess.on('close', (code) => {
        if (!visualizerPanel) {
            return; 
        }

        if (code !== 0) {
            visualizerPanel.webview.postMessage({
                command: 'updateTrace',
                sourceCode: sourceCode,
                traceData: "[]",
                errorData: errorData,
                currentInputs: allInputs
            });
        } else {
            visualizerPanel.webview.postMessage({
                command: 'updateTrace',
                sourceCode: sourceCode,
                traceData: traceDataJson,
                errorData: null,
                currentInputs: allInputs
            });
        }
    });
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

    context.subscriptions.push(startCommand, changeListener);
}

/**
 * Generates the full HTML/CSS/JS "shell" for the Webview.
 * This version uses a fade-out/fade-in for updates instead of a full overlay.
 *
 * @param {string} sourceCode - The Python source code.
 * @param {string} traceData - The JSON string of the execution trace ("[]" if error).
 * @param {string} currentInputs - The input string that was used for this run.
 * @param {string | null} errorData - The error message, if any.
 */
function getVisualizerHTML(sourceCode, traceData, currentInputs, errorData) {
    
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
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h4 { margin-top: 0; }
                
                /* --- Error Display --- */
                #errorDisplay {
                    padding: 10px;
                    background-color: #5c2121;
                    border-bottom: 1px solid var(--vscode-sideBar-border, #333);
                }
                #errorDisplay h4 { margin: 0 0 5px 0; color: #ffcccc; }
                #errorDisplay pre { white-space: pre-wrap; color: white; margin: 0; }

                /* --- Input Area --- */
                #inputArea {
                    padding: 10px;
                    border-bottom: 1px solid var(--vscode-sideBar-border, #333);
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

                /* --- Controls --- */
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

                /* --- Main Layout --- */
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

                /* --- NEW: Seamless Loading Style --- */
                /* When loading, we'll just fade the main content */
                body.loading #main,
                body.loading #controls {
                    opacity: 0.5;
                }
            </style>
        </head>
        <body>
            <div id="errorDisplay"></div>

            <div id="inputArea">
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
                
                // --- Global State (will be updated by messages) ---
                let sourceCode = ${safeSourceCode};
                let trace = ${traceData}; // This is a JS object (from "[]")
                let errorData = ${safeErrorData};
                let currentIndex = -1;
                let codeLines = sourceCode.split('\\n');

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
                
                // --- Main Render Function (unchanged) ---
                function render() {
                    // 1. Update Buttons, Label, Slider
                    prevBtn.disabled = (currentIndex <= 0);
                    nextBtn.disabled = (currentIndex >= trace.length - 1);
                    stepLabel.textContent = \`Step: \${currentIndex + 1} / \${trace.length}\`;
                    if (stepSlider) { stepSlider.value = currentIndex; }
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

                // --- Main function to update UI with new data ---
                function updateUI(newSourceCode, newTraceData, newErrorData, newInputs) {
                    // 1. Update global state
                    sourceCode = newSourceCode;
                    trace = JSON.parse(newTraceData); // newTraceData is a JSON string
                    errorData = newErrorData;
                    codeLines = sourceCode.split('\\n');
                    
                    // 2. Update Input Box (but only if it's not focused)
                    if (document.activeElement !== inputBox) {
                        inputBox.value = newInputs.replace(/\\n/g, '\\n');
                    }

                    // 3. Update Error Display
                    if (errorData) {
                        errorDisplay.innerHTML = \`
                            <h4>Tracer Failed (check inputs or code):</h4>
                            <pre>\${errorData}</pre>
                        \`;
                        errorDisplay.style.display = 'block';
                    } else {
                        errorDisplay.style.display = 'none';
                    }
                    
                    // 4. Reset controls and render
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
                
                // --- Listen for messages from the extension ---
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'showLoading':
                            // --- MODIFIED ---
                            document.body.classList.add('loading');
                            break;
                        
                        case 'updateTrace':
                            // --- MODIFIED ---
                            document.body.classList.remove('loading');
                            updateUI(
                                message.sourceCode,
                                message.traceData, // This is a JSON string
                                message.errorData,
                                message.currentInputs
                            );
                            break;
                    }
                });

                // --- Event Listeners (Button clicks) ---
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
                    const safeInput = inputText.replace(/\\n/g, '\\\\n').replace(/\\n/g, '\\\\n');
                    
                    vscode.postMessage({
                        command: 'rerun',
                        text: safeInput
                    });
                };

                // --- Initial Render ---
                // (This runs once when the HTML is first loaded)
                updateUI(sourceCode, JSON.stringify(trace), errorData, "${currentInputs}");
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