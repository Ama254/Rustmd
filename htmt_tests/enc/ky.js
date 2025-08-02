let db;
async function dx() {
    await import('https://unpkg.com/dexie@3.2.7/dist/dexie.js');
    db = new Dexie('SecureFilesDB');
    db.version(2).stores({
        files: 'id, name, path, size, lastModified, isFavorite, isDeleted, isBackup, tags, keyId',
        folders: 'id, name, path, lastModified, isFavorite, isDeleted, tags, keyId',
        encryptionKeys: 'id, version, createdAt',
        fileVersions: 'id, fileId, version, createdAt, size, encryptedData, keyId',
        accessLogs: 'id, fileId, folderId, action, timestamp, userId'
    });
}
dx()


const worker = self;
let cryptoService = null;

worker.onmessage = async (e) => {
    const { type, payload } = e.data;
    
    try {
        switch (type) {
            case 'INIT_CRYPTO':
                await initCrypto(payload);
                break;
            case 'FETCH_FILES':
                await fetchFiles(payload);
                break;
            case 'FETCH_FOLDERS':
                await fetchFolders(payload);
                break;
            case 'UPLOAD_FILES':
                await uploadFiles(payload);
                break;
            case 'CREATE_FOLDER':
                await createFolder(payload);
                break;
            case 'DOWNLOAD_FILE':
                await downloadFile(payload);
                break;
            case 'SHARE_FILE':
                await shareFile(payload);
                break;
            case 'RENAME_FILE':
                await renameFile(payload);
                break;
            case 'RENAME_FOLDER':
                await renameFolder(payload);
                break;
            case 'MOVE_FILE':
                await moveFile(payload);
                break;
            case 'MOVE_FOLDER':
                await moveFolder(payload);
                break;
            case 'COPY_FILE':
                await copyFile(payload);
                break;
            case 'COPY_FOLDER':
                await copyFolder(payload);
                break;
            case 'ADD_TAG':
                await addTag(payload);
                break;
            case 'REMOVE_TAG':
                await removeTag(payload);
                break;
            case 'DELETE_FILE':
                await deleteFile(payload);
                break;
            case 'DELETE_FOLDER':
                await deleteFolder(payload);
                break;
            case 'ENCRYPT_FILE':
                await encryptFile(payload);
                break;
            case 'DECRYPT_FILE':
                await decryptFile(payload);
                break;
            case 'ENCRYPT_FOLDER':
                await encryptFolder(payload);
                break;
            case 'DECRYPT_FOLDER':
                await decryptFolder(payload);
                break;
            case 'ADD_TO_FAVORITES':
                await addToFavorites(payload);
                break;
            case 'REMOVE_FROM_FAVORITES':
                await removeFromFavorites(payload);
                break;
            case 'CLEAR_RECENT':
                await clearRecent(payload);
                break;
            case 'RESTORE_FILES':
                await restoreFiles(payload);
                break;
            case 'RESTORE_FOLDERS':
                await restoreFolders(payload);
                break;
            case 'EMPTY_TRASH':
                await emptyTrash(payload);
                break;
            case 'CREATE_BACKUP':
                await createBackup(payload);
                break;
            case 'RESTORE_BACKUP':
                await restoreBackup(payload);
                break;
            case 'GET_STORAGE':
                await getStorage();
                break;
            case 'GET_FILE_VERSIONS':
                await getFileVersions(payload);
                break;
            case 'RESTORE_FILE_VERSION':
                await restoreFileVersion(payload);
                break;
            case 'GET_ACCESS_LOGS':
                await getAccessLogs(payload);
                break;
            case 'BATCH_OPERATE':
                await batchOperate(payload);
                break;
            case 'ROTATE_KEY':
                await rotateKey(payload);
                break;
            case 'STREAM_FILE_UPLOAD':
                await streamFileUpload(payload);
                break;
            case 'CHECK_ACCESS':
                await checkAccess(payload);
                break;
            default:
                worker.postMessage({ type: 'ERROR', payload: { code: 2000, message: `Unknown action: ${type}` } });
        }
    } catch (error) {
        worker.postMessage({ type: 'ERROR', payload: { code: 2001, message: error.message } });
    }
};

