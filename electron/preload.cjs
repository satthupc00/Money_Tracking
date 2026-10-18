// Cầu nối an toàn giữa giao diện (renderer) và Electron
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mondiro', {
  isElectron: true,
  update: {
    check: () => ipcRenderer.invoke('update-check'),
    download: () => ipcRenderer.invoke('update-download'),
    install: () => ipcRenderer.send('update-install'),
    onProgress: (cb) => {
      const h = (_e, p) => cb(p);
      ipcRenderer.on('update-progress', h);
      return () => ipcRenderer.removeListener('update-progress', h);
    },
  },
});
