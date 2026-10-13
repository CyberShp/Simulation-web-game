const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sceneHost', {
  settings: () => ipcRenderer.invoke('scene:settings'),
  capture: name => ipcRenderer.invoke('scene:capture', name),
  metrics: data => ipcRenderer.invoke('scene:metrics', data),
  recording: data => ipcRenderer.invoke('scene:recording', data),
  finish: options => ipcRenderer.invoke('scene:finish', options)
});

const subscribe = (channel, callback) => {
  if (typeof callback !== 'function') throw new TypeError('Event callback is required');
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('arenaHost', {
  settings: () => ipcRenderer.invoke('arena:settings'),
  load: () => ipcRenderer.invoke('arena:load'),
  save: state => ipcRenderer.invoke('arena:save', state),
  onActivity: callback => subscribe('arena:activity', callback),
  onClosing: callback => subscribe('arena:closing', callback),
  closeReady: () => ipcRenderer.invoke('arena:close-ready')
});
