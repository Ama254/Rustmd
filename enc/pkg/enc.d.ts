/* tslint:disable */
/* eslint-disable */
export enum EncryptionAlgorithm {
  Aes256Gcm = 0,
  Aes128Gcm = 1,
}
export enum KdfAlgorithm {
  Argon2 = 0,
  Pbkdf2 = 1,
}
export class BatchResult {
  free(): void;
  constructor(successes: Uint8Array[], errors: string[]);
  readonly successes: Uint8Array[];
  readonly errors: string[];
}
export class Config {
  free(): void;
  constructor(kdf_time_cost: number, kdf_mem_cost: number, kdf_parallelism: number, algorithm: EncryptionAlgorithm, kdf_algorithm: KdfAlgorithm, key_version: number);
}
export class CryptoService {
  free(): void;
  constructor(master_key: Uint8Array, config: Config);
  encrypt(data: Uint8Array, context: Uint8Array, aad?: Uint8Array | null): Uint8Array;
  decrypt(ciphertext: Uint8Array, context: Uint8Array, aad?: Uint8Array | null): Uint8Array;
  batch_encrypt(data_items: any[], context: Uint8Array, aad?: Uint8Array | null, progress_callback?: Function | null, max_memory_bytes?: number | null): BatchResult;
  batch_decrypt(ciphertexts: any[], context: Uint8Array, aad?: Uint8Array | null, progress_callback?: Function | null, max_memory_bytes?: number | null): BatchResult;
  init_stream_encrypt(): StreamState;
  stream_encrypt_chunk(state: StreamState, data: Uint8Array, context: Uint8Array, aad: Uint8Array | null | undefined, is_final: boolean, progress_callback?: Function | null): Uint8Array;
  estimate_encrypted_size(input_size: number): number;
}
export class SecureBytes {
  free(): void;
  constructor(data: Uint8Array);
  static random(len: number): SecureBytes;
  readonly data: Uint8Array;
}
export class StreamState {
  private constructor();
  free(): void;
  readonly processed_bytes: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_securebytes_free: (a: number, b: number) => void;
  readonly __wbg_cryptoservice_free: (a: number, b: number) => void;
  readonly __wbg_config_free: (a: number, b: number) => void;
  readonly __wbg_batchresult_free: (a: number, b: number) => void;
  readonly __wbg_streamstate_free: (a: number, b: number) => void;
  readonly batchresult_new: (a: number, b: number, c: number, d: number) => number;
  readonly batchresult_successes: (a: number) => [number, number];
  readonly batchresult_errors: (a: number) => [number, number];
  readonly config_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly securebytes_new: (a: any) => number;
  readonly securebytes_random: (a: number) => [number, number, number];
  readonly securebytes_data: (a: number) => any;
  readonly streamstate_processed_bytes: (a: number) => number;
  readonly cryptoservice_new: (a: any, b: number) => [number, number, number];
  readonly cryptoservice_encrypt: (a: number, b: any, c: any, d: number) => [number, number, number];
  readonly cryptoservice_decrypt: (a: number, b: any, c: any, d: number) => [number, number, number];
  readonly cryptoservice_batch_encrypt: (a: number, b: number, c: number, d: any, e: number, f: number, g: number) => [number, number, number];
  readonly cryptoservice_batch_decrypt: (a: number, b: number, c: number, d: any, e: number, f: number, g: number) => [number, number, number];
  readonly cryptoservice_init_stream_encrypt: (a: number) => [number, number, number];
  readonly cryptoservice_stream_encrypt_chunk: (a: number, b: number, c: any, d: any, e: number, f: number, g: number) => [number, number, number];
  readonly cryptoservice_estimate_encrypted_size: (a: number, b: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_drop_slice: (a: number, b: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
