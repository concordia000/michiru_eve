
const electron = require('electron')
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
// Module to communicate with renderer process
const path = require('path');
const url = require('url');
const fs = require('fs');
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({ transparent: true,frame: false, width: 480, height: 800 })

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  //mainWindow.setMenu(null);//Fuck menu bars

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
var config;
fs.readFile('./config.json', (err, data) => {
  try{
    if (err) {
      throw err;
    }else{
      config = JSON.parse(data);
    }
  }catch(e){
    config = { logFolder: '', watchLocal: true, watchGame: false, intelChannels: ['delve.imperium', 'querious.imperium'], warningRange: 3, dangerRange: 1 };
  }
});
var logMonAgent = require('./logmon.js');
logMonAgent.on('mapInit', () => {
  //reserved
});
logMonAgent.on("intelUpdate", (data) => {
  console.log(data.msg);
  mainWindow.webContents.send('intelUpdate',data);
});
logMonAgent.on("pilotUpdate", (data) => {
  console.log(data.msg);
  mainWindow.webContents.send('pilotUpdate',data);
});

ipcMain.on('monitor-start',()=>{
  logMonAgent.emit('start',config);
  mainWindow.webContents.send('init',config);
});
ipcMain.on('monitor-stop',()=>{
  console.log('Monitoring stopped');
  logMonAgent.emit('stop');
});
