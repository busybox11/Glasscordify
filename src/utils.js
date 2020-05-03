'use strict';

const path = require('path');
const https = require('https');
const fs = require('fs');
const asar = require('asar');

function httpsGetRecursive(url, options, callback){
	https.get(url, options, result => {
		if(result.statusCode == 301 || result.statusCode == 302){
			https.get(result.headers.location, options, callback);
			return;
		}
		callback(result);
	});
}

class Utils{

	static downloadGlasscordAsar(){
		// CALL TO THE GITHUB RELEASES API
		https.get('https://api.github.com/repos/AryToNeX/Glasscord/releases/latest', {headers: {'user-agent': 'glasscordify'}}, result => {
			// Let's check the error
			if(result.statusCode != 200){
				console.log('Error while querying GitHub API (releases/latest): status code is ' + result.statusCode);
				return;
			}
			
			// Let's now get the data
			let data = '';
			result.on('data', chunk => data += chunk);
			
			// Now we want to work with the data, right?
			result.on('end', () => {
				data = JSON.parse(data);
				// Let's traverse the assets array to find our object!
				let url;
				for(let asset of data.assets){
					if(asset.name == "glasscord.asar"){
						url = asset.browser_download_url;
						break;
					}
				}
				
				// Let's download it!
				httpsGetRecursive(url, {headers: {'user-agent': 'glasscordify'}}, result => {
					// Again, let's check for errors
					if(result.statusCode != 200){
						console.log('Error while querying GitHub API (releases/download): status code is ' + result.statusCode);
						return;
					}
					
					// Save data
					let fd = fs.openSync(path.join(Utils.getConfigPath(), 'glasscord', '_bin', "glasscord.asar"), 'a');
					result.on('data', chunk => fs.appendFileSync(fd, chunk));
					
					// We reached the end, let's close and rename the files.
					result.on('end', () => {
						fs.closeSync(fd); // Let's close the file
						// We finished!
						console.log('Glasscord downloaded!');
					});
				});
			});
		});
	}
	
	static getConfigPath(){
		switch(process.platform){
			case 'linux':
				return path.resolve(process.env.XDG_CONFIG_HOME) || path.resolve(process.env.HOME, '.config');
			case 'win32';
				return path.resolve(process.env.APPDATA);
			case 'darwin';
				return path.resolve(process.env.HOME, 'Library', 'Application Support');
		}
	}
	
	static linkGlasscordToPath(_path){
		const glasscordPath = path.join(Utils.getConfigPath(), 'glasscord', '_bin', "glasscord.asar");
		return fs.linkSync(glasscordPath, path.join(_path, "glasscord.asar"));
	}

	static requireGlasscordFromTheMainFile(_mainJS, _glasscordPath){
		const _relativeToMain = path.relative(path.dirname(_mainJS), _glasscordPath);
		const _require = `// GLASSCORD BEGIN\nrequire('${_relativeToMain}');\n// GLASSCORD END\n`;
		const newFile = _require + fs.readFileSync(_mainJS);
		fs.writeFileSync(_mainJS, newFile);
	}
	
	static determineMainJS(_appPath){
		const pak = require(path.resolve(_appPath, 'package.json'));
		return pak.main;
	}
	
	static determineIfGlasstronApp(_appPath){
		const pak = require(path.resolve(_appPath, 'package.json'));
		return (pak.dependencies.hasOwnProperty('glasstron') || pak.devDependencies.hasOwnProperty('glasstron'))
	}
	
	static checkIfAsar(_resourcesPath){
		if(!fs.existsSync(path.join(_resourcesPath, 'app')))
			if(fs.existsSync(path.join(_resourcesPath, 'app.asar')))
				return true;
		return false;
	}
	
	static extractAsar(_resourcesPath){
		fs.mkdirSync(path.join(_resourcesPath, '_app'));
		fs.renameSync(path.join(_resourcesPath, 'app.asar'), path.join(_resourcesPath, '_app', 'app.asar'));
		if(fs.existsSync(path.join(_resourcesPath, 'app.asar.unpacked')))
			fs.renameSync(path.join(_resourcesPath, 'app.asar.unpacked'), path.join(_resourcesPath, '_app', 'app.asar.unpacked'));
		asar.extractAll(path.resolve(_resourcesPath, '_app', 'app.asar'), path.resolve(_resourcesPath, 'app'));
	}

}
