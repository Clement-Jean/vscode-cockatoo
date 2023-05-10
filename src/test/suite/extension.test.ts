import * as assert from 'assert';

import * as vscode from 'vscode';
import Recorder from '../../recorder';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('isRecording', () => {
		const recorder = Recorder.getInstance();

		recorder.record();

		assert(recorder.isRecording());
	});
});
