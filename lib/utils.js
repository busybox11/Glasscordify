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
const https = require("https");
const fs = require("fs");
const asar = require("asar");
const rimraf = require("rimraf");
const rootApps = require("./root_applications.json");

class Utils{
	static httpsGet(url, options, callback){
		https.get(url, options, result => {
			if(result.statusCode == 301 || result.statusCode == 302){
				get(result.headers.location, options, callback);
				return;
			}
			let data = "";
			result.on("data", chunk => data += chunk);
			result.on("end", () => {
				result.data = data;
				callback(result);
			});
		});
	}

	static isGlasscordDownloaded(){
		const _path = path.join(this.getConfigPath(), "glasscord", "_bin", "glasscord.asar");
		return fs.existsSync(_path);
	}

	static async downloadGlasscordAsar(){
		let promise = await new Promise((resolve, reject) => {
			// CALL TO THE GITHUB RELEASES API
			this.httpsGet("https://api.github.com/repos/AryToNeX/Glasscord/releases/latest", {headers: {"user-agent": "glasscordify"}}, result => {
				// Let's check the error
				if(result.statusCode != 200)
					return resolve(false);

				data = JSON.parse(result.data);
				// Let's traverse the assets array to find our object!
				let url;
				for(let asset of data.assets){
					if(asset.name == "glasscord.asar"){
						url = asset.browser_download_url;
						break;
					}
				}

				// Let's download it!
				this.httpsGet(url, {headers: {"user-agent": "glasscordify"}}, result => {
					// Again, let"s check for errors
					if(result.statusCode != 200)
						return resolve(false);

					// Save data
					fs.writeFileSync(path.join(this.getConfigPath(), "glasscord", "_bin", "glasscord.asar"), result.data);
					return resolve(true);
				});
			});
		}
		return promise;
	}

	static getHomeDirectory(){
		const username = process.env.LOGNAME || process.env.USER || process.env.LNAME || process.env.USERNAME;
		switch(process.platform){
			case "win32":
				return process.env.USERPROFILE || process.env.HOMEDRIVE + process.env.HOMEPATH || process.env.HOME || undefined;
			case "linux":
				return process.env.HOME || (process.getuid() === 0 ? "/root" : (username ? ("/home/" + username) : undefined));
			case "darwin":
				return process.env.HOME || (username ? ("/Users/" + username) : undefined);
			default:
				return process.env.HOME || undefined;
		}
	}

	static getConfigPath(){
		switch(process.platform){
			case "win32";
				return path.resolve(process.env.APPDATA) || path.resolve(this.getHomeDirectory(), "AppData", "Roaming");
			case "linux":
			default:
				return path.resolve(process.env.XDG_CONFIG_HOME) || path.resolve(this.getHomeDirectory(), ".config");
			case "darwin";
				return path.resolve(this.getHomeDirectory(), "Library", "Application Support");
		}
	}

	static linkGlasscordToAppPath(_appPath, shim = undefined){
		const glasscordPath = path.join(this.getConfigPath(), "glasscord", "_bin", "glasscord.asar");
		
		let linkPath = path.join(_appPath, "glasscord.asar");
		
		if(fs.existsSync(linkPath)) return false;
		fs.linkSync(glasscordPath, linkPath);
		
		if(typeof shim !== undefined){
			linkPath = path.join(_appPath, "glasscord_shim.js");
			fs.writeFileSync(linkPath, shim.replace("{GLASSCORD_ASAR_LOCATION}", "./glasscord.asar"));
		}
		return linkPath;
	}

	static unlinkGlasscordFromAppPath(_appPath){
		const glasscordPath = path.join(_appPath, "glasscord.asar");
		const shimPath = path.join(_appPath, "glasscord_shim.js");

		if(!fs.existsSync(glasscordPath)) return false;

		fs.unlinkSync(glasscordPath);
		if(fs.existsSync(shimPath)) fs.unlinkSync(shimPath);
		return true;
	}

	static patchMainFile(_mainFile, _glasscordPath){
		if(isMainFilePatched(_mainFile)) return false;

		const _relativeToMain = path.relative(path.dirname(_mainFile), _glasscordPath);
		const _require = `// GLASSCORD BEGIN\nrequire("${_relativeToMain}");\n// GLASSCORD END\n`;
		const newFile = _require + fs.readFileSync(_mainFile);
		fs.writeFileSync(_mainFile, newFile);
		return true;
	}

	static revertMainFile(_mainFile){
		if(isMainFilePatched(_mainFile)){
			const oldFile = fs.readFileSync(_mainFile);
			fs.writeFileSync(_mainFile, oldFile.replace(/^\/\/ GLASSCORD BEGIN\nrequire\(.*\);\n\/\/ GLASSCORD END\n/, ""));
			return true;
		}
		return false;
	}

	static isMainFilePatched(_mainFile){
		const file = fs.readFileSync(_mainFile);
		return file.match(/^\/\/ GLASSCORD BEGIN\nrequire\(.*\);\n\/\/ GLASSCORD END\n/) !== null;
	}

	static determineMainFile(_appPath){
		const pak = require(path.resolve(_appPath, "package.json"));
		return pak.main;
	}

	static determineAppName(_appPath){
		const pak = require(path.resolve(_appPath, "package.json"));
		return pak.name;
	}

	static determineRootAppName(_appName){
		for(let rootAppName in rootApps)
			for(let possibleCurrentApp of rootApps[rootAppName])
				if(_appName === possibleCurrentApp) return rootAppName;
		return _appName;
	}

	static getShim(appName){
		const filePath = path.join(__dirname, "shims", appName + ".js");
		if(fs.existsSync(filePath)) return fs.readFileSync(filePath);
		return undefined;
	}

	static determineIfGlasstronApp(_appPath){
		const pak = require(path.resolve(_appPath, "package.json"));
		return (pak.dependencies.hasOwnProperty("glasstron") || pak.devDependencies.hasOwnProperty("glasstron"))
	}

	static determineAppType(_resourcesPath){
		if(fs.existsSync(path.join(_resourcesPath, "_app"))) return "asar:patched";
		if(fs.existsSync(path.join(_resourcesPath, "app"))) return "folder";
		if(fs.existsSync(path.join(_resourcesPath, "app.asar"))) return "asar";
		if(fs.existsSync(path.join(_resourcesPath, "app.js"))) return "js";
		return false;
	}

	static extractAsar(_resourcesPath){
		fs.mkdirSync(path.join(_resourcesPath, "_app"));
		fs.renameSync(path.join(_resourcesPath, "app.asar"), path.join(_resourcesPath, "_app", "app.asar"));
		if(fs.existsSync(path.join(_resourcesPath, "app.asar.unpacked")))
			fs.renameSync(path.join(_resourcesPath, "app.asar.unpacked"), path.join(_resourcesPath, "_app", "app.asar.unpacked"));
		asar.extractAll(path.resolve(_resourcesPath, "_app", "app.asar"), path.resolve(_resourcesPath, "app"));
		return true;
	}

	static revertAsarPatching(_resourcesPath){
		if(fs.existsSync(path.join(_resourcesPath, "_app"))){
			fs.renameSync(path.join(_resourcesPath, "app"), path.join(_resourcesPath, "app.delete"));
			fs.renameSync(path.join(_resourcesPath, "_app", "app.asar"), path.join(_resourcesPath, "app.asar"));
			if(fs.existsSync(path.join(_resourcesPath, "_app", "app.asar.unpacked")))
				fs.renameSync(path.join(_resourcesPath, "_app", "app.asar.unpacked"), path.join(_resourcesPath, "app.asar.unpacked"));
			rimraf.sync(path.join(_resourcesPath, "_app"), {glob: false});
			rimraf.sync(path.join(_resourcesPath, "app.delete"), {glob: false});
			return true;
		}
		return false;
	}

}

module.exports = Utils;
