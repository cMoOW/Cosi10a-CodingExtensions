const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');

// --- State ---
let visualizerPanel = undefined;
let associatedDocument = undefined;
let currentInput = "";
let currentSeed = "42";
let debounceTimer = undefined;
let extensionContext = undefined;

// --- NEW: Decoration Type for the Editor Highlight ---
let prevDecorationType = undefined;
let nextDecorationType = undefined;

// --- Helpers ---
function checkCodeForInput(sourceCode) {
    const lines = sourceCode.split('\n');
    const inputRegex = /\binput\s*\(/;
    const commentRegex = /^\s*#/;
    for (const line of lines) {
        if (!commentRegex.test(line) && inputRegex.test(line)) return true;
    }
    return false;
}

function checkCodeForRandomness(sourceCode) {
    const randomRegex = /\b(import|from)\s+(random|secrets|numpy|scipy)/;
    return randomRegex.test(sourceCode);
}

function activate(context) {
    extensionContext = context;

    // Decorations for next and previous lines.
    prevDecorationType = vscode.window.createTextEditorDecorationType({
        // Blue arrow
        gutterIconPath: path.join(__dirname, 'arrow_icon_prev.png'),
        gutterIconSize: 'contain', 
    });
    nextDecorationType = vscode.window.createTextEditorDecorationType({
        // Green arrow
        gutterIconPath: path.join(__dirname, 'arrow_icon_next.png'), 
        gutterIconSize: 'contain', 
        // Light green highlight
        backgroundColor: 'rgba(77, 255, 0, 0.1)',
        isWholeLine: true,
    });
    // ----------------------------------------------------------

    let startCommand = vscode.commands.registerCommand('visualizer.start', createOrShowPanel);
    let changeListener = vscode.workspace.onDidChangeTextDocument(onDocumentChange);
    let tabChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (!visualizerPanel) return;
        if (editor && editor.document.languageId === 'python') {
            if (editor.document.uri !== associatedDocument.uri) {
                associatedDocument = editor.document;
                currentInput = "";
                currentSeed = "42";
                runTracerAndPostUpdate();
            }
        }
    });
    context.subscriptions.push(startCommand, changeListener, tabChangeListener);
}

function createOrShowPanel() {
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

    associatedDocument = editor.document;
    currentInput = "";
    currentSeed = "42";
   
    const sourceCode = editor.document.getText();
    const showInputBox = checkCodeForInput(sourceCode);
    const hasRandomness = checkCodeForRandomness(sourceCode);

    visualizerPanel.webview.html = getVisualizerHtml(sourceCode, "[]", "", null, showInputBox, hasRandomness);

    visualizerPanel.webview.onDidReceiveMessage(
        message => {
            if (message.command === 'rerun') {
                currentInput = message.text;
                if (message.seed) currentSeed = message.seed;
                runTracerAndPostUpdate();
            }
            // --- NEW: Handle Line Syncing ---
            else if (message.command === 'syncLine') {
                const line = message.line;
                const prevLine = message.prevLine;
                // Find the editor that matches our document
                const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === associatedDocument.uri.toString());
               
                if (editor && line > 0) {
                    // VS Code uses 0-based indexing, Python trace is 1-based
                    const range = new vscode.Range(line - 1, 0, line - 1, 0);
                   
                    // Apply decoration
                    editor.setDecorations(nextDecorationType, [range]);
                   
                    // Optional: Scroll to that line so it's always visible
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                }
                if (editor && prevLine && prevLine > 0) {
                    const prevRange = new vscode.Range(prevLine - 1, 0, prevLine - 1, 0);
                    editor.setDecorations(prevDecorationType, [prevRange]);
                    editor.revealRange(prevRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                }
            }
            // --------------------------------
        },
        undefined, extensionContext.subscriptions
    );

    visualizerPanel.onDidDispose(() => {
        visualizerPanel = undefined;
        associatedDocument = undefined;
        currentInput = "";
        // Clear decorations when panel closes
        if (vscode.window.activeTextEditor) {
            vscode.window.activeTextEditor.setDecorations(nextDecorationType, []);
        }
        clearTimeout(debounceTimer);
    }, undefined, extensionContext.subscriptions);

    runTracerAndPostUpdate();
}

