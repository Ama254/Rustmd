class FileManager {
    constructor() {
        this.worker = new Worker('ky.js');
        this.currentPath = '';
        this.files = [];
        this.folders = [];
        this.selectedItems = new Set();
        this.viewMode = 'grid';
        this.sortBy = 'name';
        this.sortOrder = 'asc';
        this.searchQuery = '';
        this.isDragging = false;
        this.activePage = 'homePage';
        this.keyId = null;
        this.userId = 'user1'; // Placeholder; should be set via auth system
        this.uploadStartTime = null;
        this.initElements();
        this.initEventListeners();
        this.initCrypto();
    }

    initElements() {
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarOverlay = document.getElementById('sidebarOverlay');
        this.searchToggle = document.getElementById('searchToggle');
        this.searchInput = document.getElementById('searchInput');
        this.viewToggle = document.getElementById('viewToggle');
        this.sortToggle = document.getElementById('sortToggle');
        this.selectItems = document.getElementById('selectItems');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.newFolderBtn = document.getElementById('newFolderBtn');
        this.uploadEmptyBtn = document.getElementById('uploadEmptyBtn');
        this.breadcrumbs = document.getElementById('breadcrumbs');
        this.fileContainer = document.getElementById('fileContainer');
        this.emptyState = document.getElementById('emptyState');
        this.fileGrid = document.getElementById('fileGrid');
        this.progressModal = document.getElementById('progressModal');
        this.cancelUpload = document.getElementById('cancelUpload');
        this.progressFileName = document.getElementById('progressFileName');
        this.progressSize = document.getElementById('progressSize');
        this.progressSpeed = document.getElementById('progressSpeed');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressBar = document.getElementById('progressBar');
        this.progressBar2 = document.getElementById('progressBar2');
        this.progressTimeElapsed = document.getElementById('progressTimeElapsed');
        this.progressTimeRemaining = document.getElementById('progressTimeRemaining');
        this.contextMenu = document.getElementById('contextMenu');
        this.renameModal = document.getElementById('renameModal');
        this.renameInput = document.getElementById('renameInput');
        this.cancelRename = document.getElementById('cancelRename');
        this.confirmRename = document.getElementById('confirmRename');
        this.moveModal = document.getElementById('moveModal');
        this.moveInput = document.getElementById('moveInput');
        this.cancelMove = document.getElementById('cancelMove');
        this.confirmMove = document.getElementById('confirmMove');
        this.copyModal = document.getElementById('copyModal');
        this.copyInput = document.getElementById('copyInput');
        this.cancelCopy = document.getElementById('cancelCopy');
        this.confirmCopy = document.getElementById('confirmCopy');
        this.tagModal = document.getElementById('tagModal');
        this.tagInput = document.getElementById('tagInput');
        this.cancelTag = document.getElementById('cancelTag');
        this.confirmTag = document.getElementById('confirmTag');
        this.fileInput = document.getElementById('fileInput');
        this.storageUsed = document.getElementById('storageUsed');
        this.storagePercent = document.getElementById('storagePercent');
        this.storageBar = document.getElementById('storageBar');
        this.pages = {
            homePage: document.getElementById('homePage'),
            favoritesPage: document.getElementById('favoritesPage'),
            recentPage: document.getElementById('recentPage'),
            trashPage: document.getElementById('trashPage'),
            backupsPage: document.getElementById('backupsPage')
        };
        this.navItems = document.querySelectorAll('.nav-item');
        this.filterDropdowns = document.querySelectorAll('.filter-dropdown');
    }

    initEventListeners() {
        this.worker.onmessage = ({ data }) => this.handleWorkerMessage(data);
        this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        this.sidebarOverlay.addEventListener('click', () => this.toggleSidebar());
        this.searchToggle.addEventListener('click', () => this.toggleSearch());
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.viewToggle.addEventListener('click', () => this.toggleViewMode());
        this.sortToggle.addEventListener('click', () => this.toggleSort());
        this.selectItems.addEventListener('click', () => this.toggleSelectMode());
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.newFolderBtn.addEventListener('click', () => this.createNewFolder());
        this.uploadEmptyBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));
        this.cancelUpload.addEventListener('click', () => this.cancelOperation());
        this.cancelRename.addEventListener('click', () => this.closeRenameModal());
        this.confirmRename.addEventListener('click', () => this.handleRename());
        this.cancelMove.addEventListener('click', () => this.closeMoveModal());
        this.confirmMove.addEventListener('click', () => this.handleMove());
        this.cancelCopy.addEventListener('click', () => this.closeCopyModal());
        this.confirmCopy.addEventListener('click', () => this.handleCopy());
        this.cancelTag.addEventListener('click', () => this.closeTagModal());
        this.confirmTag.addEventListener('click', () => this.handleAddTag());
        this.fileContainer.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.fileContainer.addEventListener('dragleave', () => this.handleDragLeave());
        this.fileContainer.addEventListener('drop', (e) => this.handleDrop(e));
        this.fileContainer.addEventListener('contextmenu', (e) => this.showContextMenu(e));
        document.addEventListener('click', () => this.hideContextMenu());
        this.navItems.forEach(item => item.addEventListener('click', () => this.switchPage(item.dataset.page)));
        this.filterDropdowns.forEach(dropdown => {
            const content = dropdown.querySelector('.filter-dropdown-content');
            if (content) {
                const buttons = content.querySelectorAll('button');
                buttons.forEach(button => button.addEventListener('click', () => this.handleFilter(button.textContent)));
            }
        });
    }

    async initCrypto() {
        const masterKey = new Uint8Array(32); // Placeholder; should be securely generated
        const config = {
            kdfTimeCost: 3,
            kdfMemCost: 65536,
            kdfParallelism: 4,
            algorithm: 'Aes256Gcm',
            kdfAlgorithm: 'Argon2',
            keyVersion: 1
        };
        this.worker.postMessage({ type: 'INIT_CRYPTO', payload: { masterKey, config } });
    }

    handleWorkerMessage({ type, payload }) {
        switch (type) {
            case 'INIT_CRYPTO_SUCCESS':
                this.keyId = payload.keyId;
                this.loadFiles();
                break;
            case 'FETCH_FILES_SUCCESS':
                this.files = payload;
                this.loadFolders();
                break;
            case 'FETCH_FOLDERS_SUCCESS':
                this.folders = payload;
                this.renderFiles();
                this.updateStorage();
                break;
            case 'UPLOAD_FILES_SUCCESS':
            case 'CREATE_FOLDER_SUCCESS':
            case 'RENAME_FILE_SUCCESS':
            case 'RENAME_FOLDER_SUCCESS':
            case 'MOVE_FILE_SUCCESS':
            case 'MOVE_FOLDER_SUCCESS':
            case 'COPY_FILE_SUCCESS':
            case 'COPY_FOLDER_SUCCESS':
            case 'ADD_TAG_SUCCESS':
            case 'REMOVE_TAG_SUCCESS':
            case 'DELETE_FILE_SUCCESS':
            case 'DELETE_FOLDER_SUCCESS':
            case 'ENCRYPT_FILE_SUCCESS':
            case 'DECRYPT_FILE_SUCCESS':
            case 'ENCRYPT_FOLDER_SUCCESS':
            case 'DECRYPT_FOLDER_SUCCESS':
                this.files = payload.isFolder ? this.files : payload;
                this.folders = payload.isFolder ? payload : this.folders;
                this.renderFiles();
                this.updateStorage();
                break;
            case 'DOWNLOAD_FILE_SUCCESS':
                this.handleDownloadSuccess(payload);
                break;
            case 'SHARE_FILE_SUCCESS':
                this.handleShareSuccess(payload);
                break;
            case 'ADD_TO_FAVORITES_SUCCESS':
            case 'REMOVE_FROM_FAVORITES_SUCCESS':
                this.files = payload.isFolder ? this.files : payload;
                this.folders = payload.isFolder ? payload : this.folders;
                this.renderFiles();
                break;
            case 'CLEAR_RECENT_SUCCESS':
                this.files = payload.files;
                this.folders = payload.folders;
                this.renderFiles();
                break;
            case 'RESTORE_FILES_SUCCESS':
            case 'RESTORE_FOLDERS_SUCCESS':
            case 'EMPTY_TRASH_SUCCESS':
                this.files = payload.files || payload;
                this.folders = payload.folders || this.folders;
                this.renderFiles();
                break;
            case 'CREATE_BACKUP_SUCCESS':
            case 'RESTORE_BACKUP_SUCCESS':
                this.files = payload;
                this.renderFiles();
                break;
            case 'GET_FILE_VERSIONS_SUCCESS':
                this.showFileVersions(payload);
                break;
            case 'RESTORE_FILE_VERSION_SUCCESS':
                this.files = payload;
                this.renderFiles();
                break;
            case 'GET_ACCESS_LOGS_SUCCESS':
                this.showAccessLogs(payload);
                break;
            case 'BATCH_OPERATE_SUCCESS':
                this.handleBatchOperateSuccess(payload);
                break;
            case 'ROTATE_KEY_SUCCESS':
                this.keyId = payload.newKeyId;
                this.loadFiles();
                break;
            case 'CHECK_ACCESS_SUCCESS':
                this.handleAccessCheck(payload);
                break;
            case 'UPLOAD_PROGRESS':
            case 'STREAM_UPLOAD_PROGRESS':
                this.updateProgress(payload);
                break;
            case 'ENCRYPT_FOLDER_PROGRESS':
            case 'DECRYPT_FOLDER_PROGRESS':
            case 'BACKUP_PROGRESS':
            case 'KEY_ROTATION_PROGRESS':
                this.updateOperationProgress(payload);
                break;
            case 'ERROR':
                this.showError(payload);
                break;
        }
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('active');
        this.sidebarOverlay.classList.toggle('hidden');
    }

    toggleSearch() {
        this.searchInput.classList.toggle('hidden');
        if (!this.searchInput.classList.contains('hidden')) {
            this.searchInput.focus();
        } else {
            this.searchInput.value = '';
            this.handleSearch('');
        }
    }

    toggleViewMode() {
        this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
        this.viewToggle.querySelector('i').classList.toggle('bx-grid-alt');
        this.viewToggle.querySelector('i').classList.toggle('bx-list-ul');
        this.renderFiles();
    }

    toggleSort() {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        this.sortToggle.querySelector('i').classList.toggle('bx-sort-up');
        this.sortToggle.querySelector('i').classList.toggle('bx-sort-down');
        this.renderFiles();
    }

    toggleSelectMode() {
        this.selectedItems.clear();
        this.renderFiles();
    }

    switchPage(pageId) {
        Object.values(this.pages).forEach(page => page.classList.remove('active'));
        this.pages[pageId].classList.add('active');
        this.navItems.forEach(item => item.classList.remove('bg-gray-700', 'text-blue-400'));
        document.querySelector(`.nav-item[data-page="${pageId}"]`).classList.add('bg-gray-700', 'text-blue-400');
        this.activePage = pageId;
        this.currentPath = '';
        this.updateBreadcrumbs();
        this.loadFiles();
    }

    async loadFiles() {
        if (!this.keyId) return;
        this.worker.postMessage({ type: 'FETCH_FILES', payload: { path: this.currentPath, page: this.activePage } });
    }

    async loadFolders() {
        this.worker.postMessage({ type: 'FETCH_FOLDERS', payload: { path: this.currentPath, page: this.activePage } });
    }

    renderFiles() {
        this.fileGrid.innerHTML = '';
        const items = [...this.folders, ...this.files].filter(item =>
            item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
        if (items.length === 0) {
            this.emptyState.classList.remove('hidden');
            this.fileGrid.classList.add('hidden');
            return;
        }
        this.emptyState.classList.add('hidden');
        this.fileGrid.classList.remove('hidden');
        items.sort((a, b) => {
            if (this.sortBy === 'name') {
                return this.sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            return 0;
        });
        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            this.fileGrid.appendChild(itemElement);
        });
    }

    createItemElement(item) {
        const div = document.createElement('div');
        div.className = this.viewMode === 'grid'
            ? 'file-item p-2 rounded-lg hover:bg-gray-800 transition-colors'
            : 'file-item flex items-center p-2 rounded-lg hover:bg-gray-800 transition-colors';
        div.dataset.id = item.id;
        div.dataset.isFolder = item.isFolder ? 'true' : 'false';
        const icon = item.isFolder ? 'bx-folder' : this.getFileIcon(item.name);
        const content = this.viewMode === 'grid'
            ? `
                <div class="flex flex-col items-center">
                    <i class="bx ${icon} text-4xl text-gray-400 mb-2"></i>
                    <span class="text-sm truncate w-24 text-center">${item.name}</span>
                    <div class="file-actions opacity-0 flex space-x-1 mt-2">
                        ${!item.isFolder ? '<button class="action-download p-1 rounded hover:bg-gray-700"><i class="bx bx-download"></i></button>' : ''}
                        ${!item.isFolder ? '<button class="action-share p-1 rounded hover:bg-gray-700"><i class="bx bx-share-alt"></i></button>' : ''}
                        <button class="action-rename p-1 rounded hover:bg-gray-700"><i class="bx bx-rename"></i></button>
                        <button class="action-move p-1 rounded hover:bg-gray-700"><i class="bx bx-move"></i></button>
                        <button class="action-copy p-1 rounded hover:bg-gray-700"><i class="bx bx-copy"></i></button>
                        <button class="action-tag p-1 rounded hover:bg-gray-700"><i class="bx bx-tag"></i></button>
                        <button class="action-delete p-1 rounded hover:bg-gray-700"><i class="bx bx-trash"></i></button>
                        ${!item.isFolder ? `<button class="action-${item.encryptedData ? 'decrypt' : 'encrypt'} p-1 rounded hover:bg-gray-700"><i class="bx bx-${item.encryptedData ? 'lock-open' : 'lock'}"></i></button>` : ''}
                        <button class="action-versions p-1 rounded hover:bg-gray-700"><i class="bx bx-history"></i></button>
                        <button class="action-logs p-1 rounded hover:bg-gray-700"><i class="bx bx-list-ul"></i></button>
                    </div>
                </div>
            `
            : `
                <i class="bx ${icon} text-xl text-gray-400 mr-2"></i>
                <span class="flex-1 truncate">${item.name}</span>
                <span class="text-sm text-gray-400 mr-2">${this.formatSize(item.size || 0)}</span>
                <span class="text-sm text-gray-400">${new Date(item.lastModified).toLocaleDateString()}</span>
                <div class="file-actions opacity-0 flex space-x-1 ml-2">
                    ${!item.isFolder ? '<button class="action-download p-1 rounded hover:bg-gray-700"><i class="bx bx-download"></i></button>' : ''}
                    ${!item.isFolder ? '<button class="action-share p-1 rounded hover:bg-gray-700"><i class="bx bx-share-alt"></i></button>' : ''}
                    <button class="action-rename p-1 rounded hover:bg-gray-700"><i class="bx bx-rename"></i></button>
                    <button class="action-move p-1 rounded hover:bg-gray-700"><i class="bx bx-move"></i></button>
                    <button class="action-copy p-1 rounded hover:bg-gray-700"><i class="bx bx-copy"></i></button>
                    <button class="action-tag p-1 rounded hover:bg-gray-700"><i class="bx bx-tag"></i></button>
                    <button class="action-delete p-1 rounded hover:bg-gray-700"><i class="bx bx-trash"></i></button>
                    ${!item.isFolder ? `<button class="action-${item.encryptedData ? 'decrypt' : 'encrypt'} p-1 rounded hover:bg-gray-700"><i class="bx bx-${item.encryptedData ? 'lock-open' : 'lock'}"></i></button>` : ''}
                    <button class="action-versions p-1 rounded hover:bg-gray-700"><i class="bx bx-history"></i></button>
                    <button class="action-logs p-1 rounded hover:bg-gray-700"><i class="bx bx-list-ul"></i></button>
                </div>
            `;
        div.innerHTML = content;
        if (this.selectedItems.has(item.id)) {
            div.classList.add('selected');
        }
        div.addEventListener('click', (e) => {
            if (e.target.closest('.file-actions')) return;
            if (item.isFolder) {
                this.navigateToFolder(item.name);
            } else {
                this.toggleItemSelection(item.id);
            }
        });
        if (!item.isFolder) {
            div.querySelector('.action-download')?.addEventListener('click', () => this.handleDownload(item));
            div.querySelector('.action-share')?.addEventListener('click', () => this.handleShare(item));
        }
        div.querySelector('.action-rename')?.addEventListener('click', () => this.openRenameModal(item));
        div.querySelector('.action-move')?.addEventListener('click', () => this.openMoveModal(item));
        div.querySelector('.action-copy')?.addEventListener('click', () => this.openCopyModal(item));
        div.querySelector('.action-tag')?.addEventListener('click', () => this.openTagModal(item));
        div.querySelector('.action-delete')?.addEventListener('click', () => this.handleDelete(item));
        div.querySelector('.action-encrypt')?.addEventListener('click', () => this.handleEncrypt(item));
        div.querySelector('.action-decrypt')?.addEventListener('click', () => this.handleDecrypt(item));
        div.querySelector('.action-versions')?.addEventListener('click', () => this.handleGetVersions(item));
        div.querySelector('.action-logs')?.addEventListener('click', () => this.handleGetLogs(item));
        return div;
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return {
            pdf: 'bx-file',
            jpg: 'bx-image',
            png: 'bx-image',
            mp4: 'bx-video',
            txt: 'bx-file',
            doc: 'bx-file',
            docx: 'bx-file'
        }[ext] || 'bx-file';
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    navigateToFolder(folderName) {
        this.currentPath = this.currentPath ? `${this.currentPath}/${folderName}` : folderName;
        this.updateBreadcrumbs();
        this.loadFiles();
    }

    updateBreadcrumbs() {
        this.breadcrumbs.innerHTML = '';
        const homeButton = document.createElement('button');
        homeButton.className = 'flex items-center text-blue-400 hover:underline transition-colors';
        homeButton.innerHTML = `<i class="bx bx-home"></i><span class="ml-1">Home</span>`;
        homeButton.addEventListener('click', () => {
            this.currentPath = '';
            this.updateBreadcrumbs();
            this.loadFiles();
        });
        this.breadcrumbs.appendChild(homeButton);
        if (this.currentPath) {
            const pathParts = this.currentPath.split('/');
            let currentPath = '';
            pathParts.forEach(part => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const separator = document.createElement('span');
                separator.className = 'mx-2 text-gray-400';
                separator.textContent = '>';
                this.breadcrumbs.appendChild(separator);
                const button = document.createElement('button');
                button.className = 'text-blue-400 hover:underline transition-colors';
                button.textContent = part;
                button.dataset.path = currentPath;
                button.addEventListener('click', () => {
                    this.currentPath = currentPath;
                    this.updateBreadcrumbs();
                    this.loadFiles();
                });
                this.breadcrumbs.appendChild(button);
            });
        }
    }

    toggleItemSelection(itemId) {
        if (this.selectedItems.has(itemId)) {
            this.selectedItems.delete(itemId);
        } else {
            this.selectedItems.add(itemId);
        }
        this.renderFiles();
    }

    handleSearch(query) {
        this.searchQuery = query;
        this.renderFiles();
    }

    handleFileUpload(files) {
        if (!this.keyId) {
            this.showError({ code: 3000, message: 'Encryption key not initialized' });
            return;
        }
        const largeFileThreshold = 1024 * 1024 * 50; // 50MB
        Array.from(files).forEach(file => {
            if (file.size > largeFileThreshold) {
                this.worker.postMessage({ type: 'STREAM_FILE_UPLOAD', payload: { file, path: this.currentPath, keyId: this.keyId } });
            } else {
                this.worker.postMessage({ type: 'UPLOAD_FILES', payload: { files: [file], path: this.currentPath, keyId: this.keyId } });
            }
            this.showProgressModal(file);
            this.uploadStartTime = Date.now();
        });
    }

    createNewFolder() {
        if (!this.keyId) {
            this.showError({ code: 3001, message: 'Encryption key not initialized' });
            return;
        }
        const name = prompt('Enter folder name:');
        if (name) {
            this.worker.postMessage({ type: 'CREATE_FOLDER', payload: { name, path: this.currentPath, keyId: this.keyId } });
        }
    }

    showProgressModal(file) {
        this.progressModal.classList.remove('hidden');
        this.progressFileName.textContent = file.name;
        this.progressSize.textContent = `0 MB of ${this.formatSize(file.size)}`;
        this.progressSpeed.textContent = '0 MB/s';
        this.progressPercent.textContent = '0%';
        this.progressBar.style.width = '0%';
        this.progressBar2.style.width = '0%';
        this.progressTimeElapsed.textContent = '0:00';
        this.progressTimeRemaining.textContent = '0:00 remaining';
    }

    updateProgress({ fileName, processedBytes, totalBytes, percent }) {
        this.progressFileName.textContent = fileName;
        this.progressSize.textContent = `${this.formatSize(processedBytes)} of ${this.formatSize(totalBytes)}`;
        const elapsed = (Date.now() - this.uploadStartTime) / 1000;
        const speed = processedBytes / elapsed / 1024 / 1024;
        this.progressSpeed.textContent = `${speed.toFixed(2)} MB/s`;
        this.progressPercent.textContent = `${percent.toFixed(2)}%`;
        this.progressBar.style.width = `${percent}%`;
        this.progressBar2.style.width = `${percent}%`;
        this.progressTimeElapsed.textContent = this.formatTime(elapsed);
        const remaining = (totalBytes - processedBytes) / (speed * 1024 * 1024);
        this.progressTimeRemaining.textContent = `${this.formatTime(remaining)} remaining`;
        if (percent >= 100) {
            this.hideProgressModal();
        }
    }

    updateOperationProgress({ percent, folderId }) {
        this.progressPercent.textContent = `${percent.toFixed(2)}%`;
        this.progressBar.style.width = `${percent}%`;
        this.progressBar2.style.width = `${percent}%`;
        if (percent >= 100) {
            this.hideProgressModal();
        }
    }

    formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    hideProgressModal() {
        this.progressModal.classList.add('hidden');
        this.uploadStartTime = null;
    }

    cancelOperation() {
        this.hideProgressModal();
        // Note: Actual cancellation requires worker support, which is not implemented
    }

    showContextMenu(e) {
        e.preventDefault();
        const target = e.target.closest('.file-item');
        if (!target) return;
        const itemId = target.dataset.id;
        this.selectedItems.clear();
        this.selectedItems.add(itemId);
        this.renderFiles();
        this.contextMenu.style.top = `${e.clientY}px`;
        this.contextMenu.style.left = `${e.clientX}px`;
        this.contextMenu.classList.remove('hidden');
        this.contextMenu.querySelectorAll('.context-action').forEach(action => {
            action.addEventListener('click', () => {
                const actionType = action.dataset.action;
                const item = [...this.files, ...this.folders].find(f => f.id === itemId);
                this[`handle${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`](item);
            });
        });
    }

    hideContextMenu() {
        this.contextMenu.classList.add('hidden');
    }

    handleDownload(item) {
        if (!item.isFolder) {
            this.worker.postMessage({ type: 'CHECK_ACCESS', payload: { fileId: item.id, userId: this.userId, action: 'DOWNLOAD' } });
            this.worker.postMessage({ type: 'DOWNLOAD_FILE', payload: { id: item.id } });
        }
    }

    handleDownloadSuccess({ id, data, name }) {
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    }

    handleShare(item) {
        if (!item.isFolder) {
            this.worker.postMessage({ type: 'CHECK_ACCESS', payload: { fileId: item.id, userId: this.userId, action: 'SHARE' } });
            this.worker.postMessage({ type: 'SHARE_FILE', payload: { id: item.id } });
        }
    }

    handleShareSuccess({ id, shareUrl }) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert(`Share link for file ${id} copied to clipboard: ${shareUrl}`);
        });
    }

    openRenameModal(item) {
        this.renameInput.value = item.name;
        this.renameModal.classList.remove('hidden');
        this.renameModal.dataset.id = item.id;
        this.renameModal.dataset.isFolder = item.isFolder;
        this.renameInput.focus();
    }

    closeRenameModal() {
        this.renameModal.classList.add('hidden');
    }

    handleRename() {
        const itemId = this.renameModal.dataset.id;
        const isFolder = this.renameModal.dataset.isFolder === 'true';
        const newName = this.renameInput.value.trim();
        if (newName) {
            this.worker.postMessage({
                type: isFolder ? 'RENAME_FOLDER' : 'RENAME_FILE',
                payload: { id: itemId, newName }
            });
        }
        this.closeRenameModal();
    }

    openMoveModal(item) {
        this.moveInput.value = this.currentPath;
        this.moveModal.classList.remove('hidden');
        this.moveModal.dataset.id = item.id;
        this.moveModal.dataset.isFolder = item.isFolder;
        this.moveInput.focus();
    }

    closeMoveModal() {
        this.moveModal.classList.add('hidden');
    }

    handleMove() {
        const itemId = this.moveModal.dataset.id;
        const isFolder = this.moveModal.dataset.isFolder === 'true';
        const newPath = this.moveInput.value.trim();
        if (newPath) {
            this.worker.postMessage({
                type: isFolder ? 'MOVE_FOLDER' : 'MOVE_FILE',
                payload: { id: itemId, newPath }
            });
        }
        this.closeMoveModal();
    }

    openCopyModal(item) {
        this.copyInput.value = this.currentPath;
        this.copyModal.classList.remove('hidden');
        this.copyModal.dataset.id = item.id;
        this.copyModal.dataset.isFolder = item.isFolder;
        this.copyInput.focus();
    }

    closeCopyModal() {
        this.copyModal.classList.add('hidden');
    }

    handleCopy() {
        const itemId = this.copyModal.dataset.id;
        const isFolder = this.copyModal.dataset.isFolder === 'true';
        const newPath = this.copyInput.value.trim();
        if (newPath) {
            this.worker.postMessage({
                type: isFolder ? 'COPY_FOLDER' : 'COPY_FILE',
                payload: { id: itemId, newPath }
            });
        }
        this.closeCopyModal();
    }

    openTagModal(item) {
        this.tagInput.value = '';
        this.tagModal.classList.remove('hidden');
        this.tagModal.dataset.id = item.id;
        this.tagModal.dataset.isFolder = item.isFolder;
        this.tagInput.focus();
    }

    closeTagModal() {
        this.tagModal.classList.add('hidden');
    }

    handleAddTag() {
        const itemId = this.tagModal.dataset.id;
        const isFolder = this.tagModal.dataset.isFolder === 'true';
        const tag = this.tagInput.value.trim();
        if (tag) {
            this.worker.postMessage({
                type: 'ADD_TAG',
                payload: { id: itemId, tag, isFolder }
            });
        }
        this.closeTagModal();
    }

    handleDelete(item) {
        this.worker.postMessage({
            type: item.isFolder ? 'DELETE_FOLDER' : 'DELETE_FILE',
            payload: { id: item.id }
        });
    }

    handleEncrypt(item) {
        if (!item.isFolder) {
            this.showProgressModal({ name: item.name, size: item.size });
            this.worker.postMessage({ type: 'ENCRYPT_FILE', payload: { id: item.id } });
        } else {
            this.showProgressModal({ name: item.name, size: 0 });
            this.worker.postMessage({ type: 'ENCRYPT_FOLDER', payload: { id: item.id } });
        }
    }

    handleDecrypt(item) {
        if (!item.isFolder) {
            this.showProgressModal({ name: item.name, size: item.size });
            this.worker.postMessage({ type: 'DECRYPT_FILE', payload: { id: item.id } });
        } else {
            this.showProgressModal({ name: item.name, size: 0 });
            this.worker.postMessage({ type: 'DECRYPT_FOLDER', payload: { id: item.id } });
        }
    }

    handleGetVersions(item) {
        if (!item.isFolder) {
            this.worker.postMessage({ type: 'GET_FILE_VERSIONS', payload: { fileId: item.id } });
        }
    }

    showFileVersions(versions) {
        // Placeholder: Implement UI to display versions (e.g., modal with version list)
        console.log('File versions:', versions);
        alert(`Versions: ${versions.map(v => `Version ${v.version} (${new Date(v.createdAt).toLocaleString()})`).join(', ')}`);
    }

    handleGetLogs(item) {
        this.worker.postMessage({
            type: 'GET_ACCESS_LOGS',
            payload: { fileId: item.isFolder ? null : item.id, folderId: item.isFolder ? item.id : null }
        });
    }

    showAccessLogs(logs) {
        // Placeholder: Implement UI to display logs (e.g., modal with log table)
        console.log('Access logs:', logs);
        alert(`Logs: ${logs.map(l => `${l.action} by ${l.userId} at ${new Date(l.timestamp).toLocaleString()}`).join(', ')}`);
    }

    handleBatchOperateSuccess({ successes, errors }) {
        if (successes.length) {
            this.loadFiles();
        }
        if (errors.length) {
            this.showError({ code: 3002, message: `Batch operation errors: ${errors.map(e => e.message).join(', ')}` });
        }
    }

    handleAccessCheck({ hasAccess }) {
        if (!hasAccess) {
            this.showError({ code: 3003, message: 'Access denied' });
        }
    }

    handleFilter(filter) {
        this.searchQuery = filter;
        this.renderFiles();
    }

    updateStorage() {
        this.worker.postMessage({ type: 'GET_STORAGE' });
    }

    showError({ code, message }) {
        alert(`Error ${code}: ${message}`);
    }

    handleDragOver(e) {
        e.preventDefault();
        this.fileContainer.classList.add('drag-active');
        this.isDragging = true;
    }

    handleDragLeave() {
        this.fileContainer.classList.remove('drag-active');
        this.isDragging = false;
    }

    handleDrop(e) {
        e.preventDefault();
        this.fileContainer.classList.remove('drag-active');
        this.isDragging = false;
        const files = e.dataTransfer.files;
        this.handleFileUpload(files);
    }
}

