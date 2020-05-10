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
const fs = require("fs-extra");
const os = require("os");
const asar = require("asar");
const glob = require("glob");
const winShortcut = require("windows-shortcut-ps");
const traverser = require("./traverser.js");
const rootApps = require("./root_applications.json");
const appBlacklist = require("./blacklist.json");

const minElectronVersion = "7.1.0";

class Utils{
	static httpsGet(url, options, callback){
		https.get(url, options, result => {
			if(result.statusCode == 301 || result.statusCode == 302){
				httpsGet(result.headers.location, options, callback);
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
		const _path = path.resolve(this.getConfigPath(), "glasscord", "_bin", "glasscord.asar");
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
					fs.writeFileSync(path.resolve(this.getConfigPath(), "glasscord", "_bin", "glasscord.asar"), result.data);
					return resolve(true);
				});
			});
		});
		return promise;
	}

	static getConfigPath(){
		switch(process.platform){
			case "win32":
				return path.resolve(process.env.APPDATA) || path.resolve(os.homedir(), "AppData", "Roaming");
			case "linux":
			default:
				return path.resolve(process.env.XDG_CONFIG_HOME) || path.resolve(os.homedir(), ".config");
			case "darwin":
				return path.resolve(os.homedir(), "Library", "Application Support");
		}
	}

	static linkGlasscordToAppPath(_appPath, shim = undefined){
		const glasscordPath = path.resolve(this.getConfigPath(), "glasscord", "_bin", "glasscord.asar");
		
		let linkPath = path.resolve(_appPath, "glasscord.asar");
		
		if(fs.existsSync(linkPath)) return false;
		fs.linkSync(glasscordPath, linkPath);
		
		if(typeof shim !== undefined){
			linkPath = path.resolve(_appPath, "glasscord_shim.js");
			fs.writeFileSync(linkPath, shim.replace("{GLASSCORD_ASAR_LOCATION}", "./glasscord.asar"));
		}
		return linkPath;
	}

	static unlinkGlasscordFromAppPath(_appPath){
		const glasscordPath = path.resolve(_appPath, "glasscord.asar");
		const shimPath = path.resolve(_appPath, "glasscord_shim.js");

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

	static isAppBlacklisted(_rootAppName){
		return appBlacklist.includes(_rootAppName);
	}

	static getShim(appName){
		const filePath = path.resolve(__dirname, "shims", appName + ".js");
		if(fs.existsSync(filePath)) return fs.readFileSync(filePath);
		return undefined;
	}

	static determineIfGlasstronApp(_appPath){
		const pak = require(path.resolve(_appPath, "package.json"));
		return (pak.dependencies.hasOwnProperty("glasstron") || pak.devDependencies.hasOwnProperty("glasstron"))
	}

	static determineAppType(_resourcesPath){
		if(fs.existsSync(path.resolve(_resourcesPath, "_app"))) return "asar:patched";
		if(fs.existsSync(path.resolve(_resourcesPath, "app"))) return "folder";
		if(fs.existsSync(path.resolve(_resourcesPath, "app.asar"))) return "asar";
		if(fs.existsSync(path.resolve(_resourcesPath, "app.js"))) return "js";
		return false;
	}

	static extractAsar(_resourcesPath){
		asar.extractAll(path.resolve(_resourcesPath, "app.asar"), path.resolve(_resourcesPath, "app.gcextracted"));
		return true;
	}

	static moveAsarToBackupFolder(_resourcesPath){
		fs.mkdirSync(path.resolve(_resourcesPath, "_app"));
		fs.renameSync(path.resolve(_resourcesPath, "app.asar"), path.resolve(_resourcesPath, "_app", "app.asar"));
		if(fs.existsSync(path.resolve(_resourcesPath, "app.asar.unpacked")))
			fs.renameSync(path.resolve(_resourcesPath, "app.asar.unpacked"), path.resolve(_resourcesPath, "_app", "app.asar.unpacked"));
		if(fs.existsSync(path.resolve(_resourcesPath, "app")))
			fs.copySync(path.resolve(_resourcesPath, "app"), path.resolve(_resourcesPath, "_app", "app"));
		return true;
	}

	static commitAsarExtraction(_resourcesPath){
		fs.renameSync(path.resolve(_resourcesPath, "app"), path.resolve(_resourcesPath, "app.gcextracted"));
		return true;
	}

	static revertAsarPatching(_resourcesPath){
		if(fs.existsSync(path.resolve(_resourcesPath, "_app"))){
			fs.renameSync(path.resolve(_resourcesPath, "app"), path.resolve(_resourcesPath, "app.delete"));
			fs.renameSync(path.resolve(_resourcesPath, "_app", "app.asar"), path.resolve(_resourcesPath, "app.asar"));
			if(fs.existsSync(path.resolve(_resourcesPath, "_app", "app.asar.unpacked")))
				fs.renameSync(path.resolve(_resourcesPath, "_app", "app.asar.unpacked"), path.resolve(_resourcesPath, "app.asar.unpacked"));
			if(fs.existsSync(path.resolve(_resourcesPath, "app")))
				fs.renameSync(path.resolve(_resourcesPath, "_app", "app"), path.resolve(_resourcesPath, "app"));
			fs.removeSync(path.resolve(_resourcesPath, "_app"));
			fs.removeSync(path.resolve(_resourcesPath, "app.delete"));
			return true;
		}
		return false;
	}

	static getAppRootPath(_appExecutablePath){
		return path.resolve(_appExecutablePath, "..");
	}

	static getResourcesPath(_appRootPath){
		return path.resolve(_appRootPath, "resources");
	}

	static getAbsoluteExecutableFile(_probableLink){ // TODO: Testing and fixing
		const ext = path.extname(_probableLink);
		switch(ext){
			case "": // Linux executable
			case ".exe": // Windows executable
				return Promise.resolve(_probableLink);
			case ".desktop": // Linux desktop file
				const file = fs.readFileSync(_probableLink);
				let exec = file.match(/^Exec=(.*)/m);
				if(exec.length === 0) return Promise.resolve(undefined);

				if(path.isAbsolute(exec[1][1]))
					return Promise.resolve(exec[1][1]);

				let path = file.match(/^Path=(.*)/m);
				let paths = process.env.PATH.split(":");
				if(path.length !== 0) paths.push(path[1][1]);
				for(let _path of paths)
					if(fs.existsSync(path.resolve(_path, exec[1][1])))
						return Promise.resolve(path.resolve(_path, exec[1][1]));

				return Promise.resolve(undefined);
			case ".lnk": // Windows shortcut
				if(process.platform !== "win32") return Promise.resolve(undefined);
				return winShortcut.getPath(_probableLink);
			case ".app": // macOS application
				return Promise.resolve(fs.readlinkSync(path.resolve(_probableLink, "Contents", "Frameworks", "Electron Framework.framework", "Electron Framework")));
		}
		return Promise.resolve(undefined);
	}

	static getMainExecutableCandidates(_appRootPath){
		let possibleFilenames = [];
		switch(process.platform){
			case "darwin": // straightforward asf
				possibleFilenames = [fs.readlinkSync(path.resolve(_appRootPath, "Contents", "Frameworks", "Electron Framework.framework", "Electron Framework"))];
				break;
			case "win32": // almost straightforward
				_appRootPath = path.resolve(_appRootPath);
				possibleFilenames = glob.sync(path.join(_appRootPath, "*.exe"));
				possibleFilenames = possibleFilenames.filter(x => ![
					path.join(_appRootPath, "Squirrel.exe"),
					path.join(_appRootPath, "chrome_sandbox.exe")
				].includes(x));
				break;
			case "linux":
				possibleFilenames = glob.sync(path.join(_appRootPath, "!(*.*)"));
				possibleFilenames = possibleFilenames.filter(x => {
					if([path.join(_appRootPath, "chrome_sandbox")].includes(x)) return false;
					const stat = fs.stat(x);
					if(stat.isDirectory()) return false;
					return true;
				});
				break;
		}
		return possibleFilenames;
	}

	static getElectronVersion(_possibleFilenames){
		let _electronVersion = undefined;
		for(let filename of _possibleFilenames){
			const electronVersion = traverser.traverseFileWithRegex("Electron Framework", /Electron\/([0-9\.]*)/, 5 * 1024 * 1024);
			if(electronVersion.length !== 0){
				_electronVersion = electronVersion[1][1];
				break;
			}
		}
		return _electronVersion;
	}

	static isElectronVersionSupported(_electronVersion){
		if(typeof _electronVersion === "undefined") return undefined;
		return this.versionCompare(minElectronVersion, _electronVersion, {zeroExtend: true}) <= 0;
	}

	// https://stackoverflow.com/questions/6832596/how-to-compare-software-version-number-using-js-only-number
	static versionCompare(v1, v2, options) {
		var lexicographical = options && options.lexicographical,
			zeroExtend = options && options.zeroExtend,
			v1parts = v1.split("."),
			v2parts = v2.split(".");

		function isValidPart(x) {
			return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
		}

		if(!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) return NaN;

		if(zeroExtend) {
			while (v1parts.length < v2parts.length) v1parts.push("0");
			while (v2parts.length < v1parts.length) v2parts.push("0");
		}

		if (!lexicographical) {
			v1parts = v1parts.map(Number);
			v2parts = v2parts.map(Number);
		}

		for (var i = 0; i < v1parts.length; ++i) {
			if (v2parts.length == i) return 1;
			if (v1parts[i] == v2parts[i]) continue;
			else if (v1parts[i] > v2parts[i]) return 1;
			else return -1;
		}

		if (v1parts.length != v2parts.length) return -1;

		return 0;
	}

}

module.exports = Utils;
