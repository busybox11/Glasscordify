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

const path = require("path");
const electron = require("electron");
const lib = require("glasscordify-lib");

module.exports = class LibInterface {
	
	static init(win){
		if(!lib.Utils.isGlasscordDownloaded()){
			win.webContents.send("asar-download");
			console.log("Downloading asar!");
			lib.Utils.downloadGlasscordAsar().then((result) => {
				if(result){
					console.log("Download successful");
					win.webContents.send("asar-success");
				}else{
					console.log("Download failed");
					win.webContents.send("asar-failure");
				}
			});
		}
	}
	
	static installDrop(win, files){
		files = this.dropFilter(files);
		if(files.length !== 0)
			return this.install(files[0]);
		win.webContents.send("error", "You didn't drag/drop the correct file!");
		return false;
	}
	
	static uninstallDrop(win, files){
		files = this.dropFilter(files);
		if(files.length !== 0)
			return this.uninstall(files[0]);
		win.webContents.send("error", "You didn't drag/drop the correct file!");
		return false;
	}
	
	static installClicked(win){
		const files = electron.dialog.showOpenDialogSync(win, {
			title: "Glasscordify - Please choose the application you want to patch",
			properties: ["openFile", "dontAddToRecent"],
			filters: [
				{ name: "Applications or links to them", extensions: ["*"]} // We can't filter for Linux executables #blameElectron
			]
		});
		if(typeof files !== "undefined")
			return this.install(win, files[0]);
		
		win.webContents.send("error", "You didn't select any file!");
		return false;
	}
	
	static uninstallClicked(win){
		const files = electron.dialog.showOpenDialogSync(win, {
			title: "Glasscordify - Please choose the application you want to restore",
			properties: ["openFile", "dontAddToRecent"],
			filters: [
				{ name: "Applications or links to them", extensions: ["*"]} // We can't filter for Linux executables #blameElectron
			]
		});
		if(typeof files !== "undefined")
			return this.uninstall(win, files[0]);
		
		win.webContents.send("error", "You didn't select any file!");
		return false;
	}
	
	static dropFilter(files){
		return files.filter((x) => {
			return ["",".exe",".desktop",".app",".lnk"].includes(path.extname(x))
		});
	}
	
	static async install(win, executableFile){
		win.webContents.send("install-checking-app");
		// Resolve the executable path
		executableFile = await lib.Utils.getAbsoluteExecutableFile(executableFile);
		if(typeof executableFile === "undefined"){
			win.webContents.send("error", "Given file is not valid!");
			return false;
		}
		const app = lib.Installer.checkApp(executableFile);
		if(app.error){
			win.webContents.send("error", app.error);
			return false;
		}
		
		const result = lib.Utils.install(app);
		if(result.error){
			win.webContents.send("error", result.error);
			return false;
		}
		
		if(app.appPathType === "asar"){ // we worked in our temp dir!
			lib.Utils.moveAsarToBackupFolder(app.resourcesPath);
			lib.Utils.commitAsarExtraction(app.resourcesPath);
		}
		
		win.webContents.send("install-success");
		return true;
	}
	
	static async uninstall(win, executableFile){
		win.webContents.send("uninstall-checking-app");
		// Resolve the executable path
		executableFile = await lib.Utils.getAbsoluteExecutableFile(executableFile);
		if(typeof executableFile === "undefined"){
			win.webContents.send("error", "Given file is not valid!");
			return false;
		}
		const app = lib.Installer.checkApp(executableFile);
		if(app.error){
			win.webContents.send("error", app.error);
			return false;
		}
		
		if(app.appPathType === "asar:patched"){ // we can easily "unpatch" this
			if(!lib.Utils.revertAsarPatching(app.resourcesPath)){
				win.webContents.send("error", "Couldn't revert changes to the app!");
				return false;
			}
			win.webContents.send("uninstall-success");
			return true;
		}
		
		// other patch types
		
		const result = lib.Utils.uninstall(app);
		if(result.error){
			win.webContents.send("error", result.error);
			return false;
		}
		
		win.webContents.send("uninstall-success");
		return true;
	}
	
}