async function initCrypto({ masterKey, config }) {
    const { CryptoService, Config, EncryptionAlgorithm, KdfAlgorithm, SecureBytes } = await import('../../enc/pkg/enc.js');
    const configObj = new Config(
        config.kdfTimeCost,
        config.kdfMemCost,
        config.kdfParallelism,
        EncryptionAlgorithm[config.algorithm],
        KdfAlgorithm[config.kdfAlgorithm],
        config.keyVersion
    );
    cryptoService = await CryptoService.new(masterKey, configObj);
    const keyId = Date.now().toString() + Math.random().toString(36).slice(2);
    await db.encryptionKeys.add({
        id: keyId,
        version: config.keyVersion,
        createdAt: Date.now()
    });
    worker.postMessage({ type: 'INIT_CRYPTO_SUCCESS', payload: { keyId } });
}

async function fetchFiles({ path, page }) {
    let query;
    switch (page) {
        case 'homePage':
            query = db.files.where({ path, isDeleted: 0 });
            break;
        case 'favoritesPage':
            query = db.files.where({ isFavorite: 1, isDeleted: 0 });
            break;
        case 'recentPage':
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            query = db.files.where('lastModified').above(thirtyDaysAgo).and(file => !file.isDeleted);
            break;
        case 'trashPage':
            query = db.files.where({ isDeleted: 1 });
            break;
        case 'backupsPage':
            query = db.files.where({ isBackup: 1 });
            break;
        default:
            query = db.files.where({ path, isDeleted: 0 });
    }
    const files = await query.toArray();
    worker.postMessage({ type: 'FETCH_FILES_SUCCESS', payload: files });
}

async function fetchFolders({ path, page }) {
    let query;
    switch (page) {
        case 'homePage':
            query = db.folders.where({ path, isDeleted: 0 });
            break;
        case 'favoritesPage':
            query = db.folders.where({ isFavorite: 1, isDeleted: 0 });
            break;
        case 'recentPage':
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            query = db.folders.where('lastModified').above(thirtyDaysAgo).and(folder => !folder.isDeleted);
            break;
        case 'trashPage':
            query = db.folders.where({ isDeleted: 1 });
            break;
        default:
            query = db.folders.where({ path, isDeleted: 0 });
    }
    const folders = await query.toArray();
    worker.postMessage({ type: 'FETCH_FOLDERS_SUCCESS', payload: folders });
}

async function uploadFiles({ files, path, keyId }) {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let processedBytes = 0;
    
    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const context = new Uint8Array(new TextEncoder().encode(file.name));
        const encrypted = await cryptoService.encrypt(data, context, null);
        
        const fileObj = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: file.name,
            path,
            size: file.size,
            lastModified: Date.now(),
            isFavorite: 0,
            isDeleted: 0,
            isBackup: 0,
            tags: [],
            keyId,
            encryptedData: encrypted
        };
        
        await db.files.add(fileObj);
        await db.fileVersions.add({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            fileId: fileObj.id,
            version: 1,
            createdAt: Date.now(),
            size: file.size,
            encryptedData: encrypted,
            keyId
        });
        
        await logAccess(fileObj.id, null, 'UPLOAD', 'user1');
        processedBytes += file.size;
        worker.postMessage({
            type: 'UPLOAD_PROGRESS',
            payload: {
                fileName: file.name,
                processedBytes,
                totalBytes,
                percent: (processedBytes / totalBytes) * 100
            }
        });
    }
    
    const filesInPath = await db.files.where({ path, isDeleted: 0 }).toArray();
    worker.postMessage({ type: 'UPLOAD_FILES_SUCCESS', payload: filesInPath });
}

