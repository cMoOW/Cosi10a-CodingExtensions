const vscode = require('vscode');

/**
 * Gets post-it note input from user 
 * @returns the note if one is inputted, null otherwise
 */
async function getNoteFromUser(){
    const note = await vscode.window.showInputBox({
        prompt: 'Enter your note/comment',
        placeHolder: 'Type your note/comment here...',
        ignoreFocusOut: true 
    });

    if(note){
        vscode.window.showInformationMessage(`Note added: ${note}`);
        return note;
    }else{
        vscode.window.showWarningMessage('No note entered.');
        return null;
    }
}

module.exports = { getNoteFromUser };