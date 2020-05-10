/*
   Copyright 2020 AryToNeX

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
"use strict";

const glasstron = require('glasstron');
glasstron.init(); // THIS should be called before we require the BrowserWindow class

const electron = require("electron");
const exec = require("child_process").execSync;
const lib = require("./lib_interface.js");

// Check if an instance is already running
if (!electron.app.requestSingleInstanceLock()){
	electron.app.quit();
}

var win;

electron.app.allowRendererProcessReuse = true;

electron.app.on("ready", (e) => createWindow());

electron.app.on('activate', () => {
	if(electron.BrowserWindow.getAllWindows().length === 0)
		createWindow();
	else
		electron.BrowserWindow.getAllWindows()[0].show();
});

electron.app.on('second-instance', (e, commandLine, workingDirectory) => {
	// Someone tried to run a second instance, we should focus our window.
	if (win){
		if (win.isMinimized()) win.restore();
		win.show();
		win.focus();
	}
});

function createWindow(){
	win = new electron.BrowserWindow({
		width: 1280,
		height: 720,
		center: true,
		resizable: false,
		frame: false,
		fullscreenable: false,
		maximizable: false,
		title: "Glasscordify",
		show: true,
		backgroundColor: "#A0FFFFFF",
		webPreferences: {
			nodeIntegration: true
		}
	});
	
	win.webContents.on('new-window', function(e, url){
		e.preventDefault();
		openExternal(url);
	});
	
	win.webContents.on('will-navigate', function(e, url){
		e.preventDefault();
		openExternal(url);
	});
	
	glasstron.update(win, {
		windows: {
			blurType: 'blurbehind',
		},
		linux: {
			requestBlur: true
		},
		macos: {
			vibrancy: 'fullscreen-ui'
		}
	});
	
	// events
	electron.ipcMain.on("close", () => win.close());
	electron.ipcMain.on("minimize", () => win.minimize());
	electron.ipcMain.on("installClicked", () => lib.installClicked());
	electron.ipcMain.on("uninstallClicked", () => lib.uninstallClicked());
	electron.ipcMain.on("installDrop", (e,files) => lib.installDrop(files));
	electron.ipcMain.on("uninstallDrop", (e,files) => lib.uninstallDrop(files));
	
	win.loadURL("file://" + __dirname + "/resources/index.html");
}

function openExternal(url){
	const cmd = () => {switch(process.platform){
		case "win32": return "start " + url;
		case "darwin": return "open " + url;
		case "linux": return "xdg-open " + url;
	}};
	return exec(cmd());
}