function onDocumentChange(event) {
    if (!visualizerPanel || event.document.uri !== associatedDocument.uri) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        associatedDocument = event.document;
        runTracerAndPostUpdate();
    }, 750);
}

function runTracerAndPostUpdate() {
    if (!visualizerPanel || !associatedDocument) return;
    visualizerPanel.webview.postMessage({ command: 'showLoading' });

    const document = associatedDocument;
    const allInputs = currentInput;
    const scriptPath = document.fileName;
    const scriptDir = path.dirname(scriptPath);
    const sourceCode = document.getText();
    const tracerPath = path.join(extensionContext.extensionPath, 'src', 'tracer.py');
    const pythonCommand = 'python3';

    const showInputBox = checkCodeForInput(sourceCode);
    const hasRandomness = checkCodeForRandomness(sourceCode);

    const tracerProcess = spawn(
        pythonCommand,
        [tracerPath, allInputs, scriptPath, currentSeed],
        { cwd: scriptDir }
    );

    const TIMEOUT_MS = 3000;
    const killTimer = setTimeout(() => {
        if (!tracerProcess.killed) {
            tracerProcess.kill();
            if (visualizerPanel) {
                visualizerPanel.webview.postMessage({
                    command: 'updateTrace',
                    sourceCode: sourceCode,
                    traceData: "[]",
                    errorData: "Error: Execution timed out (infinite loop?).\nScript took longer than 3 seconds.",
                    currentInputs: allInputs,
                    showInputBox: showInputBox,
                    hasRandomness: hasRandomness
                });
            }
        }
    }, TIMEOUT_MS);

    let traceDataJson = '';
    let errorData = '';

    tracerProcess.stdout.on('data', (data) => { traceDataJson += data.toString(); });
    tracerProcess.stderr.on('data', (data) => { errorData += data.toString(); });

    tracerProcess.on('close', (code) => {
        clearTimeout(killTimer);
        if (!visualizerPanel || tracerProcess.killed) return;

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
                showInputBox: showInputBox,
                hasRandomness: hasRandomness
            });
        } else if (code === EXIT_CODE_RUNTIME_ERROR) {
            visualizerPanel.webview.postMessage({
                command: 'updateTrace',
                sourceCode: sourceCode,
                traceData: traceDataJson,
                errorData: errorData,
                currentInputs: allInputs,
                showInputBox: showInputBox,
                hasRandomness: hasRandomness
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
                showInputBox: showInputBox,
                hasRandomness: hasRandomness
            });
        }
    });
   
    tracerProcess.stdin.write(sourceCode);
    tracerProcess.stdin.end();
}

function deactivate() {
    if (visualizerPanel) visualizerPanel.dispose();
    clearTimeout(debounceTimer);
    visualizerPanel = undefined;
    associatedDocument = undefined;
    currentInput = "";
    extensionContext = undefined;
}

/**
 * Generates the full HTML/CSS/JS "shell" for the Webview.
 */