async function streamFileUpload({ file, path, keyId }) {
    const reader = file.stream().getReader();
    const context = new Uint8Array(new TextEncoder().encode(file.name));
    const streamState = await cryptoService.init_stream_encrypt();
    let processedBytes = 0;
    const totalBytes = file.size;
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            const encrypted = await cryptoService.stream_encrypt_chunk(streamState, new Uint8Array([]), context, null, true, async (progress) => {
                worker.postMessage({
                    type: 'STREAM_UPLOAD_PROGRESS',
                    payload: { fileName: file.name, processedBytes: progress, totalBytes, percent: (progress / totalBytes) * 100 }
                });
            });
            const fileObj = {
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                name: file.name,
                path,
                size: file.size,
                lastModified: Date.now(),
                isFavorite: 0,
                isDeleted: 0,
                isBackup: 0,
                tags: [],
                keyId,
                encryptedData: encrypted
            };
            await db.files.add(fileObj);
            await db.fileVersions.add({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                fileId: fileObj.id,
                version: 1,
                createdAt: Date.now(),
                size: file.size,
                encryptedData: encrypted,
                keyId
            });
            await logAccess(fileObj.id, null, 'UPLOAD_STREAM', 'user1');
            worker.postMessage({ type: 'STREAM_FILE_UPLOAD_SUCCESS', payload: fileObj });
            break;
        }
        processedBytes += value.length;
        await cryptoService.stream_encrypt_chunk(streamState, new Uint8Array(value), context, null, false, async (progress) => {
            worker.postMessage({
                type: 'STREAM_UPLOAD_PROGRESS',
                payload: { fileName: file.name, processedBytes: progress, totalBytes, percent: (progress / totalBytes) * 100 }
            });
        });
    }
}

async function createFolder({ name, path, keyId }) {
    const folder = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name,
        path,
        lastModified: Date.now(),
        isFavorite: 0,
        isDeleted: 0,
        tags: [],
        keyId
    };
    await db.folders.add(folder);
    await logAccess(null, folder.id, 'CREATE_FOLDER', 'user1');
    const folders = await db.folders.where({ path, isDeleted: 0 }).toArray();
    worker.postMessage({ type: 'CREATE_FOLDER_SUCCESS', payload: folders });
}

async function downloadFile({ id }) {
    const file = await db.files.get(id);
    if (file && file.encryptedData) {
        const context = new Uint8Array(new TextEncoder().encode(file.name));
        const decrypted = await cryptoService.decrypt(file.encryptedData, context, null);
        await logAccess(id, null, 'DOWNLOAD', 'user1');
        worker.postMessage({ type: 'DOWNLOAD_FILE_SUCCESS', payload: { id, data: decrypted, name: file.name } });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2002, message: 'File not found or not encrypted' } });
    }
}

async function shareFile({ id }) {
    const file = await db.files.get(id);
    if (file) {
        const shareUrl = `https://securefiles.example.com/share/${id}`;
        await logAccess(id, null, 'SHARE', 'user1');
        worker.postMessage({ type: 'SHARE_FILE_SUCCESS', payload: { id, shareUrl } });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2003, message: 'File not found' } });
    }
}

async function renameFile({ id, newName }) {
    const file = await db.files.get(id);
    if (file) {
        if (file.encryptedData) {
            const context = new Uint8Array(new TextEncoder().encode(file.name));
            const decrypted = await cryptoService.decrypt(file.encryptedData, context, null);
            const newContext = new Uint8Array(new TextEncoder().encode(newName));
            const reEncrypted = await cryptoService.encrypt(decrypted, newContext, null);
            await db.files.update(id, { name: newName, encryptedData: reEncrypted });
            await db.fileVersions.add({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                fileId: id,
                version: (await db.fileVersions.where({ fileId: id }).count()) + 1,
                createdAt: Date.now(),
                size: file.size,
                encryptedData: reEncrypted,
                keyId: file.keyId
            });
        } else {
            await db.files.update(id, { name: newName });
        }
        await logAccess(id, null, 'RENAME', 'user1');
        const files = await db.files.where({ path: file.path, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'RENAME_FILE_SUCCESS', payload: files });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2004, message: 'File not found' } });
    }
}

async function renameFolder({ id, newName }) {
    const folder = await db.folders.get(id);
    if (folder) {
        const oldPath = `${folder.path}/${folder.name}`;
        const newPath = `${folder.path}/${newName}`;
        await db.folders.update(id, { name: newName });
        await db.files.where({ path: oldPath }).modify({ path: newPath });
        await db.folders.where({ path: oldPath }).modify({ path: newPath });
        await logAccess(null, id, 'RENAME_FOLDER', 'user1');
        const folders = await db.folders.where({ path: folder.path, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'RENAME_FOLDER_SUCCESS', payload: folders });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2005, message: 'Folder not found' } });
    }
}

async function moveFile({ id, newPath }) {
    const file = await db.files.get(id);
    if (file) {
        await db.files.update(id, { path: newPath });
        await logAccess(id, null, 'MOVE', 'user1');
        const files = await db.files.where({ path: newPath, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'MOVE_FILE_SUCCESS', payload: files });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2006, message: 'File not found' } });
    }
}

