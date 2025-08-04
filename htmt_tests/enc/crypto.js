class FileManager {
    constructor() {
        this.worker = new Worker("./worker.js");
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
        this.callbacks = new Map();
        this.initUI();
    }

    initUI() {
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.sidebar = document.getElementById('sidebar');
        this.mainContent = document.getElementById('main-content');
        this.fileList = document.getElementById('file-list');
        this.filePreview = document.getElementById('file-preview');
        this.uploadForm = document.getElementById('upload-form');
        this.progressBar = document.getElementById('progress-bar');
        this.statusText = document.getElementById('status-text');
        
        this.sidebarToggle.addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
            this.mainContent.classList.toggle('expanded');
        });
        
        this.uploadForm.addEventListener('submit', (e) => this.handleUpload(e));
        
        this.loadFiles();
    }

    handleWorkerMessage(event) {
        const { type, data, progress, error, id } = event.data;
        
        if (type === 'error') {
            console.error('Worker error:', error);
            this.updateStatus(`Error: ${error}`, 'error');
            return;
        }
        
        if (type === 'progress') {
            this.updateProgress(progress);
            return;
        }
        
        const callback = this.callbacks.get(id);
        if (callback) {
            callback.resolve({ type, data });
            this.callbacks.delete(id);
        }
        
        switch (type) {
            case 'init-success':
                this.updateStatus('Service initialized', 'success');
                break;
            case 'encrypt-success':
                case 'decrypt-success':
                this.updateStatus(`${type.replace('-success', '')}ion complete`, 'success');
                break;
            case 'file-list':
                this.renderFileList(data);
                break;
            case 'file-data':
                this.renderFilePreview(data);
                break;
        }
    }

    sendCommand(type, data) {
        const id = crypto.randomUUID();
        
        return new Promise((resolve) => {
            this.callbacks.set(id, { resolve });
            this.worker.postMessage({ type, data, id });
        });
    }

    async initService(masterKey, config) {
        this.updateStatus('Initializing crypto service...');
        return this.sendCommand('init', { masterKey, config });
    }

    async encryptFile(file, context, store = true) {
        this.updateStatus('Encrypting file...');
        
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const metadata = {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
        };
        
        return this.sendCommand('encrypt', {
            data,
            context: new TextEncoder().encode('file-encryption'),
            aad: new TextEncoder().encode(file.name),
            store,
            metadata
        });
    }

    async decryptFile(fileId) {
        this.updateStatus('Decrypting file...');
        const fileData = await this.sendCommand('get-file', { id: fileId });
        
        if (!fileData.data) {
            throw new Error('File not found');
        }
        
        const result = await this.sendCommand('decrypt', {
            data: fileData.data.data,
            context: new TextEncoder().encode('file-encryption'),
            aad: new TextEncoder().encode(fileData.data.metadata.name)
        });
        
        return new Blob([result.data], { type: fileData.data.metadata.type });
    }

    async loadFiles() {
    this.updateStatus('Loading files...');
    try {
        const result = await this.sendCommand('list-files', {});
        return result.data;
    } catch (error) {
        console.error('Failed to load files:', error);
        this.updateStatus(`Failed to load files: ${error.message}`, 'error');
        return [];
    }
}

    async deleteFile(fileId) {
        this.updateStatus('Deleting file...');
        await this.sendCommand('delete-file', { id: fileId });
        this.loadFiles();
    }

    async handleUpload(event) {
        event.preventDefault();
        const fileInput = document.getElementById('file-input');
        
        if (!fileInput.files.length) return;
        
        const file = fileInput.files[0];
        this.updateStatus(`Uploading ${file.name}...`);
        
        try {
            await this.encryptFile(file);
            await this.loadFiles();
            fileInput.value = '';
        } catch (error) {
            console.error('Upload failed:', error);
            this.updateStatus(`Upload failed: ${error.message}`, 'error');
        }
    }

    renderFileList(files) {
        this.fileList.innerHTML = '';
        
        if (!files.length) {
            this.fileList.innerHTML = '<div class="empty-state">No files found</div>';
            return;
        }
        
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-icon">${this.getFileIcon(file.metadata.type)}</div>
                <div class="file-info">
                    <div class="file-name">${file.metadata.name}</div>
                    <div class="file-meta">
                        <span>${this.formatSize(file.metadata.size)}</span>
                        <span>${new Date(file.metadata.lastModified).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="download-btn" data-id="${file.id}">↓</button>
                    <button class="delete-btn" data-id="${file.id}">×</button>
                </div>
            `;
            
            item.querySelector('.download-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.downloadFile(file.id);
            });
            
            item.querySelector('.delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteFile(file.id);
            });
            
            item.addEventListener('click', () => {
                this.previewFile(file.id);
            });
            
            this.fileList.appendChild(item);
        });
    }

    async previewFile(fileId) {
        const fileData = await this.sendCommand('get-file', { id: fileId });
        this.renderFilePreview(fileData.data);
    }

    renderFilePreview(file) {
        if (!file) {
            this.filePreview.innerHTML = '<div class="empty-state">Select a file to preview</div>';
            return;
        }
        
        this.filePreview.innerHTML = `
            <div class="file-header">
                <div class="file-icon large">${this.getFileIcon(file.metadata.type)}</div>
                <div class="file-title">${file.metadata.name}</div>
            </div>
            <div class="file-details">
                <div><strong>Type:</strong> ${file.metadata.type || 'Unknown'}</div>
                <div><strong>Size:</strong> ${this.formatSize(file.metadata.size)}</div>
                <div><strong>Modified:</strong> ${new Date(file.metadata.lastModified).toLocaleString()}</div>
            </div>
            <div class="file-actions">
                <button class="download-btn full" data-id="${file.id}">Download</button>
                <button class="delete-btn full" data-id="${file.id}">Delete</button>
            </div>
        `;
        
        this.filePreview.querySelector('.download-btn').addEventListener('click', async () => {
            await this.downloadFile(file.id);
        });
        
        this.filePreview.querySelector('.delete-btn').addEventListener('click', async () => {
            await this.deleteFile(file.id);
            this.filePreview.innerHTML = '<div class="empty-state">Select a file to preview</div>';
        });
    }

    async downloadFile(fileId) {
        this.updateStatus('Preparing download...');
        
        try {
            const blob = await this.decryptFile(fileId);
            const fileData = await this.sendCommand('get-file', { id: fileId });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileData.data.metadata.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.updateStatus('Download complete', 'success');
        } catch (error) {
            console.error('Download failed:', error);
            this.updateStatus(`Download failed: ${error.message}`, 'error');
        }
    }

    updateStatus(message, type = 'info') {
        this.statusText.textContent = message;
        this.statusText.className = `status-${type}`;
    }

    updateProgress(percent) {
        this.progressBar.style.width = `${percent}%`;
        this.progressBar.textContent = `${Math.round(percent)}%`;
    }

    getFileIcon(mimeType) {
        const type = mimeType ? mimeType.split('/')[0] : 'unknown';
        const icons = {
            image: '🖼️',
            audio: '🎵',
            video: '🎬',
            text: '📄',
            application: '📁',
            unknown: '📁'
        };
        return icons[type] || icons.unknown;
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const fileManager = new FileManager();
    
    const initButton = document.getElementById('init-btn');
    if (initButton) {
        initButton.addEventListener('click', async () => {
            const password = document.getElementById('password').value;
            if (!password) return;
            
            const encoder = new TextEncoder();
            const masterKey = encoder.encode(password);
            
            const config = {
                algorithm: 'AES-256-GCM',
                kdfAlgorithm: 'argon2',
                kdfTimeCost: 3,
                kdfMemCost: 65536,
                kdfParallelism: 4,
                keyVersion: 1
            };
            
            await fileManager.initService(masterKey, config);
        });
    }
    
    window.fileManager = fileManager;
});