class Favorites extends FileManager {
    constructor() {
        super();
        this.initFavoritesElements();
        this.initFavoritesEventListeners();
    }

    initFavoritesElements() {
        this.favoritesGrid = document.getElementById('favoritesGrid');
        this.favoritesEmptyState = document.getElementById('favoritesEmptyState');
        this.favoritesCount = document.getElementById('favoritesCount');
        this.removeFavoritesBtn = this.pages.favoritesPage.querySelector('.bg-gray-700');
        this.addFavoritesBtn = this.pages.favoritesPage.querySelector('.bg-blue-600');
    }

    initFavoritesEventListeners() {
        this.removeFavoritesBtn.addEventListener('click', () => this.removeFromFavorites());
        this.addFavoritesBtn.addEventListener('click', () => this.addToFavorites());
    }

    renderFiles() {
        this.favoritesGrid.innerHTML = '';
        const items = [...this.folders, ...this.files].filter(item =>
            item.isFavorite && item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
        this.favoritesCount.textContent = `${items.length} items`;
        if (items.length === 0) {
            this.favoritesEmptyState.classList.remove('hidden');
            this.favoritesGrid.classList.add('hidden');
            return;
        }
        this.favoritesEmptyState.classList.add('hidden');
        this.favoritesGrid.classList.remove('hidden');
        items.sort((a, b) => {
            if (this.sortBy === 'name') {
                return this.sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            return 0;
        });
        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            this.favoritesGrid.appendChild(itemElement);
        });
    }

