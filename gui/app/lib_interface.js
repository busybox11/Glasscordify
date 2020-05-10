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
		console.log("install drop", files);
	}
	
	static uninstallDrop(win, files){
		console.log("uninstall drop", files);
	}
	
	static installClicked(win){
		console.log("install clicked");
	}
	
	static uninstallClicked(win){
		console.log("uninstall clicked");
	}
	
}
