import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { Action, StartingPoint, Frame, StopPoint, Record } from "./gen/recorder_pb";
import { mapSelection, mapTextDocumentContentChange, toSelection, toTextDocumentContentChange } from "./mappers";
import { CacheProvider } from "./cache";
import { EXTENSION_NAME } from "./constants";
import { TextDocumentContentChange } from "./gen/recorder_pb";
import { Range } from "./gen/recorder_pb";
import { Selection } from "./gen/recorder_pb";
import { Position } from "./gen/recorder_pb";

export default class Recorder {
  private static instance: Recorder;
  private _isRecording: boolean = false;
  private _isReplaying: boolean = false;
  private _actions: Array<Action> = new Array();
  private _disposables: vscode.Disposable | undefined;
  private _changes: readonly vscode.TextDocumentContentChangeEvent[] = new Array();
  private _currentActionIdx: number = -1;
  private _replayingMacro: Record | undefined = undefined;

  public static getInstance(): Recorder {
    if (!Recorder.instance) {
      Recorder.instance = new Recorder();
    }

    return Recorder.instance;
  }

  public isRecording() { return this._isRecording; }

  private constructor() {}

  //#region RECORD
  private onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent) {
    // store changes, selection change will commit
    this._changes = e.contentChanges;
  }

  private onDidChangeTextEditorSelection(e: vscode.TextEditorSelectionChangeEvent) {
    const changes = this._changes.map(mapTextDocumentContentChange);

    if (changes.length === 0) {
      return;
    }

    const selections = e.selections.map(mapSelection) || [];
    const f = new Frame({
      position: BigInt(this._actions.length),
      changes,
      selections,
    });

    this._actions.push(new Action({
      value: {
        case: "frame",
        value: f,
      }
    }));
    this._changes = [];
  }

  private subscribeToEvents() {
    var onDidChangeTextDocumentEvent = vscode.workspace.onDidChangeTextDocument(
      this.onDidChangeTextDocument,
      this,
    );

    var onDidChangeTextEditorSelectionEvent = vscode.window.onDidChangeTextEditorSelection(
      this.onDidChangeTextEditorSelection,
      this,
    );

    this._disposables = vscode.Disposable.from(
      onDidChangeTextDocumentEvent,
      onDidChangeTextEditorSelectionEvent,
    );
  }

  public record() {
    console.log("record called");

    this.subscribeToEvents();

    if (this._actions.length !== 0) {
      console.log("recordings reset");
      this._actions = []; // reset actions
    }

    var textEditor = vscode.window.activeTextEditor;

    if (textEditor) {
      const content = textEditor.document.getText();
      const selections = textEditor.selections.map(mapSelection);
      const language = textEditor.document.languageId;
      const sp = new StartingPoint({
        position: BigInt(this._actions.length),
        content,
        language,
        selections
      });

      vscode.window.showInformationMessage("Recorder is recording!");
      this._isRecording = true;
      this._actions.push(new Action({
        value: {
          case: "startingPoint",
          value: sp,
        }
      }));
    }
  }
  //#endregion

  //#region EXIT
  public exitMacro() {
    if (this._isRecording) {
      this._isRecording = false;
      this._actions = [];
      this._changes = [];
      this.dispose();
    } else if (this._isReplaying) {
      this._isReplaying = false;
      this._currentActionIdx = -1;
      this._replayingMacro = undefined;
    }
  }
  //#endregion

  //#region SAVE
  public save(cache: CacheProvider) {
    if (this._isRecording) {
      //TODO if last not stopping point add it automatically

      vscode.window
        .showInputBox({
          prompt: "Give this thing a name",
          placeHolder: "cool-macro"
        })
        .then(async name => {
          if (name) {
            await cache.put(name, new Record({ actions: this._actions }));
            vscode.window.showInformationMessage("Recorder stoped recording!");
            this.exitMacro();
          }
        });
    } else {
      vscode.window.showInformationMessage("Recorder not recording!");
    }
  }
  //#endregion

  //#region STOP POINT
  public insertNamedStop() {
    vscode.window
      .showInputBox({
        prompt: "What do you want to call your stop point?",
        placeHolder: "Type a name or ENTER for unnamed stop point"
      })
      .then(name => {
        this.insertStop(name || null);
      });
  }

  public insertStop(name: string | null) {
    const sp = new StopPoint({
      position: BigInt(this._actions.length),
      name: name || ""
    });

    this._actions.push(new Action({
      value: {
        case: "stopPoint",
        value: sp,
      }
    }));
  }
  //#endregion

  //#region REPLAY
  private async setStartingPoint(
    startingPoint: StartingPoint,
  ) {
    let editor = vscode.window.activeTextEditor;

    // if no open text editor, open one
    if (!editor) {
      vscode.window.showInformationMessage("opening new window");
      const document = await vscode.workspace.openTextDocument({
        language: startingPoint.language,
        content: startingPoint.content
      });

      editor = await vscode.window.showTextDocument(document);
    } else {
      await editor!.edit(edit => {
        // update initial file content
        const l = editor!.document.lineCount;
        const range = new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(
            l,
            Math.max(
              0,
              editor!.document.lineAt(Math.max(0, l - 1)).text.length - 1
            )
          )
        );

        edit.delete(range);
        edit.insert(new vscode.Position(0, 0), startingPoint.content);
      });
    }

    if (editor) {
      this.updateSelections(startingPoint.selections.map(toSelection), editor);

      // language should always be defined, guard statement here
      // to support old recorded frames before language bit was added
      if (startingPoint.language) {
        vscode.languages.setTextDocumentLanguage(editor.document, startingPoint.language);
      }
    }
  }

  public replay(cache: CacheProvider) {
    const items = cache.keys();

    vscode.window.showQuickPick(items).then(async picked => {
      if (!picked) {
        return;
      }

      const macro = await cache.get(picked);
      const current = macro?.actions[0];

      if (current?.value.case === "startingPoint") {
        this.setStartingPoint(<StartingPoint>current.value.value);
      }

      this._currentActionIdx = 0;
      this._isReplaying = true;
      this._replayingMacro = macro;
      vscode.window.showInformationMessage(
        `Now playing ${macro?.actions.length} actions from ${picked}!`
      );
    });
  }
  //#endregion

  //#region TYPING
  private applyContentChanges(
    changes: readonly vscode.TextDocumentContentChangeEvent[],
    edit: vscode.TextEditorEdit
  ) {
    changes.forEach(change => this.applyContentChange(change, edit));
  }

  private applyContentChange(
    change: vscode.TextDocumentContentChangeEvent,
    edit: vscode.TextEditorEdit
  ) {
    if (change.text === "") {
      edit.delete(change.range);
    } else if (change.rangeLength === 0) {
      edit.insert(change.range.start, change.text);
    } else {
      edit.replace(change.range, change.text);
    }
  }

  private updateSelections(
    selections: readonly vscode.Selection[],
    editor: vscode.TextEditor
  ) {
    editor.selections = selections;

    // move scroll focus if needed
    if (editor.selections.length > 0 &&
        'start' in editor.selections[0] &&
        'end' in editor.selections[0]) {
      const { start, end } = editor.selections[0];

      editor.revealRange(
        new vscode.Range(start, end),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
      );
    }
  }

  public onType(text: string) {
    if (this._isReplaying && this._replayingMacro) {
      this._currentActionIdx++;

      if (this._currentActionIdx > this._replayingMacro.actions.length) {
        return this.exitMacro();
      }

      const editor = vscode.window.activeTextEditor;
      const action = this._replayingMacro.actions[this._currentActionIdx];

      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      switch (action.value.case) {
        case "startingPoint":
          break;

        case "frame":
          const f = <Frame>action.value.value;

          editor
            .edit(edit => this.applyContentChanges(f.changes.map(toTextDocumentContentChange), edit))
            .then(() => {
              if (f.selections.length) {
                this.updateSelections(f.selections.map(toSelection), editor);
              }
            });
          break;

        case "stopPoint":
          if (text === `\n`) {
            break;
          }
          this._currentActionIdx--;
          break;
      }
    } else {
      vscode.commands.executeCommand("default:type", { text });
    }
  }
  //#endregion

  //#region REMOVE
  public remove(cache: CacheProvider) {
    const items = cache.keys();

    vscode.window.showQuickPick(items).then(async picked => {
      if (!picked) {
        return;
      }

      await cache.remove(picked);
      vscode.window.showInformationMessage(`Removed "${picked}"`);
    });
  }
  //#endregion

  //#region EXPORT
  public export(cache: CacheProvider) {
    const items = cache.keys();

    vscode.window.showQuickPick(items).then(async picked => {
      if (!picked) {
        return;
      }

      const options: vscode.SaveDialogOptions = {
        saveLabel: "Export",
        defaultUri: vscode.Uri.file(`${os.homedir()}/${picked}`),
      };

      vscode.window.showSaveDialog(options).then(async (location: vscode.Uri | undefined) => {
        if (location === undefined) { return; }

        const c = await cache.get(picked);

        if (c === undefined) { return; }

        fs.writeFile(location.fsPath, c.toBinary(), (err) => {
          if (err) {
            vscode.window.showErrorMessage(`Error exporting ${picked}`);
            console.log(err);
            return;
          }

          vscode.window.showInformationMessage(`Exported "${picked}"`);
        });
      });
    });
  }
  //#endregion

  //#region IMPORT
  public import(cache: CacheProvider) {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: true,
      openLabel: "Import",
    };

    vscode.window.showOpenDialog(options).then((files: vscode.Uri[] | undefined) => {
      if (files === undefined) {
        return;
      }

      for (let i = 0; i < files.length; i++) {
        fs.readFile(files[i].fsPath, async (err: NodeJS.ErrnoException | null, data: Buffer) => {

          if (err) {
            vscode.window.showErrorMessage(`Error importing ${files[i].fsPath}`);
            console.log(err);
            return;
          }

          const name = path.basename(files[i].fsPath);

          await cache.put(name, Record.fromBinary(data));
        });

        vscode.window.showInformationMessage(`Imported "${files[i].fsPath}"`);
      }
    });
  }
  //#endregion

  public removeLastChar() {
    if (this._isRecording) {
      let item = this._actions.at(-1);

      // a frame with text "" gets inserted after hiting backspace
      if (item !== undefined && item.value.case === "frame" && item.value.value.changes[0].text.length === 0) {
        this._actions.pop();
      }

      item = this._actions.at(-1);

      if (item !== undefined && item.value.case !== "startingPoint") {
        this._actions.pop();
        vscode.commands.executeCommand("deleteLeft");
      }
    } else if (this._isReplaying && this._currentActionIdx - 1 >= 0) {
      this._currentActionIdx--;
      vscode.commands.executeCommand("deleteLeft");
    }
  }

  //#region IMPORT TEMPLATE
  private readFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (error, data) => error ? reject(error) : resolve(data.toString()));
    });
  }

  private contentToActions(content: string): Record {
    const record = new Record();
    let position = 1;
    let character = 1;
    let line = 0;

    const sp = new StartingPoint({
      content: "",
      language: "plaintext",
    });

    record.actions.push(new Action({
      value: {
        case: "startingPoint",
        value: sp,
      }
    }));

    for (let i = 0; i < content.length; i++) {
      const c = content[i];

      if (c === '\n') {
        line++;
        character = 0;
      }

      record.actions.push(new Action({
        value: {
          case: "frame",
          value: new Frame({
            position: BigInt(position),
            changes: [
              new TextDocumentContentChange({
                range: new Range({
                  start: new Position({ line: BigInt(c === '\n' ? line - 1 : line), character: BigInt(position - 1) }),
                  end: new Position({ line: BigInt(c === '\n' ? line - 1 : line), character: BigInt(position - 1) })
                }),
                rangeOffset: BigInt(i + 1),
                text: c
              })
            ],
            selections: [
              new Selection({
                anchor: new Position({ line: BigInt(line), character: BigInt(character) }),
                active: new Position({ line: BigInt(line), character: BigInt(character) })
              })
            ]
          })
        }
      }));

      position++;
      character++;
    }

    return record;
  }

  public async importTemplate(cache: CacheProvider) {
    try {
      const template = vscode.workspace.getConfiguration(EXTENSION_NAME);

      if (template.has("templates")) {
	      const p: string = template.get("templates")!;
        const dir = await fs.promises.opendir(p);

        for await (const dirent of dir) {
          const content = await this.readFile(path.join(p, dirent.name));
          const record = this.contentToActions(content);
          const keys = await cache.keys();

          if (keys.includes(dirent.name)) {
            const question = `Do you want override ${dirent.name}?`;
            const yes = "Yes";
            const no = "No";

            vscode.window
              .showInformationMessage(question, yes, no)
              .then(async answer => {
                if (answer === yes) {
                  await cache.put(dirent.name, record);
                }
              });
          } else {
            await cache.put(dirent.name, record);
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
  //#endregion

  dispose() {
    if (this._disposables) {
      this._disposables.dispose();
    }
  }
}