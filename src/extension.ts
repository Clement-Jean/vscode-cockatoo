import * as vscode from 'vscode';
import Recorder from './recorder';
import { CacheProvider } from './cache';
import {
	RECORD_COMMAND_NAME,
	SAVE_COMMAND_NAME,
	PLAY_COMMAND_NAME,
	RM_COMMAND_NAME,
	STOP_COMMAND_NAME,
	NAMED_STOP_COMMAND_NAME,
	EXPORT_COMMAND_NAME,
	IMPORT_COMMAND_NAME,
	EXIT_COMMAND_NAME,
	RM_LAST_CHAR_KEYBINDING_NAME
} from './constants';

export function activate(context: vscode.ExtensionContext) {
	let cache = CacheProvider.getInstance(context);
	let recorder = Recorder.getInstance();

	context.subscriptions.push(
		recorder,
		vscode.commands.registerCommand(
			RECORD_COMMAND_NAME,
			recorder.record,
			recorder
		),
		vscode.commands.registerCommand(
			EXIT_COMMAND_NAME,
			recorder.exitMacro,
			recorder
		),
		vscode.commands.registerCommand(
			SAVE_COMMAND_NAME,
			() => { recorder.save(cache); },
			recorder,
		),
		vscode.commands.registerCommand(
			RM_COMMAND_NAME,
			() => { recorder.remove(cache); },
			recorder,
		),
		vscode.commands.registerCommand(
			PLAY_COMMAND_NAME,
			() => { recorder.replay(cache); },
			recorder
		),
		vscode.commands.registerCommand(
			STOP_COMMAND_NAME,
			() => { recorder.insertStop(null); },
			recorder
		),
		vscode.commands.registerCommand(
			NAMED_STOP_COMMAND_NAME,
			recorder.insertNamedStop,
			recorder
		),
		vscode.commands.registerCommand(
			"type",
			({ text }: { text: string }) => { recorder.onType(text); },
			recorder,
		),
		vscode.commands.registerCommand(
			EXPORT_COMMAND_NAME,
			() => { recorder.export(cache); },
			recorder
		),
		vscode.commands.registerCommand(
			IMPORT_COMMAND_NAME,
			() => { recorder.import(cache); },
			recorder
		),
		vscode.commands.registerCommand(
			RM_LAST_CHAR_KEYBINDING_NAME,
			recorder.removeLastChar,
			recorder
		)
	);
}

export function deactivate() {}
