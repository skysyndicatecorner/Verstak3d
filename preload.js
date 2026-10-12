// Верстак 3D — безопасный мост между окном и системой (только нужные функции). Лицензия MIT.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  saveDialog: opts => ipcRenderer.invoke('save-dialog', opts),
  openDialog: opts => ipcRenderer.invoke('open-dialog', opts),
  readFile: p => ipcRenderer.invoke('read-file', p),
  writeFile: (p, data) => ipcRenderer.invoke('write-file', { path: p, data }),
  initialFile: () => ipcRenderer.invoke('initial-file'),
  info: () => ipcRenderer.invoke('app-info'),
  setDirty: v => ipcRenderer.send('dirty', v),
  setTitle: t => ipcRenderer.send('title', t),
  closeOk: () => ipcRenderer.send('close-ok'),
  onMenu: cb => ipcRenderer.on('menu', (_e, cmd) => cb(cmd)),
  onOpenFile: cb => ipcRenderer.on('open-file', (_e, p) => cb(p)),
});
