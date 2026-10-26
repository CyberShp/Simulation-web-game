const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('showcaseHost', {
  settings: () => ipcRenderer.invoke('showcase:settings'),
  capture: name => ipcRenderer.invoke('showcase:capture', name),
  recording: data => ipcRenderer.invoke('showcase:recording', data),
  metrics: data => ipcRenderer.invoke('showcase:metrics', data),
  next: () => ipcRenderer.invoke('showcase:next'),
  finish: options => ipcRenderer.invoke('showcase:finish', options)
});