    addToFavorites() {
        this.worker.postMessage({
            type: 'ADD_TO_FAVORITES',
            payload: { ids: Array.from(this.selectedItems), isFolder: false }
        });
        this.selectedItems.clear();
    }

    removeFromFavorites() {
        this.worker.postMessage({
            type: 'REMOVE_FROM_FAVORITES',
            payload: { ids: Array.from(this.selectedItems), isFolder: false }
        });
        this.selectedItems.clear();
    }
}

class Recent extends FileManager {
    constructor() {
        super();
        this.initRecentElements();
        this.initRecentEventListeners();
    }

    initRecentElements() {
        this.recentGrid = document.getElementById('recentGrid');
        this.recentEmptyState = document.getElementById('recentEmptyState');
        this.recentCount = document.getElementById('recentCount');
        this.clearRecentBtn = this.pages.recentPage.querySelector('.bg-gray-700');
    }

    initRecentEventListeners() {
        this.clearRecentBtn.addEventListener('click', () => this.clearRecent());
    }

    renderFiles() {
        this.recentGrid.innerHTML = '';
        const items = [...this.folders, ...this.files].filter(item =>
            item.lastModified > Date.now() - 30 * 24 * 60 * 60 * 1000 &&
            item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
        this.recentCount.textContent = `${items.length} items`;
        if (items.length === 0) {
            this.recentEmptyState.classList.remove('hidden');
            this.recentGrid.classList.add('hidden');
            return;
        }
        this.recentEmptyState.classList.add('hidden');
        this.recentGrid.classList.remove('hidden');
        items.sort((a, b) => {
            if (this.sortBy === 'name') {
                return this.sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            return 0;
        });
        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            this.recentGrid.appendChild(itemElement);
        });
    }

