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
const oldBrowserWindow = require("electron").BrowserWindow;
require("{GLASSCORD_ASAR_LOCATION}");
const electron = require("electron");

class BrowserWindow extends electron.BrowserWindow {
	constructor(options) {
		if(!options || !options.webPreferences || !options.webPreferences.preload || !options.title)
			return new oldBrowserWindow(options);
		super(options);
	}
}

const electronPath = require.resolve("electron");
const newElectron = Object.assign({}, electron, {BrowserWindow}); // Create new electron object

delete require.cache[electronPath].exports; // Delete exports
require.cache[electronPath].exports = newElectron; // Assign the exports as the new electron

if(require.cache[electronPath].exports !== newElectron)
	console.log("Something's wrong! The Glasscord shim for Discord can't be injected properly!");
