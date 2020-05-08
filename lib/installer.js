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

const Utils = require("./utils.js");
const fs = require("fs-extra");

class Installer{

	static async install(_resourcesPath){
		let promise = await new Promise((resolve, reject) => {
			if(!Utils.isGlasscordDownloaded())
				Utils.downloadGlasscordAsar().then((result) => {
					if(result) resolve(this._installRoutine(_resourcesPath));
					else resolve({error: "Unable to download Glasscord"});
				});
			else
				resolve(this._installRoutine(_resourcesPath));
		});
		return promise;
	}

	static async uninstall(_resourcesPath){
		return Promise.resolve(this._uninstallRoutine(_resourcesPath));
	}

	static _installRoutine(_resourcesPath){
		const app = this._checkApp(_resourcesPath);
		if(app.error) return app;
		if(app.isPatched) return {error: "App is already patched"};
		
		if(app.isBlacklisted){
			fs.removeSync(path.join(_resourcesPath, "app.gcextracted"));
			return {error: "App is blacklisted"};
		}
		
		const shim = Utils.getShim(app.rootAppName);
		const glasscordPath = Utils.linkGlasscordToAppPath(app.appPath, shim);
		if(Utils.patchMainFile(app.mainFile, glasscordPath)) return {success: true};
		return {error: "Unable to patch the application"};
	}

	static _uninstallRoutine(_resourcesPath){
		const app = this._checkApp(_resourcesPath);
		if(app.error) return app;
		if(!app.isPatched) return {error: "App is not patched"};

		Utils.unlinkGlasscordFromAppPath(app.appPath);
		Utils.revertMainFile(app.mainFile);
		return {success: true};
	}

	static _checkApp(_resourcesPath){
		const appPathType = Utils.determineAppType(_resourcesPath);
		
		if(!appPathType) return {error: "App path not found"};

		let appPath, mainFile, appName, rootAppName, isPatched;
		switch(appPathType.split(":")[0]){
			case "js":
				appPath = _resourcesPath;
				mainFile = path.join(_resourcesPath, "app.js");
				appName = "app";
				rootAppName = "app";
				break;
			case "asar":
				if(appPathType === "asar:patched")
					isPatched = true;
				else
					if(!Utils.extractAsar(_resourcesPath))
						return {error: "Problem upon extracting of app.asar"};
			case "folder":
				appPath = path.join(_resourcesPath, "app");
				mainFile = Utils.determineMainFile(appPath);
				appName = Utils.determineAppName(appPath);
				rootAppName = Utils.determineRootAppName(appName);
				break;
		}
		
		isPatched = isPatched || Utils.isMainFilePatched(mainFile);
		
		return {
			appPath: appPath,
			appName: appName,
			rootAppName: rootAppName,
			mainFile: mainFile,
			isPatched: isPatched,
			isBlacklisted: Utils.isAppBlacklisted(rootAppName)
		}
	}
}

module.exports = Installer;
