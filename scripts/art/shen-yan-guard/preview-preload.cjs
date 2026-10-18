const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('guardPreview', {
  load: () => ipcRenderer.invoke('guard-preview:boot'),
  capture: name => ipcRenderer.invoke('guard-preview:capture', name),
});