function getVisualizerHtml(sourceCode, traceData, currentInputs, errorData, initialShowInputBox, initialHasRandomness) {
   
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
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    margin: 0;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h4 { margin-top: 0; }
               
                #errorDisplay { padding: 10px; background-color: #5c2121; border-bottom: 1px solid var(--vscode-sideBar-border, #333); }
                #errorDisplay h4 { margin: 0 0 5px 0; color: #ffcccc; }
                #errorDisplay pre { white-space: pre-wrap; color: white; margin: 0; }
               
                #inputArea { padding: 10px; border-bottom: 1px solid var(--vscode-sideBar-border, #333); }
                #inputSection h4 { margin: 0 0 5px 0; }
                #inputBox {
                    width: calc(100% - 10px);
                    font-family: "Consolas", "Courier New", monospace;
                    color: var(--vscode-input-foreground);
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    margin-bottom: 5px;
                }
               
                #randomControls { display: flex; gap: 10px; margin-top: 8px; }
                #standardControls { display: flex; margin-top: 8px; }
               
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 2px;
                    cursor: pointer;
                    font-family: var(--vscode-font-family);
                }
                button:hover { background-color: var(--vscode-button-hoverBackground); }
                button:disabled { opacity: 0.5; cursor: not-allowed; }
               
                #rerunNewBtn { background-color: #098309; color: white; flex-grow: 1; }
                #rerunSameBtn { background-color: #007acc; color: white; flex-grow: 1; }
                #rerunStandardBtn { background-color: #007acc; color: white; flex-grow: 1; }
                #rerunNewBtn:hover { background-color: #0bc90b; }
                #rerunSameBtn:hover { background-color: #0098ff; }

                #controls { padding: 10px; border-bottom: 1px solid var(--vscode-sideBar-border, #333); display: flex; align-items: center; flex-shrink: 0; }
                #stepLabel { margin: 0 10px; min-width: 100px; text-align: right; }
                #stepSlider { flex-grow: 1; margin: 0 10px; }

                #main { display: flex; flex: 1; overflow: hidden; }
                #codeDisplay { display: none; } // Previous code: font-family: "Consolas", "Courier New", monospace; padding: 15px; white-space: pre; overflow-y: auto; width: 60%; border-right: 1px solid var(--vscode-sideBar-border, #333); }
                #sidebar { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 150px; }
                // The following line doesn't seem to do improve the display currently
                // #outputResizer { height: 5px; cursor: row-resize; background-color: var(--vscode-scrollbarSlider-background, #444); transition: background-color 0.2s; flex-shrink: 0; }
                #sidebarResizer:hover, #outputResizer:hover { background-color: var(--vscode-scrollbarSlider-hoverBackground, #007acc); }
               
                #stateContainer { flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 50px; }
                #varsDisplay, #globalsDisplay { padding: 15px; border-bottom: 1px solid var(--vscode-sideBar-border, #333); }
                #stateContainer > div:last-child { border-bottom: none; }
                #outputDisplay { height: 30%; padding: 15px; overflow-y: auto; font-family: "Consolas", "Courier New", monospace; border-top: 1px solid var(--vscode-sideBar-border, #333); flex-shrink: 0; }
                #outputContent { white-space: pre-wrap; }
               
                #varsTable, #globalsTable { width: 100%; border-collapse: collapse; table-layout: fixed; }
                #varsTable th, #globalsTable th { text-align: left; padding: 4px 8px; border-bottom: 2px solid var(--vscode-sideBar-border, #333); }
                #varsTable td, #globalsTable td { padding: 4px 8px; border-bottom: 1px solid var(--vscode-sideBar-border, #333); vertical-align: top; word-wrap: break-word; white-space: pre-wrap; }
                #varsTable td:first-child, #globalsTable td:first-child { width: 35%; font-weight: bold; }
                #varsTable tr:last-child td, #globalsTable tr:last-child td { border-bottom: none; }
                #varsDisplay { display: none; }
                .highlight-line { background-color: var(--vscode-editor-selectionBackground, rgba(255, 255, 0, 0.3)); }
                body.loading #main, body.loading #controls { opacity: 0.5; }
                
                #key {
                    padding: 10px;
                    font-size: 14px;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-sideBar-background);
                    border-top: 1px solid var(--vscode-sideBar-border, #333);
                    text-align: center;
                }
                #key span {
                    display: inline-block;
                    margin-right: 15px;
                }
                .arrow-icon {
                    font-size: 40 px;
                    font-weight: bold;
                    margin-right: 5px;
                }
            </style>
        </head>
        <body>
            <div id="errorDisplay"></div>

            <div id="inputArea">
                <div id="inputSection" style="display: ${initialShowInputBox ? 'block' : 'none'}">
                    <h4>Program Input</h4>
                    <textarea id="inputBox" rows="3"></textarea>
                </div>
               
                <div id="standardControls" style="display: ${initialHasRandomness ? 'none' : 'flex'}">
                    <button id="rerunStandardBtn">Re-run Visualization</button>
                </div>

                <div id="randomControls" style="display: ${initialHasRandomness ? 'flex' : 'none'}">
                    <button id="rerunNewBtn" title="Run with a fresh random seed (Different outcome)">Re-run (New Outcome)</button>
                    <button id="rerunSameBtn" title="Run with the same random seed (Same outcome)">Re-run (Same Outcome)</button>
                </div>
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
            
            <div id="key">
                <span><span class="arrow-icon" style="color: #009dff;">→</span> Just executed</span>
                <span><span class="arrow-icon" style="color: #66d900;">→</span> Next to execute</span>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
               
                let sourceCode = ${safeSourceCode};
                let trace = ${traceData};
                let errorData = ${safeErrorData};
                let showInputBox = ${initialShowInputBox};
                let hasRandomness = ${initialHasRandomness};
                let currentIndex = -1;
                let currentSeed = 42;
                let codeLines = sourceCode.split('\\n');

                const inputArea = document.getElementById('inputArea');
                const inputSection = document.getElementById('inputSection');
                const errorDisplay = document.getElementById('errorDisplay');
                const inputBox = document.getElementById('inputBox');
               
                const standardControls = document.getElementById('standardControls');
                const randomControls = document.getElementById('randomControls');
                const rerunStandardBtn = document.getElementById('rerunStandardBtn');
                const rerunNewBtn = document.getElementById('rerunNewBtn');
                const rerunSameBtn = document.getElementById('rerunSameBtn');
               
                const prevBtn = document.getElementById('prevBtn');
                const nextBtn = document.getElementById('nextBtn');
                const stepLabel = document.getElementById('stepLabel');
                const stepSlider = document.getElementById('stepSlider');
               
                const codeDisplay = document.getElementById('codeDisplay');
                const sidebarResizer = document.getElementById('sidebarResizer');
                const sidebar = document.getElementById('sidebar');
                const stateContainer = document.getElementById('stateContainer');
                const globalsDisplay = document.getElementById('globalsDisplay');
                const varsDisplay = document.getElementById('varsDisplay');
                const outputResizer = document.getElementById('outputResizer');
                const outputDisplay = document.getElementById('outputDisplay');
                const outputContent = document.getElementById('outputContent');
               
                let isResizingWidth = false;
                let isResizingHeight = false;
                sidebarResizer.addEventListener('mousedown', (e) => { isResizingWidth = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); });
                outputResizer.addEventListener('mousedown', (e) => { isResizingHeight = true; document.body.style.cursor = 'row-resize'; e.preventDefault(); });
                document.addEventListener('mousemove', (e) => {
                    if (isResizingWidth) {
                        const mainRect = document.getElementById('main').getBoundingClientRect();
                        const newCodeWidth = e.clientX - mainRect.left;
                        if (newCodeWidth > 100 && newCodeWidth < mainRect.width - 150) { codeDisplay.style.width = newCodeWidth + 'px'; }
                    }
                    if (isResizingHeight) {
                        const sidebarRect = sidebar.getBoundingClientRect();
                        const newOutputHeight = sidebarRect.bottom - e.clientY;
                        if (newOutputHeight > 50 && newOutputHeight < sidebarRect.height - 50) { outputDisplay.style.height = newOutputHeight + 'px'; }
                    }
                });
                document.addEventListener('mouseup', () => {
                    if (isResizingWidth || isResizingHeight) { isResizingWidth = false; isResizingHeight = false; document.body.style.cursor = 'default'; }
                });
               
                function render() {
                    prevBtn.disabled = (currentIndex <= 0);
                    nextBtn.disabled = (currentIndex >= trace.length - 1);
                    stepLabel.textContent = \`Step: \${currentIndex + 1} / \${trace.length}\`;
                    if (stepSlider) { stepSlider.value = currentIndex; }
                   
                    // --- NEW: Sync with Editor ---
                    if (currentIndex >= 0 && currentIndex < trace.length) {
                        const step = trace[currentIndex];
                        const prevLine = currentIndex > 0 ? trace[currentIndex - 1].line_no : null;
                        vscode.postMessage({
                            command: 'syncLine',
                            line: step.line_no,
                            prevLine: prevLine
                        });
                    }
                    // -----------------------------

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
                            if (key.startsWith('__') || key === 'MockStdin' || key === 'safe_serialize' || key === 'tracer' || key === 'EchoingStringIO' || key === 'random') { continue; }
                            const value = globalVars[key];
                            const safeKey = key.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            const safeValue = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            globalsHtml += \`<tr><td>\${safeKey}</td><td>\${safeValue}</td></tr>\`;
                        }
                        globalsHtml += '</tbody></table>';
                    } else { globalsHtml += '<span>No global variables in this step.</span>'; }
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
                        } else { varsHtml += '<span>No local variables in this step.</span>'; }
                        varsDisplay.innerHTML = varsHtml;
                    } else { varsDisplay.style.display = 'none'; varsDisplay.innerHTML = ''; }

                    let cumulativeOutput = '';
                    for (let i = 0; i <= currentIndex; i++) {
                        if (trace[i].output) { cumulativeOutput += trace[i].output; }
                    }
                    outputContent.textContent = cumulativeOutput;
                }

                function updateUI(newSourceCode, newTraceData, newErrorData, newInputs, newShowInputBox, newHasRandomness) {
                    sourceCode = newSourceCode;
                    try { trace = newTraceData ? JSON.parse(newTraceData) : []; } catch (e) { trace = []; errorData = "Error parsing trace data: " + e; }
                    errorData = newErrorData;
                    codeLines = sourceCode.split('\\n');
                   
                    inputSection.style.display = newShowInputBox ? 'block' : 'none';

                    if (newHasRandomness) {
                        standardControls.style.display = 'none';
                        randomControls.style.display = 'flex';
                    } else {
                        standardControls.style.display = 'flex';
                        randomControls.style.display = 'none';
                    }
                   
                    if (errorData) {
                        errorDisplay.innerHTML = \`<h4>Tracer Failed:</h4><pre>\${errorData}</pre>\`;
                        errorDisplay.style.display = 'block';
                    } else { errorDisplay.style.display = 'none'; }
                   
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
                        globalsDisplay.innerHTML = '<h4>Global Variables</h4>';
                        outputContent.textContent = '';
                    }
                }
               
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'showLoading': document.body.classList.add('loading'); break;
                        case 'hideLoading': document.body.classList.remove('loading'); break;
                        case 'updateTrace':
                            document.body.classList.remove('loading');
                            updateUI(message.sourceCode, message.traceData, message.errorData, message.currentInputs, message.showInputBox, message.hasRandomness);
                            break;
                    }
                });

                prevBtn.onclick = () => { if (currentIndex > 0) { currentIndex--; render(); } };
                nextBtn.onclick = () => { if (currentIndex < trace.length - 1) { currentIndex++; render(); } };
                stepSlider.oninput = () => { currentIndex = parseInt(stepSlider.value, 10); render(); };
               
                rerunStandardBtn.onclick = () => {
                    const inputText = inputBox.value;
                    const safeInput = inputText.replace(/\\n/g, '\\\\n');
                    vscode.postMessage({ command: 'rerun', text: safeInput, seed: currentSeed });
                };

                rerunNewBtn.onclick = () => {
                    const inputText = inputBox.value;
                    const safeInput = inputText.replace(/\\n/g, '\\\\n');
                    currentSeed = Math.floor(Math.random() * 100000);
                    vscode.postMessage({ command: 'rerun', text: safeInput, seed: currentSeed });
                };

                rerunSameBtn.onclick = () => {
                    const inputText = inputBox.value;
                    const safeInput = inputText.replace(/\\n/g, '\\\\n');
                    vscode.postMessage({ command: 'rerun', text: safeInput, seed: currentSeed });
                };

                const initialInputs = ${safeCurrentInputs};
                inputBox.value = initialInputs.replace(/\\\\n/g, '\\n');
                updateUI(sourceCode, JSON.stringify(trace), errorData, initialInputs, showInputBox, hasRandomness);
            </script>
        </body>
        </html>
    `;
}

module.exports = {
    activate,
    deactivate
}
