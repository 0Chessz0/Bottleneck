import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('bottleneck', Object.fromEntries(['scan','search','game','export','estimate','deviceResults','openDataSource','publicBenchmarks','openResearch','openBenchmarkSource'].map(name => [name, (...args: unknown[]) => ipcRenderer.invoke(name, ...args)])));
