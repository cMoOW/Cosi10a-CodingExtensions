const vscode = require("vscode");
const path = require("path");

class EmailUIManager {
  constructor(context) {
    this.context = context;
    this.panel = null;
  }
  
  async showEmailEditor(initialContent = "", emailList = {}, storedUserEmail = "") {
    const panel = vscode.window.createWebviewPanel(
      "emailNoteEditor",
      "Email Post-It Note",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    // Adds icon to the pop-up 
    const iconPath = vscode.Uri.file(
      path.join(this.context.extensionPath, "PostIt", "post_it_storage.png")
    );
    panel.iconPath = iconPath;

    panel.webview.html = this.getEmailEditorHTML(initialContent, emailList, storedUserEmail);

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === "sendEmail") {
        if (this.onSendCallback) {
          await this.onSendCallback(message.data);
        }
        panel.dispose();
      } else if (message.type === "cancel") {
        panel.dispose();
      }
    });
  }

  onSend(callback) {
    this.onSendCallback = callback;
  }

  getEmailEditorHTML(initialContent = "", emailList = {}, storedUserEmail = "") {
    let emailOptionsHTML = "";

    if (Array.isArray(emailList)) {
      emailOptionsHTML = emailList.map(email => `
          <label class="dropdown-option">
            <input type="checkbox" value="${email}"> ${email}
          </label>
      `).join("");
    } else {
      emailOptionsHTML = Object.entries(emailList).map(([name, email]) => `
          <label class="dropdown-option">
            <input type="checkbox" value="${email}" data-name="${name}"> ${name}
          </label>
      `).join("");
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Post-It Note</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 15px;
          background: var(--vscode-editor-background);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          margin: 0;
          height: 100vh;
          overflow: hidden;
          color: var(--vscode-editor-foreground);
        }

        /* Updated to match inline-editor style */
        .floating-editor {
          background: var(--vscode-sideBar-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 15px;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          max-width: none;
          padding-bottom: 25px;
          color: var(--vscode-editor-foreground);
        }

        h2 {
          color: var(--vscode-editor-foreground);
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        label {
          color: var(--vscode-editor-foreground);
          font-weight: 500;
          display: block;
          margin-bottom: 6px;
        }

        input[type="email"], textarea {
          width: 100%;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid var(--vscode-input-border);
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          font-size: 14px;
          line-height: 1.4;
          margin-bottom: 0;
          box-sizing: border-box;
        }

        textarea {
          flex: 1;
          min-height: 160px;
          font-family: 'Courier New', monospace;
          resize: none;
        }

        .multiselect-container {
          position: relative;
          margin-bottom: 12px;
        }

        .select-box {
          background: var(--vscode-dropdown-background);
          border: 1px solid var(--vscode-dropdown-border);
          padding: 10px;
          border-radius: 4px;
          color: var(--vscode-dropdown-foreground);
          cursor: pointer;
          user-select: none;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .placeholder-text {
          color: var(--vscode-descriptionForeground);
        }

        .dropdown-options {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          width: 100%;
          background: var(--vscode-dropdown-background);
          border: 1px solid var(--vscode-focusBorder);
          border-radius: 0 0 4px 4px;
          max-height: 150px;
          overflow-y: auto;
          z-index: 10;
        }

        .dropdown-options.show {
          display: block;
        }

        .dropdown-option {
          display: block;
          padding: 8px 10px;
          cursor: pointer;
          color: var(--vscode-dropdown-foreground);
        }

        .dropdown-option:hover {
          background: var(--vscode-list-hoverBackground);
        }

        .editor-buttons {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 10px;
        }

        button {
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
          font-size: 12px;
        }

        .send-btn {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }

        .send-btn:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .cancel-btn {
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }

        .cancel-btn:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }
      </style>
    </head>
    <body>
      <div class="floating-editor">
        <h2>Email Post-It Note</h2>
        <label>Your Email:</label>
        <input type="email" id="userEmail" value="${storedUserEmail}" placeholder="you@brandeis.edu" required />

        <label>Recipients:</label>
        <div class="multiselect-container">
          <div id="selectBox" class="select-box" tabindex="0">
            <span id="selectedNames" class="placeholder-text">Select recipients...</span>
          </div>
          <div id="dropdown" class="dropdown-options">${emailOptionsHTML}</div>
        </div>

        <label>Note Content:</label>
        <textarea id="noteContent" placeholder="Enter your note...">${initialContent}</textarea>

        <div class="editor-buttons">
          <button class="cancel-btn" id="cancelBtn">Cancel</button>
          <button class="send-btn" id="sendBtn">Send Email</button>
        </div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        const dropdown = document.getElementById('dropdown');
        const selectBox = document.getElementById('selectBox');
        const selectedNames = document.getElementById('selectedNames');

        selectBox.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('show');
        });

        window.addEventListener('click', (e) => {
          if (!selectBox.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
          }
        });

        // Helper: measure text width
        function getTextWidth(text, font) {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          context.font = font || getComputedStyle(selectedNames).font;
          return context.measureText(text).width;
        }

        function updateSelectedNames() {
          const checked = dropdown.querySelectorAll('input[type="checkbox"]:checked');
          const names = Array.from(checked).map(c => c.dataset.name || c.value);

          if (names.length === 0) {
            selectedNames.textContent = 'Select recipients...';
            selectedNames.classList.add('placeholder-text');
            return;
          }

          selectedNames.classList.remove('placeholder-text');

          const font = getComputedStyle(selectedNames).font;
          const boxWidth = selectBox.clientWidth - 20;
          let displayText = '';

          // If more than 2 recipients, join all but the last two with commas
          if (names.length > 2) {
            displayText = names.slice(0, names.length - 1).join(', ') + ', and ' + names[names.length - 1];
          } else if (names.length === 2) {
            displayText = names.join(' and ');
          } else {
            displayText = names[0];
          }

          // If the text overflows, shorten it with "and N others"
          if (getTextWidth(displayText, font) > boxWidth) {
            let shownNames = [];
            for (let i = 0; i < names.length; i++) {
              const testText = shownNames.concat(names[i]).join(', ') + ', and ' + (names.length - i - 1) + ' others';
              if (getTextWidth(testText, font) > boxWidth) {
                displayText = shownNames.join(', ') + ', and ' + (names.length - i) + ' others';
                break;
              }
              shownNames.push(names[i]);
            }
          } 
          if (displayText.charAt(0) === ',') {
           displayText = '' + names.length + ' selected'; 
          }
          selectedNames.textContent = displayText;
        }


        dropdown.addEventListener('change', updateSelectedNames);

        document.getElementById('sendBtn').addEventListener('click', () => {
          const userEmail = document.getElementById('userEmail').value.trim();
          const noteContent = document.getElementById('noteContent').value.trim();
          const checked = dropdown.querySelectorAll('input[type="checkbox"]:checked');
          const recipients = Array.from(checked).map(c => c.value);

          if (!userEmail || !noteContent || recipients.length === 0) {
            alert('Please fill in all fields and select at least one recipient.');
            return;
          }

          vscode.postMessage({
            type: 'sendEmail',
            data: { userEmail, recipients, noteContent }
          });
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
          vscode.postMessage({ type: 'cancel' });
        });
      </script>
    </body>
    </html>
    `;
  }
}

module.exports = { EmailUIManager };
