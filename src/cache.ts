import * as vscode from 'vscode';
import { Record } from "./gen/recorder_pb";
import { EXTENSION_NAME } from './constants';

export class RecorderCache {
	[records: string]: {
		[name: string]: Uint8Array
	}
}

export class CacheProvider {
  private static instance: CacheProvider;
	private readonly _cacheName = `${EXTENSION_NAME}`;
  private _cache: RecorderCache = {};

	public static getInstance(context: vscode.ExtensionContext) {
    if (!CacheProvider.instance) {
      CacheProvider.instance = new CacheProvider(context);
    }

    return CacheProvider.instance;
  }

	private constructor(private context: vscode.ExtensionContext) {
		const defaultData: RecorderCache = { records: { } };
		this._cacheName = `${EXTENSION_NAME}_cache`;
		this._cache = context.globalState.get<RecorderCache>(this._cacheName, defaultData);
	}

	public async get(name: string): Promise<Record | undefined> {
		let record: Record | undefined = undefined;

		if (name in this._cache.records) {
			record = new Record();

			const values = Object.values(this._cache.records[name]);
			const arr = Uint8Array.from(values);

			record.fromBinary(arr);
		}

		return record;
	}

	public async put(name: string, record: Record) {
		this._cache.records[name] = record.toBinary();
		await this.context.globalState.update(this._cacheName, this._cache);
	}

	public async remove(name: string) {
		if (name in this._cache.records) {
			delete this._cache.records[name];
		}

		await this.context.globalState.update(this._cacheName, this._cache);
	}

	public async keys(): Promise<string[]> {
		return Object.keys(this._cache.records);
	}

	public async clear() {
    this._cache = {};
    await this.context.globalState.update(this._cacheName, {});
  }
}