async function moveFolder({ id, newPath }) {
    const folder = await db.folders.get(id);
    if (folder) {
        const oldPath = `${folder.path}/${folder.name}`;
        await db.folders.update(id, { path: newPath });
        await db.files.where({ path: oldPath }).modify({ path: `${newPath}/${folder.name}` });
        await db.folders.where({ path: oldPath }).modify({ path: `${newPath}/${folder.name}` });
        await logAccess(null, id, 'MOVE_FOLDER', 'user1');
        const folders = await db.folders.where({ path: newPath, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'MOVE_FOLDER_SUCCESS', payload: folders });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2007, message: 'Folder not found' } });
    }
}

async function copyFile({ id, newPath }) {
    const file = await db.files.get(id);
    if (file) {
        const newFile = { ...file, id: Date.now().toString() + Math.random().toString(36).slice(2), path: newPath };
        await db.files.add(newFile);
        await db.fileVersions.add({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            fileId: newFile.id,
            version: 1,
            createdAt: Date.now(),
            size: file.size,
            encryptedData: file.encryptedData,
            keyId: file.keyId
        });
        await logAccess(newFile.id, null, 'COPY', 'user1');
        const files = await db.files.where({ path: newPath, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'COPY_FILE_SUCCESS', payload: files });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2008, message: 'File not found' } });
    }
}

async function copyFolder({ id, newPath }) {
    const folder = await db.folders.get(id);
    if (folder) {
        const newFolder = { ...folder, id: Date.now().toString() + Math.random().toString(36).slice(2), path: newPath };
        await db.folders.add(newFolder);
        const oldPath = `${folder.path}/${folder.name}`;
        const newSubPath = `${newPath}/${folder.name}`;
        const files = await db.files.where({ path: oldPath }).toArray();
        const folders = await db.folders.where({ path: oldPath }).toArray();
        for (const file of files) {
            const newFile = { ...file, id: Date.now().toString() + Math.random().toString(36).slice(2), path: newSubPath };
            await db.files.add(newFile);
            await db.fileVersions.add({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                fileId: newFile.id,
                version: 1,
                createdAt: Date.now(),
                size: file.size,
                encryptedData: file.encryptedData,
                keyId: file.keyId
            });
        }
        for (const subFolder of folders) {
            await copyFolder({ id: subFolder.id, newPath: newSubPath });
        }
        await logAccess(null, newFolder.id, 'COPY_FOLDER', 'user1');
        const newFolders = await db.folders.where({ path: newPath, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'COPY_FOLDER_SUCCESS', payload: newFolders });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2009, message: 'Folder not found' } });
    }
}

async function addTag({ id, tag, isFolder }) {
    const table = isFolder ? db.folders : db.files;
    const item = await table.get(id);
    if (item) {
        const tags = item.tags ? [...item.tags, tag] : [tag];
        await table.update(id, { tags });
        await logAccess(isFolder ? null : id, isFolder ? id : null, 'ADD_TAG', 'user1');
        const items = await table.where({ path: item.path, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'ADD_TAG_SUCCESS', payload: items, isFolder });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2010, message: `${isFolder ? 'Folder' : 'File'} not found` } });
    }
}

async function removeTag({ id, tag, isFolder }) {
    const table = isFolder ? db.folders : db.files;
    const item = await table.get(id);
    if (item) {
        const tags = item.tags ? item.tags.filter(t => t !== tag) : [];
        await table.update(id, { tags });
        await logAccess(isFolder ? null : id, isFolder ? id : null, 'REMOVE_TAG', 'user1');
        const items = await table.where({ path: item.path, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'REMOVE_TAG_SUCCESS', payload: items, isFolder });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2011, message: `${isFolder ? 'Folder' : 'File'} not found` } });
    }
}

async function deleteFile({ id }) {
    const file = await db.files.get(id);
    if (file) {
        await db.files.update(id, { isDeleted: 1 });
        await logAccess(id, null, 'DELETE', 'user1');
        const files = await db.files.where({ path: file.path, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'DELETE_FILE_SUCCESS', payload: files });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2012, message: 'File not found' } });
    }
}