    clearRecent() {
        this.worker.postMessage({ type: 'CLEAR_RECENT', payload: { path: this.currentPath } });
    }
}

class Trash extends FileManager {
    constructor() {
        super();
        this.initTrashElements();
        this.initTrashEventListeners();
    }

    initTrashElements() {
        this.trashGrid = document.getElementById('trashGrid');
        this.trashEmptyState = document.getElementById('trashEmptyState');
        this.trashCount = document.getElementById('trashCount');
        this.trashSize = document.getElementById('trashSize');
        this.restoreBtn = this.pages.trashPage.querySelector('.bg-gray-700');
        this.emptyTrashBtn = this.pages.trashPage.querySelector('.bg-red-600');
    }

    initTrashEventListeners() {
        this.restoreBtn.addEventListener('click', () => this.restoreItems());
        this.emptyTrashBtn.addEventListener('click', () => this.emptyTrash());
    }

    renderFiles() {
        this.trashGrid.innerHTML = '';
        const items = [...this.folders, ...this.files].filter(item =>
            item.isDeleted && item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
        const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
        this.trashCount.textContent = `${items.length} items`;
        this.trashSize.textContent = this.formatSize(totalSize);
        if (items.length === 0) {
            this.trashEmptyState.classList.remove('hidden');
            this.trashGrid.classList.add('hidden');
            return;
        }
        this.trashEmptyState.classList.add('hidden');
        this.trashGrid.classList.remove('hidden');
        items.sort((a, b) => {
            if (this.sortBy === 'name') {
                return this.sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            return 0;
        });
        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            this.trashGrid.appendChild(itemElement);
        });
    }

