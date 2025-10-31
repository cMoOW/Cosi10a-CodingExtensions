// todoDecorator.js
const vscode = require("vscode");

// A module-level variable to hold the decoration type
let todoDecorationType;
// A timeout variable for debouncing
let timeout;

/**
 * Finds all "TODO" occurrences and applies the decoration.
 */
function updateDecorations() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const text = editor.document.getText();
  const todoMatches = [];
  // The regular expression to find "TODO"
  const regex = /TODO/g;
  let match;

  // Find all matches
  while ((match = regex.exec(text))) {
    const startPos = editor.document.positionAt(match.index);
    const endPos = editor.document.positionAt(match.index + match[0].length);
    const range = new vscode.Range(startPos, endPos);
    // Add the range and a hover message to our array
    todoMatches.push({ range, hoverMessage: "This is a TODO item." });
  }

  // Apply the decorations to the editor
  editor.setDecorations(todoDecorationType, todoMatches);
}

/**
 * A debounced function to trigger the update.
 */
function triggerUpdateDecorations() {
  if (timeout) {
    clearTimeout(timeout);
  }
  // Set a timeout to run the update after 500ms
  timeout = setTimeout(updateDecorations, 500);
}

/**
 * This function initializes the decorator and sets up the event listeners.
 * @param {vscode.ExtensionContext} context The extension context.
 */
function activateHighlighter(context) {
  // Create the decoration type
  todoDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(255, 255, 0, 0.3)",
    borderColor: "rgba(255, 255, 0, 0.5)",
    borderWidth: "1px",
    borderStyle: "solid",
    cursor: "crosshair",
    // Use a light theme color for the ruler
    light: {
      overviewRulerColor: "yellow",
    },
    // Use a dark theme color for the ruler
    dark: {
      overviewRulerColor: "darkorange",
    },
  });

  // Trigger the initial update if an editor is open
  if (vscode.window.activeTextEditor) {
    triggerUpdateDecorations();
  }

  // Add event listeners for editor and text changes
  const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  const onDidChangeText = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (
        vscode.window.activeTextEditor &&
        event.document === vscode.window.activeTextEditor.document
      ) {
        triggerUpdateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  // Push disposables to the context subscriptions
  context.subscriptions.push(onDidChangeActiveEditor, onDidChangeText);
}

// Export the main function to be used in extension.js
module.exports = {
  activateHighlighter,
};