async function deleteFolder({ id }) {
    const folder = await db.folders.get(id);
    if (folder) {
        const folderPath = `${folder.path}/${folder.name}`;
        await db.folders.update(id, { isDeleted: 1 });
        await db.files.where({ path: folderPath }).modify({ isDeleted: 1 });
        await db.folders.where({ path: folderPath }).modify({ isDeleted: 1 });
        await logAccess(null, id, 'DELETE_FOLDER', 'user1');
        const folders = await db.folders.where({ path: folder.path, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'DELETE_FOLDER_SUCCESS', payload: folders });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2013, message: 'Folder not found' } });
    }
}

async function encryptFile({ id }) {
    const file = await db.files.get(id);
    if (file && !file.encryptedData) {
        const context = new Uint8Array(new TextEncoder().encode(file.name));
        const data = new Uint8Array(file.size);
        const encrypted = await cryptoService.encrypt(data, context, null);
        await db.files.update(id, { encryptedData: encrypted, keyId: file.keyId });
        await db.fileVersions.add({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            fileId: id,
            version: (await db.fileVersions.where({ fileId: id }).count()) + 1,
            createdAt: Date.now(),
            size: file.size,
            encryptedData: encrypted,
            keyId: file.keyId
        });
        await logAccess(id, null, 'ENCRYPT', 'user1');
        const files = await db.files.where({ path: file.path, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'ENCRYPT_FILE_SUCCESS', payload: files });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2014, message: 'File not found or already encrypted' } });
    }
}

async function decryptFile({ id }) {
    const file = await db.files.get(id);
    if (file && file.encryptedData) {
        const context = new Uint8Array(new TextEncoder().encode(file.name));
        const decrypted = await cryptoService.decrypt(file.encryptedData, context, null);
        await db.files.update(id, { encryptedData: null });
        await db.fileVersions.add({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            fileId: id,
            version: (await db.fileVersions.where({ fileId: id }).count()) + 1,
            createdAt: Date.now(),
            size: file.size,
            encryptedData: null,
            keyId: file.keyId
        });
        await logAccess(id, null, 'DECRYPT', 'user1');
        worker.postMessage({ type: 'DECRYPT_FILE_SUCCESS', payload: { id, data: decrypted } });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2015, message: 'File not found or not encrypted' } });
    }
}

async function encryptFolder({ id }) {
    const folder = await db.folders.get(id);
    if (folder) {
        const folderPath = `${folder.path}/${folder.name}`;
        const files = await db.files.where({ path: folderPath, isDeleted: 0 }).toArray();
        const batchData = files
            .filter(file => !file.encryptedData)
            .map(file => new Uint8Array(file.size));
        const context = new Uint8Array(new TextEncoder().encode(folder.name));
        const batchResult = await cryptoService.batch_encrypt(
            batchData,
            context,
            null,
            async (progress) => {
                    worker.postMessage({
                        type: 'ENCRYPT_FOLDER_PROGRESS',
                        payload: { folderId: id, percent: progress }
                    });
                },
                1024 * 1024 * 100
        );
        for (let i = 0; i < files.length; i++) {
            if (i < batchResult.successes.length) {
                await db.files.update(files[i].id, { encryptedData: batchResult.successes[i], keyId: folder.keyId });
                await db.fileVersions.add({
                    id: Date.now().toString() + Math.random().toString(36).slice(2),
                    fileId: files[i].id,
                    version: (await db.fileVersions.where({ fileId: files[i].id }).count()) + 1,
                    createdAt: Date.now(),
                    size: files[i].size,
                    encryptedData: batchResult.successes[i],
                    keyId: folder.keyId
                });
            }
        }
        await logAccess(null, id, 'ENCRYPT_FOLDER', 'user1');
        if (batchResult.errors.length > 0) {
            worker.postMessage({ type: 'ERROR', payload: { code: 2016, message: `Folder encryption errors: ${batchResult.errors.join(', ')}` } });
        }
        const filesInPath = await db.files.where({ path: folderPath, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'ENCRYPT_FOLDER_SUCCESS', payload: filesInPath });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2017, message: 'Folder not found' } });
    }
}