    restoreItems() {
        const fileIds = Array.from(this.selectedItems).filter(id => this.files.find(f => f.id === id));
        const folderIds = Array.from(this.selectedItems).filter(id => this.folders.find(f => f.id === id));
        if (fileIds.length) {
            this.worker.postMessage({ type: 'RESTORE_FILES', payload: { ids: fileIds } });
        }
        if (folderIds.length) {
            this.worker.postMessage({ type: 'RESTORE_FOLDERS', payload: { ids: folderIds } });
        }
        this.selectedItems.clear();
    }

    emptyTrash() {
        this.worker.postMessage({ type: 'EMPTY_TRASH', payload: { path: this.currentPath } });
        this.selectedItems.clear();
    }
}

class Backups extends FileManager {
    constructor() {
        super();
        this.initBackupsElements();
        this.initBackupsEventListeners();
    }

    initBackupsElements() {
        this.backupsGrid = document.getElementById('backupsGrid');
        this.backupsEmptyState = document.getElementById('backupsEmptyState');
        this.backupsCount = document.getElementById('backupsCount');
        this.backupsSize = document.getElementById('backupsSize');
        this.createBackupBtn = this.pages.backupsPage.querySelector('.bg-blue-600');
        this.backupSettingsBtn = this.pages.backupsPage.querySelector('.bg-gray-700');
        this.emptyStateBackupBtn = document.getElementById('backupsEmptyState').querySelector('button');
    }

