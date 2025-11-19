const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');


// --- State is owned by this module ---
let visualizerPanel = undefined;
let associatedDocument = undefined;
let currentInput = "";
let debounceTimer = undefined;
let extensionContext = undefined; 

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
    visualizerPanel.webview.html = getVisualizerHtml(sourceCode, "[]", "", null, showInputBox);

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
    extensionContext = context;

    // 1. Register the "start" command
    let startCommand = vscode.commands.registerCommand('visualizer.start', 
        createOrShowPanel // No need to pass context, it's already stored
    );

    // 2. Register the "file change" listener
    let changeListener = vscode.workspace.onDidChangeTextDocument(
        onDocumentChange // No need to pass context
    );
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
function getVisualizerHtml(sourceCode, traceData, currentInputs, errorData, initialShowInputBox) {
    
    const safeSourceCode = JSON.stringify(sourceCode);
    const safeErrorData = JSON.stringify(errorData || null);
    const safeCurrentInputs = JSON.stringify(currentInputs);
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF8">
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
                
                /* --- Layout Containers --- */
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
                    display: none; 
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
                    flex-shrink: 0; 
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

                /* --- Main Split Layout --- */
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
                    width: 60%; /* Initial Width */
                    /* No border-right, the resizer takes its place visually */
                }
                #sidebar {
                    flex: 1; /* Takes remaining width */
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    min-width: 150px; /* Prevent sidebar from disappearing */
                }

                /* --- RESIZERS --- */
                /* Vertical bar between Code and Sidebar */
                #sidebarResizer {
                    width: 5px;
                    background-color: var(--vscode-scrollbarSlider-background, #444);
                    cursor: col-resize;
                    flex-shrink: 0;
                    transition: background-color 0.2s;
                }
                #sidebarResizer:hover {
                    background-color: var(--vscode-scrollbarSlider-hoverBackground, #007acc);
                }

                /* Horizontal bar between Variables and Output */
                #outputResizer {
                    height: 5px;
                    background-color: var(--vscode-scrollbarSlider-background, #444);
                    cursor: row-resize;
                    flex-shrink: 0;
                    transition: background-color 0.2s;
                }
                #outputResizer:hover {
                    background-color: var(--vscode-scrollbarSlider-hoverBackground, #007acc);
                }

                /* --- Sidebar Panels --- */
                #stateContainer {
                    flex: 1; 
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    min-height: 50px;
                }

                #varsDisplay, #globalsDisplay {
                    padding: 15px;
                    border-bottom: 1px solid var(--vscode-sideBar-border, #333);
                }
                #stateContainer > div:last-child {
                    border-bottom: none;
                }

                #outputDisplay {
                    height: 30%; /* Initial Height */
                    padding: 15px;
                    overflow-y: auto;
                    font-family: "Consolas", "Courier New", monospace;
                    border-top: 1px solid var(--vscode-sideBar-border, #333);
                    flex-shrink: 0;
                }
                #outputContent { white-space: pre-wrap; }

                /* --- Tables --- */
                #varsTable, #globalsTable {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                #varsTable th, #globalsTable th {
                    text-align: left;
                    padding: 4px 8px;
                    border-bottom: 2px solid var(--vscode-sideBar-border, #333);
                }
                #varsTable td, #globalsTable td {
                    padding: 4px 8px;
                    border-bottom: 1px solid var(--vscode-sideBar-border, #333);
                    vertical-align: top;
                    word-wrap: break-word;
                    white-space: pre-wrap;
                }
                #varsTable td:first-child, #globalsTable td:first-child {
                    width: 35%;
                    font-weight: bold;
                }
                #varsTable tr:last-child td, #globalsTable tr:last-child td {
                    border-bottom: none;
                }
                #varsDisplay { display: none; }
                .highlight-line { background-color: var(--vscode-editor-selectionBackground, rgba(255, 255, 0, 0.3)); }
                body.loading #main, body.loading #controls { opacity: 0.5; }
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
                
                <div id="sidebarResizer"></div>

                <div id="sidebar">
                    <div id="stateContainer">
                        <div id="globalsDisplay"></div>
                        <div id="varsDisplay"></div>
                    </div>

                    <div id="outputResizer"></div>

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
                const sidebarResizer = document.getElementById('sidebarResizer'); // Width
                
                const sidebar = document.getElementById('sidebar');
                const stateContainer = document.getElementById('stateContainer');
                const globalsDisplay = document.getElementById('globalsDisplay');
                const varsDisplay = document.getElementById('varsDisplay');
                
                const outputResizer = document.getElementById('outputResizer'); // Height
                const outputDisplay = document.getElementById('outputDisplay');
                const outputContent = document.getElementById('outputContent');
                
                // --- RESIZER LOGIC ---
                let isResizingWidth = false;
                let isResizingHeight = false;

                // 1. Width Resizer (Sidebar)
                sidebarResizer.addEventListener('mousedown', (e) => {
                    isResizingWidth = true;
                    document.body.style.cursor = 'col-resize';
                    e.preventDefault();
                });

                // 2. Height Resizer (Output)
                outputResizer.addEventListener('mousedown', (e) => {
                    isResizingHeight = true;
                    document.body.style.cursor = 'row-resize';
                    e.preventDefault();
                });

                document.addEventListener('mousemove', (e) => {
                    // Handle Width Resize
                    if (isResizingWidth) {
                        const mainRect = document.getElementById('main').getBoundingClientRect();
                        const newCodeWidth = e.clientX - mainRect.left;
                        
                        // Constraints: Min width 100px for code, min width 150px for sidebar
                        if (newCodeWidth > 100 && newCodeWidth < mainRect.width - 150) {
                            codeDisplay.style.width = newCodeWidth + 'px';
                        }
                    }

                    // Handle Height Resize
                    if (isResizingHeight) {
                        const sidebarRect = sidebar.getBoundingClientRect();
                        const newOutputHeight = sidebarRect.bottom - e.clientY;
                        
                        // Constraints: Min height 50px for output, min height 50px for vars
                        if (newOutputHeight > 50 && newOutputHeight < sidebarRect.height - 50) {
                            outputDisplay.style.height = newOutputHeight + 'px';
                        }
                    }
                });

                document.addEventListener('mouseup', () => {
                    if (isResizingWidth || isResizingHeight) {
                        isResizingWidth = false;
                        isResizingHeight = false;
                        document.body.style.cursor = 'default';
                    }
                });
                // --- END RESIZER LOGIC ---
                
                function render() {
                    prevBtn.disabled = (currentIndex <= 0);
                    nextBtn.disabled = (currentIndex >= trace.length - 1);
                    stepLabel.textContent = \`Step: \${currentIndex + 1} / \${trace.length}\`;
                    if (stepSlider) { stepSlider.value = currentIndex; }
                    if (currentIndex < 0 || currentIndex >= trace.length) return;
                    
                    const step = trace[currentIndex];
                    const currentLine = step.line_no;
                    const funcName = step.func_name;

                    let codeHtml = '';
                    for (let i = 0; i < codeLines.length; i++) {
                        const lineClass = (i + 1 === currentLine) ? 'highlight-line' : '';
                        const lineText = codeLines[i].replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        codeHtml += \`<div class="\${lineClass}">\${lineText || '&nbsp;'}</div>\`;
                    }
                    codeDisplay.innerHTML = codeHtml;
                    
                    let globalsHtml = '<h4>Global Variables</h4>';
                    const globalVars = step.global_vars;
                    if (globalVars && Object.keys(globalVars).length > 0) {
                        globalsHtml += '<table id="globalsTable"><thead><tr><th>Variable</th><th>Value</th></tr></thead><tbody>';
                        for (const key in globalVars) {
                            if (key.startsWith('__') || key === 'MockStdin' || key === 'safe_serialize' || key === 'tracer' || key === 'EchoingStringIO') {
                                continue;
                            }
                            const value = globalVars[key];
                            const safeKey = key.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            const safeValue = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            globalsHtml += \`<tr><td>\${safeKey}</td><td>\${safeValue}</td></tr>\`;
                        }
                        globalsHtml += '</tbody></table>';
                    } else {
                        globalsHtml += '<span>No global variables in this step.</span>';
                    }
                    globalsDisplay.innerHTML = globalsHtml;

                    if (funcName !== '<module>') {
                        varsDisplay.style.display = 'block';
                        let varsHtml = '<h4>Local Variables</h4>';
                        const localVars = step.local_vars;
                        if (localVars && Object.keys(localVars).length > 0) {
                            varsHtml += '<table id="varsTable"><thead><tr><th>Variable</th><th>Value</th></tr></thead><tbody>';
                            for (const key in localVars) {
                                const value = localVars[key];
                                const safeKey = key.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                const safeValue = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                varsHtml += \`<tr><td>\${safeKey}</td><td>\${safeValue}</td></tr>\`;
                            }
                            varsHtml += '</tbody></table>';
                        } else {
                            varsHtml += '<span>No local variables in this step.</span>';
                        }
                        varsDisplay.innerHTML = varsHtml;
                    } else {
                        varsDisplay.style.display = 'none';
                        varsDisplay.innerHTML = '';
                    }

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
                    
                    try {
                        trace = newTraceData ? JSON.parse(newTraceData) : [];
                    } catch (e) {
                        trace = [];
                        errorData = "Error parsing trace data: " + e;
                    }

                    errorData = newErrorData;
                    codeLines = sourceCode.split('\\n');
                    
                    inputArea.style.display = newShowInputBox ? 'block' : 'none';

                    // We do NOT update the input box here, as per your request.

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
                        varsDisplay.style.display = 'none';
                        varsDisplay.innerHTML = '';
                        globalsDisplay.innerHTML = '<h4>Global Variables</h4>';
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
                    // Send inputs exactly as needed by Python
                    const safeInput = inputText.replace(/\\n/g, '\\\\n'); 
                    vscode.postMessage({
                        command: 'rerun',
                        text: safeInput
                    });
                };

                // Initial Render
                const initialInputs = ${safeCurrentInputs};
                inputBox.value = initialInputs.replace(/\\\\n/g, '\\n');
                updateUI(sourceCode, JSON.stringify(trace), errorData, initialInputs, showInputBox);
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