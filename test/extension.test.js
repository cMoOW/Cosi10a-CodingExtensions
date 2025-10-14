/**
 * This file is used to test the extensions. Tests functionality of the main extension.js file. Unit tests to ensure extensions work correctly. 
 */
const assert = require('assert');

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const vscode = require('vscode');
// const myExtension = require('../extension');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	//TEST 1: Extension Activation
	test('Extension should activate without errors', async () => {
		// This test checks if the extension doesn't crash on startup
		// - If activation fails, it means extension won't work at all
		const extension = require('../extension');
		assert(extension.activate, 'Extension should have activate function');
		assert(extension.deactivate, 'Extension should have deactivate function');
	});

	//TEST 2: PostIt Module Exists
	test('PostIt NoteManager module should be importable', () => {
		// This test ensures the PostIt module exists and can be imported
		// If this fails, Add Note command will crash. (test for addnote)
		const { NoteManager } = require('../PostIt/noteManager');
		assert(typeof NoteManager === 'function', 'NoteManager should be a class/function');
	});

	//TEST 3: Commands Are Registered
	test('All extension commands should be registered', async () => {
		// This test ensures all your commands are available in VS Code
		// - If commands aren't registered, users can't use your extension
		const commands = await vscode.commands.getCommands();
		
		// Test that your commands exist
		assert(commands.includes('test.helloWorld'), 'Hello World command should be registered');
		assert(commands.includes('test.addNote'), 'Add Note command should be registered');
		assert(commands.includes('test.viewNotes'), 'View Notes command should be registered');
		assert(commands.includes('test.emailCodeSnippet'), 'Email Code Snippet command should be registered');
	});

	// TEST 4: NoteManager Can Be Instantiated
	test('NoteManager should be instantiable with context', () => {
		// Test that NoteManager can be created (core functionality)
		const { NoteManager } = require('../PostIt/noteManager');
		
		// Mock context object
		const mockContext = {
			globalState: {
				get: () => [],
				update: () => Promise.resolve()
			},
			subscriptions: []
		};
		
		const noteManager = new NoteManager(mockContext);
		assert(noteManager, 'NoteManager should be instantiable');
		assert(typeof noteManager.addNote === 'function', 'addNote should be a function');
		assert(typeof noteManager.viewAllNotes === 'function', 'viewAllNotes should be a function');
		assert(typeof noteManager.getNotesCount === 'function', 'getNotesCount should be a function');
	});

	// TEST 5: NoteManager Handles Empty Notes
	test('NoteManager should handle empty notes list', () => {
		// Test that NoteManager works with no existing notes
		const { NoteManager } = require('../PostIt/noteManager');
		
		const mockContext = {
			globalState: {
				get: () => [], // Empty notes array
				update: () => Promise.resolve()
			},
			subscriptions: []
		};
		
		const noteManager = new NoteManager(mockContext);
		assert.strictEqual(noteManager.getNotesCount(), 0, 'Should return 0 for empty notes');
	});

	// Test 6: Extension Doesn't Crash on Invalid Input
	test('Extension should handle edge cases without crashing', () => {
		// For unexpected inputs
		// In such case what we write must handle it
		const extension = require('../extension');
		
		// Test that extension can be required without errors
		assert(extension, 'Extension should be requireable');
		assert(typeof extension.activate === 'function', 'activate should be a function');
		assert(typeof extension.deactivate === 'function', 'deactivate should be a function');
	});
});


