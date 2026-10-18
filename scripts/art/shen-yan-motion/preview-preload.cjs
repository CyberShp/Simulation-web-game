const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('motionPreview', { load: () => ipcRenderer.invoke('motion-preview:boot') });
