let wasm;

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_2.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => {
    wasm.__wbindgen_export_6.get(state.dtor)(state.a, state.b)
});

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_6.get(state.dtor)(a, state.b);
                CLOSURE_DTORS.unregister(state);
            } else {
                state.a = a;
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_export_2.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_2.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {ArchiveFile[]} files
 * @param {ArchiveConfig} config
 * @param {Function | null} [progress_callback]
 * @param {AbortSignal | null} [abort_signal]
 * @returns {Promise<Blob>}
 */
export function archive_files_blob(files, config, progress_callback, abort_signal) {
    const ptr0 = passArrayJsValueToWasm0(files, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    _assertClass(config, ArchiveConfig);
    var ptr1 = config.__destroy_into_raw();
    const ret = wasm.archive_files_blob(ptr0, len0, ptr1, isLikeNone(progress_callback) ? 0 : addToExternrefTable0(progress_callback), isLikeNone(abort_signal) ? 0 : addToExternrefTable0(abort_signal));
    return ret;
}

/**
 * @param {Blob} blob
 * @param {ArchiveConfig} config
 * @param {Function | null} [progress_callback]
 * @param {AbortSignal | null} [abort_signal]
 * @returns {Promise<ArchiveFile[]>}
 */
export function unarchive_files_blob(blob, config, progress_callback, abort_signal) {
    _assertClass(config, ArchiveConfig);
    var ptr0 = config.__destroy_into_raw();
    const ret = wasm.unarchive_files_blob(blob, ptr0, isLikeNone(progress_callback) ? 0 : addToExternrefTable0(progress_callback), isLikeNone(abort_signal) ? 0 : addToExternrefTable0(abort_signal));
    return ret;
}

/**
 * @param {ReadableStream} stream
 * @param {ArchiveConfig} config
 * @param {Function | null} [progress_callback]
 * @param {AbortSignal | null} [abort_signal]
 * @returns {Promise<Blob>}
 */
export function archive_stream(stream, config, progress_callback, abort_signal) {
    _assertClass(config, ArchiveConfig);
    var ptr0 = config.__destroy_into_raw();
    const ret = wasm.archive_stream(stream, ptr0, isLikeNone(progress_callback) ? 0 : addToExternrefTable0(progress_callback), isLikeNone(abort_signal) ? 0 : addToExternrefTable0(abort_signal));
    return ret;
}

/**
 * @param {ReadableStream} stream
 * @param {ArchiveConfig} config
 * @param {Function | null} [progress_callback]
 * @param {AbortSignal | null} [abort_signal]
 * @returns {Promise<ArchiveFile[]>}
 */
export function unarchive_stream(stream, config, progress_callback, abort_signal) {
    _assertClass(config, ArchiveConfig);
    var ptr0 = config.__destroy_into_raw();
    const ret = wasm.unarchive_stream(stream, ptr0, isLikeNone(progress_callback) ? 0 : addToExternrefTable0(progress_callback), isLikeNone(abort_signal) ? 0 : addToExternrefTable0(abort_signal));
    return ret;
}

export function init() {
    wasm.init();
}

function __wbg_adapter_38(arg0, arg1) {
    wasm._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h5e0611735a6afc93(arg0, arg1);
}

function __wbg_adapter_41(arg0, arg1, arg2) {
    wasm.closure162_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_164(arg0, arg1, arg2, arg3) {
    wasm.closure184_externref_shim(arg0, arg1, arg2, arg3);
}

/**
 * @enum {0 | 1}
 */
export const ArchiveFormat = Object.freeze({
    None: 0, "0": "None",
    Zip: 1, "1": "Zip",
});
/**
 * @enum {0 | 1 | 2 | 3 | 4}
 */
export const CompressionAlgorithm = Object.freeze({
    Gzip: 0, "0": "Gzip",
    Deflate: 1, "1": "Deflate",
    Zlib: 2, "2": "Zlib",
    Brotli: 3, "3": "Brotli",
    None: 4, "4": "None",
});
/**
 * @enum {0 | 1}
 */
export const EncryptionAlgorithm = Object.freeze({
    Aes256Gcm: 0, "0": "Aes256Gcm",
    Aes128Gcm: 1, "1": "Aes128Gcm",
});
/**
 * @enum {0 | 1}
 */
export const KdfAlgorithm = Object.freeze({
    Argon2: 0, "0": "Argon2",
    Pbkdf2: 1, "1": "Pbkdf2",
});

const ArchiveConfigFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_archiveconfig_free(ptr >>> 0, 1));

export class ArchiveConfig {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ArchiveConfig.prototype);
        obj.__wbg_ptr = ptr;
        ArchiveConfigFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ArchiveConfigFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_archiveconfig_free(ptr, 0);
    }
    /**
     * @returns {ArchiveConfigBuilder}
     */
    static builder() {
        const ret = wasm.archiveconfig_builder();
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @returns {number}
     */
    level() {
        const ret = wasm.archiveconfig_level(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {CompressionAlgorithm}
     */
    algorithm() {
        const ret = wasm.archiveconfig_algorithm(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    chunk_size() {
        const ret = wasm.archiveconfig_chunk_size(this.__wbg_ptr);
        return ret >>> 0;
    }
}

const ArchiveConfigBuilderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_archiveconfigbuilder_free(ptr >>> 0, 1));

export class ArchiveConfigBuilder {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ArchiveConfigBuilder.prototype);
        obj.__wbg_ptr = ptr;
        ArchiveConfigBuilderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ArchiveConfigBuilderFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_archiveconfigbuilder_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.archiveconfig_builder();
        this.__wbg_ptr = ret >>> 0;
        ArchiveConfigBuilderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} level
     * @returns {ArchiveConfigBuilder}
     */
    level(level) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_level(ptr, level);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {CompressionAlgorithm} algorithm
     * @returns {ArchiveConfigBuilder}
     */
    algorithm(algorithm) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_algorithm(ptr, algorithm);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {number} chunk_size
     * @returns {ArchiveConfigBuilder}
     */
    chunk_size(chunk_size) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_chunk_size(ptr, chunk_size);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {string | null} [comment]
     * @returns {ArchiveConfigBuilder}
     */
    comment(comment) {
        const ptr = this.__destroy_into_raw();
        var ptr0 = isLikeNone(comment) ? 0 : passStringToWasm0(comment, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.archiveconfigbuilder_comment(ptr, ptr0, len0);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {Uint8Array | null} [extra]
     * @returns {ArchiveConfigBuilder}
     */
    extra(extra) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_extra(ptr, isLikeNone(extra) ? 0 : addToExternrefTable0(extra));
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {number | null} [os_code]
     * @returns {ArchiveConfigBuilder}
     */
    os_code(os_code) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_os_code(ptr, isLikeNone(os_code) ? 0x100000001 : (os_code) >>> 0);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {Config | null} [config]
     * @returns {ArchiveConfigBuilder}
     */
    encryption_config(config) {
        const ptr = this.__destroy_into_raw();
        let ptr0 = 0;
        if (!isLikeNone(config)) {
            _assertClass(config, Config);
            ptr0 = config.__destroy_into_raw();
        }
        const ret = wasm.archiveconfigbuilder_encryption_config(ptr, ptr0);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {Uint8Array | null} [context]
     * @returns {ArchiveConfigBuilder}
     */
    encryption_context(context) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_encryption_context(ptr, isLikeNone(context) ? 0 : addToExternrefTable0(context));
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {Uint8Array | null} [aad]
     * @returns {ArchiveConfigBuilder}
     */
    encryption_aad(aad) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_encryption_aad(ptr, isLikeNone(aad) ? 0 : addToExternrefTable0(aad));
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {boolean} enable
     * @returns {ArchiveConfigBuilder}
     */
    checksum(enable) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_checksum(ptr, enable);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {number | null} [limit]
     * @returns {ArchiveConfigBuilder}
     */
    memory_limit(limit) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_memory_limit(ptr, isLikeNone(limit) ? 0x100000001 : (limit) >>> 0);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {string | null} [preset]
     * @returns {ArchiveConfigBuilder}
     */
    preset(preset) {
        const ptr = this.__destroy_into_raw();
        var ptr0 = isLikeNone(preset) ? 0 : passStringToWasm0(preset, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.archiveconfigbuilder_preset(ptr, ptr0, len0);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {Uint8Array | null} [dict]
     * @returns {ArchiveConfigBuilder}
     */
    dict(dict) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_dict(ptr, isLikeNone(dict) ? 0 : addToExternrefTable0(dict));
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @param {ArchiveFormat} format
     * @returns {ArchiveConfigBuilder}
     */
    archive_format(format) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_archive_format(ptr, format);
        return ArchiveConfigBuilder.__wrap(ret);
    }
    /**
     * @returns {ArchiveConfig}
     */
    build() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.archiveconfigbuilder_build(ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ArchiveConfig.__wrap(ret[0]);
    }
}

const ArchiveFileFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_archivefile_free(ptr >>> 0, 1));

export class ArchiveFile {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ArchiveFile.prototype);
        obj.__wbg_ptr = ptr;
        ArchiveFileFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    static __unwrap(jsValue) {
        if (!(jsValue instanceof ArchiveFile)) {
            return 0;
        }
        return jsValue.__destroy_into_raw();
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ArchiveFileFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_archivefile_free(ptr, 0);
    }
    /**
     * @param {string} name
     * @param {Uint8Array} data
     */
    constructor(name, data) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.archivefile_new(ptr0, len0, ptr1, len1);
        this.__wbg_ptr = ret >>> 0;
        ArchiveFileFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {string}
     */
    name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.archivefile_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {Uint8Array}
     */
    data() {
        const ret = wasm.archivefile_data(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @param {bigint | null} [mtime]
     */
    set_modified_time(mtime) {
        wasm.archivefile_set_modified_time(this.__wbg_ptr, !isLikeNone(mtime), isLikeNone(mtime) ? BigInt(0) : mtime);
    }
    /**
     * @param {number | null} [permissions]
     */
    set_permissions(permissions) {
        wasm.archivefile_set_permissions(this.__wbg_ptr, isLikeNone(permissions) ? 0x100000001 : (permissions) >>> 0);
    }
    /**
     * @returns {boolean}
     */
    verify_checksum() {
        const ret = wasm.archivefile_verify_checksum(this.__wbg_ptr);
        return ret !== 0;
    }
}

const BatchResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_batchresult_free(ptr >>> 0, 1));

export class BatchResult {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(BatchResult.prototype);
        obj.__wbg_ptr = ptr;
        BatchResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BatchResultFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_batchresult_free(ptr, 0);
    }
    /**
     * @param {Uint8Array[]} successes
     * @param {string[]} errors
     */
    constructor(successes, errors) {
        const ptr0 = passArrayJsValueToWasm0(successes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayJsValueToWasm0(errors, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.batchresult_new(ptr0, len0, ptr1, len1);
        this.__wbg_ptr = ret >>> 0;
        BatchResultFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {Uint8Array[]}
     */
    get successes() {
        const ret = wasm.batchresult_successes(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {string[]}
     */
    get errors() {
        const ret = wasm.batchresult_errors(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}

const ConfigFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_config_free(ptr >>> 0, 1));

export class Config {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ConfigFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_config_free(ptr, 0);
    }
    /**
     * @param {number} kdf_time_cost
     * @param {number} kdf_mem_cost
     * @param {number} kdf_parallelism
     * @param {EncryptionAlgorithm} algorithm
     * @param {KdfAlgorithm} kdf_algorithm
     * @param {number} key_version
     */
    constructor(kdf_time_cost, kdf_mem_cost, kdf_parallelism, algorithm, kdf_algorithm, key_version) {
        const ret = wasm.config_new(kdf_time_cost, kdf_mem_cost, kdf_parallelism, algorithm, kdf_algorithm, key_version);
        this.__wbg_ptr = ret >>> 0;
        ConfigFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}

const CryptoServiceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_cryptoservice_free(ptr >>> 0, 1));

export class CryptoService {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CryptoServiceFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cryptoservice_free(ptr, 0);
    }
    /**
     * @param {Uint8Array} master_key
     * @param {Config} config
     */
    constructor(master_key, config) {
        _assertClass(config, Config);
        const ret = wasm.cryptoservice_new(master_key, config.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        CryptoServiceFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Uint8Array} data
     * @param {Uint8Array} context
     * @param {Uint8Array | null} [aad]
     * @returns {Uint8Array}
     */
    encrypt(data, context, aad) {
        const ret = wasm.cryptoservice_encrypt(this.__wbg_ptr, data, context, isLikeNone(aad) ? 0 : addToExternrefTable0(aad));
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} ciphertext
     * @param {Uint8Array} context
     * @param {Uint8Array | null} [aad]
     * @returns {Uint8Array}
     */
    decrypt(ciphertext, context, aad) {
        const ret = wasm.cryptoservice_decrypt(this.__wbg_ptr, ciphertext, context, isLikeNone(aad) ? 0 : addToExternrefTable0(aad));
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {any[]} data_items
     * @param {Uint8Array} context
     * @param {Uint8Array | null} [aad]
     * @param {Function | null} [progress_callback]
     * @param {number | null} [max_memory_bytes]
     * @returns {BatchResult}
     */
    batch_encrypt(data_items, context, aad, progress_callback, max_memory_bytes) {
        const ptr0 = passArrayJsValueToWasm0(data_items, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.cryptoservice_batch_encrypt(this.__wbg_ptr, ptr0, len0, context, isLikeNone(aad) ? 0 : addToExternrefTable0(aad), isLikeNone(progress_callback) ? 0 : addToExternrefTable0(progress_callback), isLikeNone(max_memory_bytes) ? 0x100000001 : (max_memory_bytes) >>> 0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return BatchResult.__wrap(ret[0]);
    }
    /**
     * @param {any[]} ciphertexts
     * @param {Uint8Array} context
     * @param {Uint8Array | null} [aad]
     * @param {Function | null} [progress_callback]
     * @param {number | null} [max_memory_bytes]
     * @returns {BatchResult}
     */
    batch_decrypt(ciphertexts, context, aad, progress_callback, max_memory_bytes) {
        const ptr0 = passArrayJsValueToWasm0(ciphertexts, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.cryptoservice_batch_decrypt(this.__wbg_ptr, ptr0, len0, context, isLikeNone(aad) ? 0 : addToExternrefTable0(aad), isLikeNone(progress_callback) ? 0 : addToExternrefTable0(progress_callback), isLikeNone(max_memory_bytes) ? 0x100000001 : (max_memory_bytes) >>> 0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return BatchResult.__wrap(ret[0]);
    }
    /**
     * @returns {StreamState}
     */
    init_stream_encrypt() {
        const ret = wasm.cryptoservice_init_stream_encrypt(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return StreamState.__wrap(ret[0]);
    }
    /**
     * @param {StreamState} state
     * @param {Uint8Array} data
     * @param {Uint8Array} context
     * @param {Uint8Array | null | undefined} aad
     * @param {boolean} is_final
     * @param {Function | null} [progress_callback]
     * @returns {Uint8Array}
     */
    stream_encrypt_chunk(state, data, context, aad, is_final, progress_callback) {
        _assertClass(state, StreamState);
        const ret = wasm.cryptoservice_stream_encrypt_chunk(this.__wbg_ptr, state.__wbg_ptr, data, context, isLikeNone(aad) ? 0 : addToExternrefTable0(aad), is_final, isLikeNone(progress_callback) ? 0 : addToExternrefTable0(progress_callback));
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {number} input_size
     * @returns {number}
     */
    estimate_encrypted_size(input_size) {
        const ret = wasm.cryptoservice_estimate_encrypted_size(this.__wbg_ptr, input_size);
        return ret >>> 0;
    }
}

const SecureBytesFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_securebytes_free(ptr >>> 0, 1));

export class SecureBytes {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(SecureBytes.prototype);
        obj.__wbg_ptr = ptr;
        SecureBytesFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SecureBytesFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_securebytes_free(ptr, 0);
    }
    /**
     * @param {Uint8Array} data
     */
    constructor(data) {
        const ret = wasm.securebytes_new(data);
        this.__wbg_ptr = ret >>> 0;
        SecureBytesFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} len
     * @returns {SecureBytes}
     */
    static random(len) {
        const ret = wasm.securebytes_random(len);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return SecureBytes.__wrap(ret[0]);
    }
    /**
     * @returns {Uint8Array}
     */
    get data() {
        const ret = wasm.securebytes_data(this.__wbg_ptr);
        return ret;
    }
}

const StreamArchiverFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_streamarchiver_free(ptr >>> 0, 1));

export class StreamArchiver {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StreamArchiverFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_streamarchiver_free(ptr, 0);
    }
    /**
     * @param {ArchiveConfig} config
     */
    constructor(config) {
        _assertClass(config, ArchiveConfig);
        var ptr0 = config.__destroy_into_raw();
        const ret = wasm.streamarchiver_new(ptr0);
        this.__wbg_ptr = ret >>> 0;
        StreamArchiverFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Function} callback
     */
    set_progress_callback(callback) {
        wasm.streamarchiver_set_progress_callback(this.__wbg_ptr, callback);
    }
    /**
     * @param {AbortSignal} signal
     */
    set_abort_signal(signal) {
        wasm.streamarchiver_set_abort_signal(this.__wbg_ptr, signal);
    }
    /**
     * @param {SecureBytes} key
     */
    set_master_key(key) {
        _assertClass(key, SecureBytes);
        var ptr0 = key.__destroy_into_raw();
        wasm.streamarchiver_set_master_key(this.__wbg_ptr, ptr0);
    }
    /**
     * @param {Function} callback
     */
    set_metrics_callback(callback) {
        wasm.streamarchiver_set_metrics_callback(this.__wbg_ptr, callback);
    }
    /**
     * @param {ArchiveFile[]} files
     * @returns {Promise<Uint8Array>}
     */
    archive_files(files) {
        const ptr0 = passArrayJsValueToWasm0(files, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.streamarchiver_archive_files(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * @param {Uint8Array} data
     * @returns {Promise<ArchiveFile[]>}
     */
    unarchive_files(data) {
        const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.streamarchiver_unarchive_files(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    /**
     * @param {ReadableStream} stream
     * @returns {Promise<Uint8Array>}
     */
    archive_stream(stream) {
        const ret = wasm.streamarchiver_archive_stream(this.__wbg_ptr, stream);
        return ret;
    }
    /**
     * @param {ReadableStream} stream
     * @returns {Promise<ArchiveFile[]>}
     */
    unarchive_stream(stream) {
        const ret = wasm.streamarchiver_unarchive_stream(this.__wbg_ptr, stream);
        return ret;
    }
}

const StreamStateFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_streamstate_free(ptr >>> 0, 1));

export class StreamState {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StreamState.prototype);
        obj.__wbg_ptr = ptr;
        StreamStateFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StreamStateFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_streamstate_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get processed_bytes() {
        const ret = wasm.streamstate_processed_bytes(this.__wbg_ptr);
        return ret;
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_archivefile_new = function(arg0) {
        const ret = ArchiveFile.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_archivefile_unwrap = function(arg0) {
        const ret = ArchiveFile.__unwrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_arrayBuffer_f18c144cd0125f07 = function(arg0) {
        const ret = arg0.arrayBuffer();
        return ret;
    };
    imports.wbg.__wbg_buffer_609cc3eee51ed158 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_call_7cccdd69e0791ae2 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_crypto_574e78ad8b13b65f = function(arg0) {
        const ret = arg0.crypto;
        return ret;
    };
    imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_getRandomValues_b8f5dbd5f3995a9e = function() { return handleError(function (arg0, arg1) {
        arg0.getRandomValues(arg1);
    }, arguments) };
    imports.wbg.__wbg_getReader_be0d36e5873a525b = function(arg0) {
        const ret = arg0.getReader();
        return ret;
    };
    imports.wbg.__wbg_getTime_46267b1c24877e30 = function(arg0) {
        const ret = arg0.getTime();
        return ret;
    };
    imports.wbg.__wbg_get_67b2ba62fc30de12 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_instanceof_Uint8Array_17156bcf118086a9 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Uint8Array;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_length_a446193dc22c12f8 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_msCrypto_a61aeb35a24c1329 = function(arg0) {
        const ret = arg0.msCrypto;
        return ret;
    };
    imports.wbg.__wbg_new_23a2665fac83c611 = function(arg0, arg1) {
        try {
            var state0 = {a: arg0, b: arg1};
            var cb0 = (arg0, arg1) => {
                const a = state0.a;
                state0.a = 0;
                try {
                    return __wbg_adapter_164(a, state0.b, arg0, arg1);
                } finally {
                    state0.a = a;
                }
            };
            const ret = new Promise(cb0);
            return ret;
        } finally {
            state0.a = state0.b = 0;
        }
    };
    imports.wbg.__wbg_new_405e22f390576ce2 = function() {
        const ret = new Object();
        return ret;
    };
    imports.wbg.__wbg_new_78feb108b6472713 = function() {
        const ret = new Array();
        return ret;
    };
    imports.wbg.__wbg_new_8a6f238a6ece86ea = function() {
        const ret = new Error();
        return ret;
    };
    imports.wbg.__wbg_new_a12002a7f91c75be = function(arg0) {
        const ret = new Uint8Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_newnoargs_105ed471475aaf50 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_newwithbuffersourcesequenceandoptions_3ee2a062716a9a0a = function() { return handleError(function (arg0, arg1) {
        const ret = new Blob(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newwithbyteoffsetandlength_d97e637ebe145a9a = function(arg0, arg1, arg2) {
        const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithlength_a381634e90c276d4 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithyearmonthdayhrminsec_72c204d952ef4426 = function(arg0, arg1, arg2, arg3, arg4, arg5) {
        const ret = new Date(arg0 >>> 0, arg1, arg2, arg3, arg4, arg5);
        return ret;
    };
    imports.wbg.__wbg_node_905d3e251edff8a2 = function(arg0) {
        const ret = arg0.node;
        return ret;
    };
    imports.wbg.__wbg_now_807e54c39636c349 = function() {
        const ret = Date.now();
        return ret;
    };
    imports.wbg.__wbg_process_dc0fbacc7c1c06f7 = function(arg0) {
        const ret = arg0.process;
        return ret;
    };
    imports.wbg.__wbg_push_737cfc8c1432c2c6 = function(arg0, arg1) {
        const ret = arg0.push(arg1);
        return ret;
    };
    imports.wbg.__wbg_queueMicrotask_97d92b4fcc8a61c5 = function(arg0) {
        queueMicrotask(arg0);
    };
    imports.wbg.__wbg_queueMicrotask_d3219def82552485 = function(arg0) {
        const ret = arg0.queueMicrotask;
        return ret;
    };
    imports.wbg.__wbg_randomFillSync_ac0988aba3254290 = function() { return handleError(function (arg0, arg1) {
        arg0.randomFillSync(arg1);
    }, arguments) };
    imports.wbg.__wbg_read_a2434af1186cb56c = function(arg0) {
        const ret = arg0.read();
        return ret;
    };
    imports.wbg.__wbg_require_60cc747a6bc5215a = function() { return handleError(function () {
        const ret = module.require;
        return ret;
    }, arguments) };
    imports.wbg.__wbg_resolve_4851785c9c5f573d = function(arg0) {
        const ret = Promise.resolve(arg0);
        return ret;
    };
    imports.wbg.__wbg_set_65595bdd868b3009 = function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
    };
    imports.wbg.__wbg_set_bb8cecf6a62b9f46 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_setonabort_a12865ed9905809a = function(arg0, arg1) {
        arg0.onabort = arg1;
    };
    imports.wbg.__wbg_settype_39ed370d3edd403c = function(arg0, arg1, arg2) {
        arg0.type = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
        const ret = arg1.stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function() {
        const ret = typeof global === 'undefined' ? null : global;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function() {
        const ret = typeof globalThis === 'undefined' ? null : globalThis;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function() {
        const ret = typeof self === 'undefined' ? null : self;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function() {
        const ret = typeof window === 'undefined' ? null : window;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_subarray_aa9065fa9dc5df96 = function(arg0, arg1, arg2) {
        const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_then_44b73946d2fb3e7d = function(arg0, arg1) {
        const ret = arg0.then(arg1);
        return ret;
    };
    imports.wbg.__wbg_then_48b406749878a531 = function(arg0, arg1, arg2) {
        const ret = arg0.then(arg1, arg2);
        return ret;
    };
    imports.wbg.__wbg_versions_c01dfd4722a88165 = function(arg0) {
        const ret = arg0.versions;
        return ret;
    };
    imports.wbg.__wbindgen_array_new = function() {
        const ret = [];
        return ret;
    };
    imports.wbg.__wbindgen_array_push = function(arg0, arg1) {
        arg0.push(arg1);
    };
    imports.wbg.__wbindgen_boolean_get = function(arg0) {
        const v = arg0;
        const ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
        return ret;
    };
    imports.wbg.__wbindgen_cb_drop = function(arg0) {
        const obj = arg0.original;
        if (obj.cnt-- == 1) {
            obj.a = 0;
            return true;
        }
        const ret = false;
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper1071 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 163, __wbg_adapter_41);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper87 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 3, __wbg_adapter_38);
        return ret;
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_2;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = arg0;
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return ret;
    };
    imports.wbg.__wbindgen_number_new = function(arg0) {
        const ret = arg0;
        return ret;
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_uint8_array_new = function(arg0, arg1) {
        var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
        wasm.__wbindgen_free(arg0, arg1 * 1, 1);
        const ret = v0;
        return ret;
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('archive_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
