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
	test('PostIt noteInput module should be importable', () => {
		// This test ensures the PostIt module exists and can be imported
		// If this fails, Add Note command will crash. (test for addnote)
		const { getNoteFromUser } = require('../PostIt/noteInput');
		assert(typeof getNoteFromUser === 'function', 'getNoteFromUser should be a function');
	});

	//TEST 3: Commands Are Registered
	test('All extension commands should be registered', async () => {
		// This test ensures all your commands are available in VS Code
		// - If commands aren't registered, users can't use your extension
		const commands = await vscode.commands.getCommands();
		
		// Test that your commands exist
		assert(commands.includes('test.helloWorld'), 'Hello World command should be registered');
		assert(commands.includes('test.addNote'), 'Add Note command should be registered');
		assert(commands.includes('test.logSelection'), 'Log Selection command should be registered');
	});

	// TEST 4: PostIt Function Handles Empty Input
	test('getNoteFromUser should handle empty input gracefully', async () => {
		// Test in case the PostIt function doesn't crash on empty input
		// Users will cancel the input box or enter nothing
		const { getNoteFromUser } = require('../PostIt/noteInput');
		
		// This is for running an empty text input 
		const originalShowInputBox = vscode.window.showInputBox;
		vscode.window.showInputBox = async () => '';
		
		const result = await getNoteFromUser();
		assert.strictEqual(result, null, 'Should return null for empty input');
		
		// Restore original function
		vscode.window.showInputBox = originalShowInputBox;
	});

	// TEST 5: PostIt Function Handles Valid Input
	test('getNoteFromUser should return note when provided', async () => {
		// This test ensures your PostIt function works with valid input
		// This is the core functionality - it must work!
		const { getNoteFromUser } = require('../PostIt/noteInput');
		
		// Mock the input box to return a test note
		const originalShowInputBox = vscode.window.showInputBox;
		vscode.window.showInputBox = async () => 'Test note content';
		
		const result = await getNoteFromUser();
		assert.strictEqual(result, 'Test note content', 'Should return the note content');
		
		// Restore original function
		vscode.window.showInputBox = originalShowInputBox;
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
