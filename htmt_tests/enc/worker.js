async function loadDexie() {
    await import("./dexie.min.js");
}

// Load Dexie.js
self.importScripts('./dexie.min.js'); // Adjust path as needed

class CryptoWorker {
    constructor() {
        this.cryptoService = null;
        this.db = null;
        this.dbInitialized = false;
        this.pendingOperations = [];
        this.initDB().catch(error => {
            console.error('Failed to initialize DB:', error);
            this.broadcastError('DB initialization failed');
        });
        this.initEventListeners();
    }
    
    async initDB() {
        try {
            this.db = new Dexie('SecureFileManagerDB');
            this.db.version(1).stores({
                files: 'id',
                metadata: 'key'
            });
            
            await this.db.open();
            this.dbInitialized = true;
            this.processPendingOperations();
        } catch (error) {
            console.error('Dexie DB initialization failed:', error);
            throw new Error('DB initialization failed');
        }
    }
    
    processPendingOperations() {
        while (this.pendingOperations.length > 0) {
            const operation = this.pendingOperations.shift();
            this.handleMessage(operation.event, operation.id);
        }
    }
    
    initEventListeners() {
        self.addEventListener('message', (event) => {
            if (!this.dbInitialized) {
                this.pendingOperations.push({ event, id: event.data.id });
                return;
            }
            this.handleMessage(event, event.data.id);
        });
    }
    
    async handleMessage(event, id) {
        const { type, data } = event.data;
        
        try {
            switch (type) {
                case 'init':
                    await this.initService(data.masterKey, data.config);
                    self.postMessage({ type: 'init-success', id });
                    break;
                case 'encrypt':
                    await this.handleEncrypt(data, id);
                    break;
                case 'decrypt':
                    await this.handleDecrypt(data, id);
                    break;
                case 'save-file':
                    await this.saveFile(data.file, data.metadata);
                    self.postMessage({ type: 'save-success', id });
                    break;
                case 'get-file':
                    const file = await this.getFile(data.id);
                    self.postMessage({ type: 'file-data', data: file, id });
                    break;
                case 'list-files':
                    const files = await this.listFiles();
                    self.postMessage({ type: 'file-list', data: files, id });
                    break;
                case 'delete-file':
                    await this.deleteFile(data.id);
                    self.postMessage({ type: 'delete-success', id });
                    break;
                default:
                    self.postMessage({ type: 'error', error: 'Unknown command', id });
            }
        } catch (error) {
            console.error(`Worker error (${type}):`, error);
            self.postMessage({
                type: 'error',
                error: error.message || 'Operation failed',
                id
            });
        }
    }
    
    broadcastError(message) {
        self.postMessage({
            type: 'error',
            error: message,
            id: 'broadcast'
        });
    }
    
    async initService(masterKey, config) {
        try {
            // Dynamically import the WebAssembly module
            const wasmModule = await import('../../enc/pkg/enc.js');
            console.log('WASM module loaded:', Object.keys(wasmModule));
            
            // Initialize the WebAssembly module if required
            if (typeof wasmModule.default === 'function') {
                await wasmModule.default(); // Ensure WASM is initialized
            }
            
            const { CryptoService, Config, EncryptionAlgorithm, KdfAlgorithm } = wasmModule;
            
            // Verify exports
            if (!CryptoService || typeof CryptoService.new !== 'function') {
                throw new Error('CryptoService.new is not available');
            }
            if (!Config || typeof Config.new !== 'function') {
                throw new Error('Config.new is not available');
            }
            
            const algoMap = {
                'AES-256-GCM': EncryptionAlgorithm.Aes256Gcm,
                'AES-128-GCM': EncryptionAlgorithm.Aes128Gcm
            };
            
            const kdfMap = {
                'argon2': KdfAlgorithm.Argon2,
                'pbkdf2': KdfAlgorithm.Pbkdf2
            };
            
            // Create Config instance
            const wasmConfig = new Config(
                config.kdfTimeCost,
                config.kdfMemCost,
                config.kdfParallelism,
                algoMap[config.algorithm],
                kdfMap[config.kdfAlgorithm],
                config.keyVersion
            );
            
            // Initialize CryptoService
            this.cryptoService = await CryptoService.new(masterKey, wasmConfig);
            console.log('CryptoService initialized successfully');
        } catch (error) {
            console.error('Service initialization failed:', error);
            throw new Error('Failed to initialize crypto service');
        }
    }
    