async function decryptFolder({ id }) {
    const folder = await db.folders.get(id);
    if (folder) {
        const folderPath = `${folder.path}/${folder.name}`;
        const files = await db.files.where({ path: folderPath, isDeleted: 0 }).toArray();
        const batchData = files
            .filter(file => file.encryptedData)
            .map(file => file.encryptedData);
        const context = new Uint8Array(new TextEncoder().encode(folder.name));
        const batchResult = await cryptoService.batch_decrypt(
            batchData,
            context,
            null,
            async (progress) => {
                    worker.postMessage({
                        type: 'DECRYPT_FOLDER_PROGRESS',
                        payload: { folderId: id, percent: progress }
                    });
                },
                1024 * 1024 * 100
        );
        for (let i = 0; i < files.length; i++) {
            if (i < batchResult.successes.length) {
                await db.files.update(files[i].id, { encryptedData: null });
                await db.fileVersions.add({
                    id: Date.now().toString() + Math.random().toString(36).slice(2),
                    fileId: files[i].id,
                    version: (await db.fileVersions.where({ fileId: files[i].id }).count()) + 1,
                    createdAt: Date.now(),
                    size: files[i].size,
                    encryptedData: null,
                    keyId: folder.keyId
                });
            }
        }
        await logAccess(null, id, 'DECRYPT_FOLDER', 'user1');
        if (batchResult.errors.length > 0) {
            worker.postMessage({ type: 'ERROR', payload: { code: 2018, message: `Folder decryption errors: ${batchResult.errors.join(', ')}` } });
        }
        const filesInPath = await db.files.where({ path: folderPath, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'DECRYPT_FOLDER_SUCCESS', payload: filesInPath });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2019, message: 'Folder not found' } });
    }
}

async function addToFavorites({ ids, isFolder }) {
    const table = isFolder ? db.folders : db.files;
    await table.where('id').anyOf(ids).modify({ isFavorite: 1 });
    await Promise.all(ids.map(id => logAccess(isFolder ? null : id, isFolder ? id : null, 'ADD_FAVORITE', 'user1')));
    const items = await table.where({ isFavorite: 1, isDeleted: 0 }).toArray();
    worker.postMessage({ type: 'ADD_TO_FAVORITES_SUCCESS', payload: items, isFolder });
}

async function removeFromFavorites({ ids, isFolder }) {
    const table = isFolder ? db.folders : db.files;
    await table.where('id').anyOf(ids).modify({ isFavorite: 0 });
    await Promise.all(ids.map(id => logAccess(isFolder ? null : id, isFolder ? id : null, 'REMOVE_FAVORITE', 'user1')));
    const items = await table.where({ isFavorite: 1, isDeleted: 0 }).toArray();
    worker.postMessage({ type: 'REMOVE_FROM_FAVORITES_SUCCESS', payload: items, isFolder });
}

async function clearRecent({ path }) {
    const thirtyDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await db.files.where('lastModified').above(thirtyDaysAgo).modify({ lastModified: thirtyDaysAgo });
    await db.folders.where('lastModified').above(thirtyDaysAgo).modify({ lastModified: thirtyDaysAgo });
    await logAccess(null, null, 'CLEAR_RECENT', 'user1');
    const files = await db.files.where({ path, isDeleted: 0 }).toArray();
    const folders = await db.folders.where({ path, isDeleted: 0 }).toArray();
    worker.postMessage({ type: 'CLEAR_RECENT_SUCCESS', payload: { files, folders } });
}

async function restoreFiles({ ids }) {
    await db.files.where('id').anyOf(ids).modify({ isDeleted: 0 });
    await Promise.all(ids.map(id => logAccess(id, null, 'RESTORE', 'user1')));
    const files = await db.files.where({ isDeleted: 1 }).toArray();
    worker.postMessage({ type: 'RESTORE_FILES_SUCCESS', payload: files });
}

async function restoreFolders({ ids }) {
    await db.folders.where('id').anyOf(ids).modify({ isDeleted: 0 });
    await Promise.all(ids.map(id => logAccess(null, id, 'RESTORE_FOLDER', 'user1')));
    const folders = await db.folders.where({ isDeleted: 1 }).toArray();
    worker.postMessage({ type: 'RESTORE_FOLDERS_SUCCESS', payload: folders });
}

async function emptyTrash({ path }) {
    await db.files.where({ isDeleted: 1 }).delete();
    await db.folders.where({ isDeleted: 1 }).delete();
    await logAccess(null, null, 'EMPTY_TRASH', 'user1');
    const files = await db.files.where({ path, isDeleted: 0 }).toArray();
    const folders = await db.folders.where({ path, isDeleted: 0 }).toArray();
    worker.postMessage({ type: 'EMPTY_TRASH_SUCCESS', payload: { files, folders } });
}

