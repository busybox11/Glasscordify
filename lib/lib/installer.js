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

	static install(_appExecutablePath, app){
		if(app.error) return app;
		if(app.isPatched) return {error: "App is already patched"};

		if(typeof app.electronVersion !== "undefined"){
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

	static uninstall(_appExecutablePath, app){
		if(app.error) return app;
		if(!app.isPatched) return {error: "App is not patched"};

		Utils.unlinkGlasscordFromAppPath(app.appPath);
		Utils.revertMainFile(app.mainFile);
		return {success: true};
	}

	static checkApp(_appExecutablePath, options = {electronVersion: true}){
		let result = {}
		result.appRootPath = Utils.getAppRootPath(_appExecutablePath);
		result.resourcesPath = Utils.getResourcesPath(appRootPath);
		result.appPathType = Utils.determineAppType(resourcesPath);
		
		if(!result.appPathType) return {error: "App path not found"};
		
		if(options.electronVersion)
			result.electronVersion = Utils.getElectronVersion(_appExecutablePath);

		switch(result.appPathType.split(":")[0]){
			case "js":
				result.appPath = result.resourcesPath;
				result.mainFile = path.join(result.resourcesPath, "app.js");
				result.appName = "app";
				result.rootAppName = "app";
				break;
			case "asar":
				if(result.appPathType === "asar:patched"){
					result.isPatched = true;
					result.appPathType = "asar";
				}
				else
					if(!Utils.extractAsar(result.resourcesPath))
						return {error: "Problem upon extracting of app.asar"};
			case "folder":
				result.appPath = path.join(result.resourcesPath, "app");
				result.mainFile = Utils.determineMainFile(result.appPath);
				result.appName = Utils.determineAppName(result.appPath);
				result.rootAppName = Utils.determineRootAppName(result.appName);
				break;
		}
		
		result.isPatched = result.isPatched || Utils.isMainFilePatched(mainFile);
		
		return result;
	}
}

module.exports = Installer;