    async handleEncrypt({ data, context, aad, store, metadata }, id) {
        if (!this.cryptoService) {
            throw new Error('Service not initialized');
        }
        
        const progressCallback = (progress) => {
            self.postMessage({ type: 'progress', progress, id });
        };
        
        const result = await this.cryptoService.encrypt(data, context, aad, progressCallback);
        
        if (store) {
            await this.saveFile({
                id: crypto.randomUUID(),
                data: result,
                metadata
            });
        }
        
        self.postMessage({ type: 'encrypt-success', data: result, id });
    }
    
    async handleDecrypt({ data, context, aad }, id) {
        if (!this.cryptoService) {
            throw new Error('Service not initialized');
        }
        
        const progressCallback = (progress) => {
            self.postMessage({ type: 'progress', progress, id });
        };
        
        const result = await this.cryptoService.decrypt(data, context, aad, progressCallback);
        self.postMessage({ type: 'decrypt-success', data: result, id });
    }
    
    async saveFile(file, metadata) {
        if (!this.dbInitialized) {
            throw new Error('DB not initialized');
        }
        
        try {
            await this.db.transaction('rw', this.db.files, this.db.metadata, async () => {
                await this.db.files.put(file);
                await this.db.metadata.put({ key: file.id, ...metadata });
            });
        } catch (error) {
            console.error('Save file error:', error);
            throw new Error('Failed to save file');
        }
    }
    
    async getFile(id) {
        if (!this.dbInitialized) {
            throw new Error('DB not initialized');
        }
        
        try {
            const [fileData, metaData] = await this.db.transaction('r', this.db.files, this.db.metadata, async () => {
                const file = await this.db.files.get(id);
                const meta = await this.db.metadata.get(id);
                return [file, meta];
            });
            return this.combineFileData(fileData, metaData);
        } catch (error) {
            console.error('Get file error:', error);
            throw new Error('Failed to retrieve file');
        }
    }
    
    combineFileData(fileData, metaData) {
        if (!fileData) return null;
        return {
            ...fileData,
            metadata: metaData || {}
        };
    }
    
    async listFiles() {
        if (!this.dbInitialized) {
            throw new Error('DB not initialized');
        }
        
        try {
            const [files, metas] = await this.db.transaction('r', this.db.files, this.db.metadata, async () => {
                const filesResult = await this.db.files.toArray();
                const metasResult = await this.db.metadata.toArray();
                return [filesResult, metasResult];
            });
            return this.combineFileLists(files, metas);
        } catch (error) {
            console.error('List files error:', error);
            throw new Error('Failed to list files');
        }
    }
    
    combineFileLists(files, metas) {
        if (!files || !metas) {
            return [];
        }
        const metaMap = new Map(metas.map(m => [m.key, m]));
        return files.map(file => ({
            ...file,
            metadata: metaMap.get(file.id) || {}
        }));
    }
    
    async deleteFile(id) {
        if (!this.dbInitialized) {
            throw new Error('DB not initialized');
        }
        
        try {
            await this.db.transaction('rw', this.db.files, this.db.metadata, async () => {
                await this.db.files.delete(id);
                await this.db.metadata.delete(id);
            });
        } catch (error) {
            console.error('Delete file error:', error);
            throw new Error('Failed to delete file');
        }
    }
}

const worker = new CryptoWorker();