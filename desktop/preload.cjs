// What the pages inside the R62D program may ask the program to do (window.r62dApp).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('r62dApp', {
  host: () => ipcRenderer.invoke('host'),
  join: addr => ipcRenderer.invoke('join', addr),
  info: () => ipcRenderer.invoke('info'),
  quit: () => ipcRenderer.invoke('quit'),
  menu: () => ipcRenderer.invoke('menu'),
});
