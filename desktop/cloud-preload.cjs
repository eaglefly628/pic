const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('picCloud',{info:()=>ipcRenderer.invoke('pic-cloud-info'),setup:options=>ipcRenderer.invoke('pic-cloud-setup',options),sync:()=>ipcRenderer.invoke('pic-cloud-sync')});
