/*
   Copyright 2020 AryToNeX

   Licensed under the Apache License, Version 2.0 (the 'License');
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an 'AS IS' BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
'use strict';

const inquirer = require("inquirer");
const lib = require("glasscordify-lib");

// console.warn("This is a work in progress; many features will be broken or missing. Proceed with caution.");
var ansi = {
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	reset: "\x1b[0m"
}
console.log(ansi.cyan + "== " + ansi.magenta + "Glasscord Installer " + ansi.cyan + "==" + ansi.reset + "\n");

var questions = [
	{
		type: "list",
		name: "mode",
		message: "Select an option:",
		choices: [
			"Install",
			"Uninstall"
		]
	},
	{
		type: "list",
		name: "appName",
		message: "Which application would you like to inject Glasscord into?",
		choices: [ // TODO: get list of apps that can be installed
			"Discord",
			"VSCode"
		],
		when: function(answers){
			return answers.mode == "Install";
		}
	},
	{
		type: "list",
		name: "appName",
		message: "Which application would you like to remove Glasscord from?",
		choices: [ // TODO: get list of apps that have been patched
			"Discord",
			"VSCode"
		],
		when: function(answers){
			return answers.mode == "Uninstall";
		}
	}
];

inquirer.prompt(questions).then(answers => {
	// TODO: make these functions work (with logging).
	if (answers.mode == "Install") install(answers.appName);
	else if (answers.mode == "Uninstall") uninstall(answers.appName);
	
	else console.log('Uh oh, something went wrong! Please try again.');
});

async function install(appName){
	if (!lib.Utils.isGlasscordDownloaded()){
		console.log("Downloading package...");
		var result = await lib.Utils.downloadGlasscordAsar();
		if (result){
			console.log("Download successful.");
		} else {
			console.log("Download failed!");
		}
	}
	
	console.log("To be continued...");
}

function uninstall(appName){
	console.log(`Uninstalling Glasscord from ${appName}...`);
}
