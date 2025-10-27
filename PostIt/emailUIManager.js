const vscode = require("vscode");
const path = require("path")

class EmailUIManager {
  constructor(context) {
    this.context = context;
    this.panel = null;
  }

async showEmailEditor(initialContent = "", emailList = [], storedUserEmail = "") {
  // Create a webview panel just like the note editor
  const panel = vscode.window.createWebviewPanel(
    "emailNoteEditor",
    "Email Post-It Note", // This is the title of the tab
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: false,
    }
  );

  const iconPath = vscode.Uri.file(
    path.join(this.context.extensionPath, "PostIt", "post_it_storage.png") // Can also be post_it_logo
  );
  panel.iconPath = iconPath;

  panel.webview.html = this.getEmailEditorHTML(initialContent, emailList, storedUserEmail);

  // Listen for messages from the webview
  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.type === "sendEmail") {
      // Pass this back to whoever created the EmailUIManager
      if (this.onSendCallback) {
        await this.onSendCallback(message.data);
      }
      this.panel.dispose();
    } else if (message.type === "cancel") {
      this.panel.dispose();
    }
  });
}


  onSend(callback) {
    this.onSendCallback = callback;
  }

  getEmailEditorHTML(initialContent = "", emailList = [], storedUserEmail = "") {
    const emailOptionsHTML = emailList.map(email => `
        <label class="dropdown-option">
        <input type="checkbox" value="${email}"> ${email}
        </label>
    `).join("");

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
            background: #1e1e1e;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            margin: 0;
            height: 100vh;
            overflow: hidden;
        }
        .floating-editor {
            background: #2d2d30;
            border-radius: 6px;
            padding: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            max-width: none;
            padding-bottom: 25px; /* Added extra padding for buttons */
        }
        h2 {
            color: #cccccc;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        label {
            color: #cccccc;
            font-weight: 500;
            display: block;
            margin-bottom: 6px;
        }
        input[type="email"], textarea {
            width: 100%;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #3e3e42;
            background: #1e1e1e;
            color: #cccccc;
            font-size: 14px;
            line-height: 1.4;
            margin-bottom: 0px;
            box-sizing: border-box;
        }
        textarea {
            flex: 1;
            min-height: 160px;
            font-family: 'Courier New', monospace;
            resize: none;
        }
        .editor-textarea:focus {
                    border-color: #007acc;
        }
        .multiselect-container {
            position: relative;
            margin-bottom: 12px;
        }
        .select-box {
            background: #1e1e1e;
            border: 1px solid #3e3e42;
            padding: 10px;
            border-radius: 4px;
            color: #cccccc;
            cursor: pointer;
        }
        .dropdown-options {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            width: 100%;
            background: #3a3a3a;
            border: 1px solid #74B9FF;
            border-radius: 0 0 4px 4px;
            max-height: 150px;
            overflow-y: auto;
            z-index: 10;
        }
        .dropdown-options.show { display: block; }
        .dropdown-option {
            display: block;
            padding: 8px 10px;
            cursor: pointer;
        }
        .dropdown-option:hover { background: #5aa0e6; }
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
        .send-btn { background: #0e639c; color: white; }
        .send-btn:hover { background: #1177bb; }
        .cancel-btn { background: #5a5a5a; color: white; }
        .cancel-btn:hover { background: #6a6a6a; }
        </style>
    </head>
    <body>
        <div class="floating-editor">
        <h2>Email Post-It Note</h2>
        <label>Your Email:</label>
        <input type="email" id="userEmail" value="${storedUserEmail}" placeholder="you@brandeis.edu" required />

        <label>Recipients:</label>
        <div class="multiselect-container">
            <div id="selectBox" class="select-box" tabindex="0">Select recipients...</div>
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
        selectBox.addEventListener('click', () => dropdown.classList.toggle('show'));
        window.addEventListener('click', (e) => {
            if (!selectBox.contains(e.target)) dropdown.classList.remove('show');
        });

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