    initBackupsEventListeners() {
        this.createBackupBtn.addEventListener('click', () => this.createBackup());
        this.backupSettingsBtn.addEventListener('click', () => this.openBackupSettings());
        this.emptyStateBackupBtn.addEventListener('click', () => this.createBackup());
    }

    renderFiles() {
        this.backupsGrid.innerHTML = '';
        const items = this.files.filter(item =>
            item.isBackup && item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
        const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
        this.backupsCount.textContent = `${items.length} backups`;
        this.backupsSize.textContent = this.formatSize(totalSize);
        if (items.length === 0) {
            this.backupsEmptyState.classList.remove('hidden');
            this.backupsGrid.classList.add('hidden');
            return;
        }
        this.backupsEmptyState.classList.add('hidden');
        this.backupsGrid.classList.remove('hidden');
        items.sort((a, b) => {
            if (this.sortBy === 'name') {
                return this.sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            return 0;
        });
        items.forEach(item => {
            const itemElement = this.createItemElement(item);
            this.backupsGrid.appendChild(itemElement);
        });
    }

    createBackup() {
        this.worker.postMessage({ type: 'CREATE_BACKUP', payload: { path: this.currentPath } });
        this.showProgressModal({ name: 'Backup', size: 0 });
    }

    openBackupSettings() {
        // Placeholder: Implement UI for backup settings (e.g., modal for schedule, retention)
        alert('Backup settings not implemented');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('.page.active').id;
    switch (page) {
        case 'favoritesPage':
            new Favorites();
            break;
        case 'recentPage':
            new Recent();
            break;
        case 'trashPage':
            new Trash();
            break;
        case 'backupsPage':
            new Backups();
            break;
        default:
            new FileManager();
    }
});