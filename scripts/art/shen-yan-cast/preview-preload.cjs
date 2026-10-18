const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('castPreview', {
  load: () => ipcRenderer.invoke('cast-preview:boot'),
  capture: name => ipcRenderer.invoke('cast-preview:capture', name),
});
