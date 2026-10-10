import { contextBridge, ipcRenderer } from 'electron';
import { DesktopApi } from '../shared/desktop-contracts';
const api: DesktopApi = {
  desktop: {
    selectFolder: () => ipcRenderer.invoke('desktop:select-folder'),
    openFolder: (path) => ipcRenderer.invoke('desktop:open-folder', path),
    showFile: (path) => ipcRenderer.invoke('desktop:show-file', path),
  },
  files: {
    createAlbum: (parent, name) => ipcRenderer.invoke('files:create-album', parent, name),
    fileExists: (path) => ipcRenderer.invoke('files:exists', path),
    getPreviewUrl: (path) => ipcRenderer.invoke('files:preview', path),
    trashAlbum: (path) => ipcRenderer.invoke('files:trash-album', path),
    trashPhoto: (path, page, photo, groupByPage) =>
      ipcRenderer.invoke('files:trash-photo', path, page, photo, groupByPage),
  },
  scanner: {
    getDevices: (mode) => ipcRenderer.invoke('scanner:get-devices', mode),
    scan: (request) => ipcRenderer.invoke('scanner:scan', request),
    cancel: () => ipcRenderer.invoke('scanner:cancel'),
    availableModes: () => ipcRenderer.invoke('scanner:available-modes'),
  },
};
contextBridge.exposeInMainWorld('desktop', api.desktop);
contextBridge.exposeInMainWorld('files', api.files);
contextBridge.exposeInMainWorld('scanner', api.scanner);
