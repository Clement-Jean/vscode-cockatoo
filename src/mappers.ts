import * as vscode from "vscode";
import {
  TextDocumentContentChange,
  Range, Position, Selection
} from "./gen/recorder_pb";

function mapPosition(v: vscode.Position): Position {
	return new Position({
		line: BigInt(v.line),
		character: BigInt(v.character),
	});
}

function mapRange(v: vscode.Range): Range {
	return new Range({
		start: mapPosition(v.start),
		end: mapPosition(v.end),
	});
}

export function mapTextDocumentContentChange(v: vscode.TextDocumentContentChangeEvent): TextDocumentContentChange {
	return new TextDocumentContentChange({
		range: mapRange(v.range),
		rangeOffset: BigInt(v.rangeOffset),
		rangeLength: BigInt(v.rangeLength),
		text: v.text
	});
}

export function mapSelection(v: vscode.Selection): Selection {
	return new Selection({
		anchor: mapPosition(v.anchor),
		active: mapPosition(v.active)
	});
}

export function toPosition(v: Position): vscode.Position {
	return new vscode.Position(Number(v.line), Number(v.character));
}

export function toRange(v: Range): vscode.Range {
	return new vscode.Range(toPosition(v.start!), toPosition(v.end!));
}

export function toTextDocumentContentChange(v: TextDocumentContentChange): vscode.TextDocumentContentChangeEvent {
	return {
		text: v.text,
		range: toRange(v.range!),
		rangeLength: Number(v.rangeLength),
		rangeOffset: Number(v.rangeOffset)
	};
}

export function toSelection(v: Selection): vscode.Selection {
	return new vscode.Selection(toPosition(v.anchor!), toPosition(v.active!));
}