async function createBackup({ path }) {
    const files = await db.files.where({ path, isDeleted: 0 }).toArray();
    const batchData = files
        .filter(file => !file.isFolder && !file.isBackup)
        .map(file => file.encryptedData || new Uint8Array(file.size));
    const context = new Uint8Array(new TextEncoder().encode('backup'));
    
    const batchResult = await cryptoService.batch_encrypt(
        batchData,
        context,
        null,
        async (progress) => {
                worker.postMessage({
                    type: 'BACKUP_PROGRESS',
                    payload: { percent: progress }
                });
            },
            1024 * 1024 * 100
    );
    
    for (let i = 0; i < batchResult.successes.length; i++) {
        const originalFile = files[i];
        const backup = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: `Backup_${originalFile.name}_${new Date().toISOString().split('T')[0]}`,
            path,
            size: originalFile.size,
            lastModified: Date.now(),
            isFavorite: 0,
            isDeleted: 0,
            isBackup: 1,
            tags: originalFile.tags || [],
            keyId: originalFile.keyId,
            encryptedData: batchResult.successes[i]
        };
        await db.files.add(backup);
        await db.fileVersions.add({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            fileId: backup.id,
            version: 1,
            createdAt: Date.now(),
            size: backup.size,
            encryptedData: batchResult.successes[i],
            keyId: backup.keyId
        });
        await logAccess(backup.id, null, 'CREATE_BACKUP', 'user1');
    }
    
    if (batchResult.errors.length > 0) {
        worker.postMessage({ type: 'ERROR', payload: { code: 2020, message: `Backup errors: ${batchResult.errors.join(', ')}` } });
    }
    
    const backups = await db.files.where({ isBackup: 1 }).toArray();
    worker.postMessage({ type: 'CREATE_BACKUP_SUCCESS', payload: backups });
}

async function restoreBackup({ id }) {
    const backup = await db.files.get(id);
    if (backup && backup.isBackup) {
        const context = new Uint8Array(new TextEncoder().encode('backup'));
        const decrypted = await cryptoService.decrypt(backup.encryptedData, context, null);
        const restoredFile = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: backup.name.replace(/^Backup_/, ''),
            path: backup.path,
            size: backup.size,
            lastModified: Date.now(),
            isFavorite: 0,
            isDeleted: 0,
            isBackup: 0,
            tags: backup.tags,
            keyId: backup.keyId,
            encryptedData: decrypted
        };
        await db.files.add(restoredFile);
        await db.fileVersions.add({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            fileId: restoredFile.id,
            version: 1,
            createdAt: Date.now(),
            size: restoredFile.size,
            encryptedData: decrypted,
            keyId: restoredFile.keyId
        });
        await logAccess(restoredFile.id, null, 'RESTORE_BACKUP', 'user1');
        const files = await db.files.where({ path: restoredFile.path, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'RESTORE_BACKUP_SUCCESS', payload: files });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2021, message: 'Backup not found' } });
    }
}

async function getFileVersions({ fileId }) {
    const versions = await db.fileVersions.where({ fileId }).toArray();
    worker.postMessage({ type: 'GET_FILE_VERSIONS_SUCCESS', payload: versions });
}

async function restoreFileVersion({ fileId, versionId }) {
    const version = await db.fileVersions.get(versionId);
    if (version && version.fileId === fileId) {
        await db.files.update(fileId, { encryptedData: version.encryptedData, size: version.size });
        await logAccess(fileId, null, 'RESTORE_VERSION', 'user1');
        const file = await db.files.get(fileId);
        const files = await db.files.where({ path: file.path, isDeleted: 0 }).toArray();
        worker.postMessage({ type: 'RESTORE_FILE_VERSION_SUCCESS', payload: files });
    } else {
        worker.postMessage({ type: 'ERROR', payload: { code: 2022, message: 'Version not found' } });
    }
}

async function getAccessLogs({ fileId, folderId }) {
    let logs;
    if (fileId) {
        logs = await db.accessLogs.where({ fileId }).toArray();
    } else if (folderId) {
        logs = await db.accessLogs.where({ folderId }).toArray();
    } else {
        logs = await db.accessLogs.toArray();
    }
    worker.postMessage({ type: 'GET_ACCESS_LOGS_SUCCESS', payload: logs });
}

