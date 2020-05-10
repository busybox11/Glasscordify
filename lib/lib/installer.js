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

	static async install(_appExecutablePath, _skipElectronVersionCheck = false){
		let promise = await new Promise((resolve, reject) => {
			if(!Utils.isGlasscordDownloaded())
				Utils.downloadGlasscordAsar().then((result) => {
					if(result) resolve(this._installRoutine(_appExecutablePath, undefined, _skipElectronVersionCheck));
					else resolve({error: "Unable to download Glasscord"});
				});
			else
				resolve(this._installRoutine(_appExecutablePath, undefined, _skipElectronVersionCheck));
		});
		return promise;
	}

	static async uninstall(_appExecutablePath){
		return Promise.resolve(this._uninstallRoutine(_appExecutablePath));
	}

	static _installRoutine(_appExecutablePath, app = undefined, _skipElectronVersionCheck = false){
		if(typeof app === "undefined") app = this.checkApp(_appExecutablePath, _skipElectronVersionCheck);
		if(app.error) return app;
		if(app.isPatched) return {error: "App is already patched"};
		if(!_skipElectronVersionCheck){
			const isSupported = Utils.isElectronVersionSupported(app.electronVersion);

			let error = false
			if(typeof isSupported === "undefined") error = {error: "Unable to determine Electron version"};
			if(!isSupported) error = {error: "Electron version is not supported"};

			if(error !== false){
				if(app.appPathType === "asar")
					fs.removeSync(path.join(app.resourcesPath, "app.gcextracted"));
				return error;
			}
		}
		
		if(app.isBlacklisted){
			if(app.appPathType === "asar")
				fs.removeSync(path.join(app.resourcesPath, "app.gcextracted"));
			return {error: "App is blacklisted"};
		}
		
		const shim = Utils.getShim(app.rootAppName);
		const glasscordPath = Utils.linkGlasscordToAppPath(app.appPath, shim);
		if(Utils.patchMainFile(app.mainFile, glasscordPath)) return {success: true};
		return {error: "Unable to patch the application"};
	}

	static _uninstallRoutine(_appExecutablePath, app = undefined){
		if(typeof app === "undefined") app = this.checkApp(_appExecutablePath, true);
		if(app.error) return app;
		if(!app.isPatched) return {error: "App is not patched"};

		Utils.unlinkGlasscordFromAppPath(app.appPath);
		Utils.revertMainFile(app.mainFile);
		return {success: true};
	}

	static checkApp(_appExecutablePath, _skipElectronVersionCheck = false){
		const appRootPath = Utils.getAppRootPath(_appExecutablePath);
		const resourcesPath = Utils.getResourcesPath(appRootPath);
		const appPathType = Utils.determineAppType(resourcesPath);
		
		if(!appPathType) return {error: "App path not found"};
		
		let electronVersion = undefined;
		if(!_skipElectronVersionCheck)
			electronVersion = Utils.getElectronVersion(_appExecutablePath);

		let appPath, mainFile, appName, rootAppName, isPatched;
		switch(appPathType.split(":")[0]){
			case "js":
				appPath = resourcesPath;
				mainFile = path.join(resourcesPath, "app.js");
				appName = "app";
				rootAppName = "app";
				break;
			case "asar":
				if(appPathType === "asar:patched")
					isPatched = true;
				else
					if(!Utils.extractAsar(resourcesPath))
						return {error: "Problem upon extracting of app.asar"};
			case "folder":
				appPath = path.join(resourcesPath, "app");
				mainFile = Utils.determineMainFile(appPath);
				appName = Utils.determineAppName(appPath);
				rootAppName = Utils.determineRootAppName(appName);
				break;
		}
		
		isPatched = isPatched || Utils.isMainFilePatched(mainFile);
		
		return {
			appPath: appPath,
			appPathType: appPathType.split(":")[0],
			appRootPath: appRootPath,
			resourcesPath: resourcesPath,
			appName: appName,
			rootAppName: rootAppName,
			mainFile: mainFile,
			isPatched: isPatched,
			isBlacklisted: Utils.isAppBlacklisted(rootAppName),
			electronVersion: electronVersion
		}
	}
}

module.exports = Installer;
