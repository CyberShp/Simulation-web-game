const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  if (typeof callback !== 'function') throw new TypeError('Event callback is required');
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('sectHost', {
  settings: () => ipcRenderer.invoke('sect:settings'),
  load: () => ipcRenderer.invoke('sect:load'),
  save: state => ipcRenderer.invoke('sect:save', state),
  exportRecovery: state => ipcRenderer.invoke('sect:export-recovery', state),
  previewRecovery: () => ipcRenderer.invoke('sect:preview-recovery'),
  cancelRecovery: () => ipcRenderer.invoke('sect:cancel-recovery'),
  restoreRecovery: request => ipcRenderer.invoke('sect:restore-recovery', request),
  exitRecovery: state => ipcRenderer.invoke('sect:exit-recovery', state),
  onActivity: callback => subscribe('sect:activity', callback),
  onPower: callback => subscribe('sect:power', callback),
  onClosing: callback => subscribe('sect:closing', callback),
  closeReady: () => ipcRenderer.invoke('sect:close-ready'),
  cancelClose: () => ipcRenderer.invoke('sect:cancel-close')
});

contextBridge.exposeInMainWorld('sceneHost', {
  settings: () => ipcRenderer.invoke('scene:settings'),
  capture: name => ipcRenderer.invoke('scene:capture', name),
  metrics: data => ipcRenderer.invoke('scene:metrics', data),
  recording: data => ipcRenderer.invoke('scene:recording', data),
  windowControl: action => ipcRenderer.invoke('scene:window-control', action),
  finish: options => ipcRenderer.invoke('scene:finish', options)
});