async function batchOperate({ operations }) {
    const results = { successes: [], errors: [] };
    for (const op of operations) {
        try {
            switch (op.type) {
                case 'DELETE_FILE':
                    await deleteFile(op.payload);
                    results.successes.push({ id: op.payload.id, type: 'DELETE_FILE' });
                    break;
                case 'DELETE_FOLDER':
                    await deleteFolder(op.payload);
                    results.successes.push({ id: op.payload.id, type: 'DELETE_FOLDER' });
                    break;
                case 'ENCRYPT_FILE':
                    await encryptFile(op.payload);
                    results.successes.push({ id: op.payload.id, type: 'ENCRYPT_FILE' });
                    break;
                case 'DECRYPT_FILE':
                    await decryptFile(op.payload);
                    results.successes.push({ id: op.payload.id, type: 'DECRYPT_FILE' });
                    break;
                default:
                    results.errors.push({ id: op.payload.id, message: `Unknown batch operation: ${op.type}` });
            }
        } catch (error) {
            results.errors.push({ id: op.payload.id, message: error.message });
        }
    }
    worker.postMessage({ type: 'BATCH_OPERATE_SUCCESS', payload: results });
}

async function rotateKey({ oldKeyId, newKeyId, masterKey, config }) {
    const { Config, EncryptionAlgorithm, KdfAlgorithm } = await import('./crypto.js');
    const configObj = new Config(
        config.kdfTimeCost,
        config.kdfMemCost,
        config.kdfParallelism,
        EncryptionAlgorithm[config.algorithm],
        KdfAlgorithm[config.kdfAlgorithm],
        config.keyVersion
    );
    const newCryptoService = await CryptoService.new(masterKey, configObj);
    const files = await db.files.where({ keyId: oldKeyId }).toArray();
    const folders = await db.folders.where({ keyId: oldKeyId }).toArray();
    
    const batchData = files.filter(file => file.encryptedData).map(file => file.encryptedData);
    const context = new Uint8Array(new TextEncoder().encode('key_rotation'));
    const batchResult = await cryptoService.batch_decrypt(
        batchData,
        context,
        null,
        async (progress) => {
                worker.postMessage({
                    type: 'KEY_ROTATION_PROGRESS',
                    payload: { percent: progress }
                });
            },
            1024 * 1024 * 100
    );
    
    for (let i = 0; i < files.length; i++) {
        if (i < batchResult.successes.length) {
            const newEncrypted = await newCryptoService.encrypt(batchResult.successes[i], context, null);
            await db.files.update(files[i].id, { encryptedData: newEncrypted, keyId: newKeyId });
            await db.fileVersions.add({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                fileId: files[i].id,
                version: (await db.fileVersions.where({ fileId: files[i].id }).count()) + 1,
                createdAt: Date.now(),
                size: files[i].size,
                encryptedData: newEncrypted,
                keyId: newKeyId
            });
        }
    }
    
    await db.folders.where({ keyId: oldKeyId }).modify({ keyId: newKeyId });
    await db.encryptionKeys.add({
        id: newKeyId,
        version: config.keyVersion,
        createdAt: Date.now()
    });
    await logAccess(null, null, 'ROTATE_KEY', 'user1');
    if (batchResult.errors.length > 0) {
        worker.postMessage({ type: 'ERROR', payload: { code: 2023, message: `Key rotation errors: ${batchResult.errors.join(', ')}` } });
    }
    worker.postMessage({ type: 'ROTATE_KEY_SUCCESS', payload: { newKeyId } });
}

async function checkAccess({ fileId, folderId, userId, action }) {
    const logs = await db.accessLogs
        .where(fileId ? { fileId } : { folderId })
        .filter(log => log.action === action && log.userId === userId)
        .toArray();
    worker.postMessage({ type: 'CHECK_ACCESS_SUCCESS', payload: { hasAccess: logs.length > 0 } });
}

async function logAccess(fileId, folderId, action, userId) {
    await db.accessLogs.add({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        fileId,
        folderId,
        action,
        timestamp: Date.now(),
        userId
    });
}

async function getStorage() {
    const files = await db.files.where({ isDeleted: 0 }).toArray();
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const totalStorage = 10 * 1024 * 1024 * 1024;
    const percent = (totalSize / totalStorage) * 100;
    worker.postMessage({ type: 'GET_STORAGE_SUCCESS', payload: { totalSize, percent } });
}