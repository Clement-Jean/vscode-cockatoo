// @ts-ignore
import { name, contributes } from '../package.json';

enum CommandIdx {
	record,
	exit,
	save,
	play,
	rm,
	stop,
	namedStop,
	export,
	import,
}

enum KeybindingIdx {
	removeLastChar,
}

const EXTENSION_NAME: string = name;

const RECORD_COMMAND_NAME: string = contributes.commands[CommandIdx.record].command;
const EXIT_COMMAND_NAME: string = contributes.commands[CommandIdx.exit].command;
const SAVE_COMMAND_NAME: string = contributes.commands[CommandIdx.save].command;
const PLAY_COMMAND_NAME: string = contributes.commands[CommandIdx.play].command;
const RM_COMMAND_NAME: string = contributes.commands[CommandIdx.rm].command;
const STOP_COMMAND_NAME: string = contributes.commands[CommandIdx.stop].command;
const NAMED_STOP_COMMAND_NAME: string = contributes.commands[CommandIdx.namedStop].command;
const EXPORT_COMMAND_NAME: string = contributes.commands[CommandIdx.export].command;
const IMPORT_COMMAND_NAME: string = contributes.commands[CommandIdx.import].command;
const RM_LAST_CHAR_KEYBINDING_NAME: string = contributes.keybindings[KeybindingIdx.removeLastChar].command;

export {
	EXTENSION_NAME,
	RECORD_COMMAND_NAME,
	EXIT_COMMAND_NAME,
	SAVE_COMMAND_NAME,
	PLAY_COMMAND_NAME,
	RM_COMMAND_NAME,
	STOP_COMMAND_NAME,
	NAMED_STOP_COMMAND_NAME,
	EXPORT_COMMAND_NAME,
	IMPORT_COMMAND_NAME,
	RM_LAST_CHAR_KEYBINDING_NAME
};