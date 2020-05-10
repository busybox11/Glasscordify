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

const ipc = require("electron").ipcRenderer;

// App constants
let currentState;
const headlineElement = document.querySelector(".headline");
const buttonElement = document.querySelector(".buttons .button");
const secondaryButtonElement = document.querySelector(".buttons .button + .button");
const subButtonElement = document.querySelector(".sub-button");
const sexyWords = ["sexy", "beautiful", "awesome", "glassy", "orgasmic"];
const ApplicationStates = Object.freeze({
	INITIAL: "INITIAL",
	DRAGGING: "DRAGGING",
	INSTALLED: "INSTALLED",
	FAILED: "FAILED"
});

// Rendering stuff
function createElement (tag, props) {
	const el = document.createElement(tag);
	for (const prop in props) {
		if (prop === "events") {
			for (const event in props.events) {
				el.addEventListener(event, props.events[event]);
			}
			continue;
		}
		el[prop] = props[prop];
	}
	return el;
}

function changeApplicationState (newState) {
	window.requestAnimationFrame(() => {
		if (newState === currentState) return;
		if (newState === ApplicationStates.DRAGGING) {
			headlineElement.innerHTML = "<span class=\"drag-text\">Drag the application</span><br/>on the appropriate button!";
			buttonElement.className = "button glasscord outline";
			buttonElement.innerText = "Install";
			secondaryButtonElement.style.display = "block";
			subButtonElement.innerHTML = "";
		} else {
			secondaryButtonElement.style.display = "none";
			headlineElement.innerHTML = newState === ApplicationStates.FAILED
				? "<span class=\"whoops\">Whoops!</span> This application is not supported by Glasscord!"
				: "Make your installed Electron app look <span class=\"sexy\">sexy</span> with <span class=\"glasscord\">Glasscord</span>";

			// Main button
			let buttonMain;
			if (newState === ApplicationStates.INITIAL) {
				buttonElement.className = "button glasscord";
				buttonElement.innerText = "Install it!";
			} else if (newState === ApplicationStates.INSTALLED) {
				buttonElement.className = "button green";
				buttonElement.innerText = "Installed!";
			} else {
				buttonElement.className = "button red";
				buttonElement.innerText = "Use another app?";
			}

			// Sub button
			subButtonElement.innerHTML = "";
			if (newState === ApplicationStates.FAILED) {
				subButtonElement.innerText = "I am very sorry!";
			} else {
				const uninstallButton = createElement("a", {
					href: "#",
					role: "button",
					innerText: "Uninstall it",
					events: { click: e => e.preventDefault() | ipc.send("uninstallClicked") }
				});
				subButtonElement.appendChild(document.createTextNode("Got tired? "));
				subButtonElement.appendChild(uninstallButton);
				subButtonElement.appendChild(document.createTextNode("."));
			}
		}
		currentState = newState;
		
		// Update the sexy value
		const sexy = document.querySelector(".sexy");
		if(sexy !== null) sexy.innerText = sexyWords[Math.floor(Math.random() * sexyWords.length)];
	});
}

// Event
document.querySelector(".close").addEventListener("click", () => ipc.send("close"));
document.querySelector(".minimize").addEventListener("click", () => ipc.send("minimize"));
buttonElement.addEventListener("click", () => currentState !== ApplicationStates.DRAGGING && ipc.send("installClicked"));
window.ondragover = e => {
	if ([ ...e.dataTransfer.items ].some(f => f.kind === "file")) {
		changeApplicationState(ApplicationStates.DRAGGING);
	}
	return false;
};
window.ondragleave = () => false;
window.ondragend = () => false;
window.ondrop = e => {
	e.preventDefault();
	changeApplicationState(ApplicationStates.INITIAL);
	return false;
};
buttonElement.addEventListener("drop", e => {
	if (currentState === ApplicationStates.DRAGGING && e.dataTransfer.files.length !== 0) {
		ipc.send("installDrop", e.dataTransfer.files);
	}
});
secondaryButtonElement.addEventListener("drop", e => {
	if (currentState === ApplicationStates.DRAGGING && e.dataTransfer.files.length !== 0) {
		ipc.send("uninstallDrop", e.dataTransfer.files);
	}
});

// IPC events
ipc.on("installSuccess", () => {
	changeApplicationState(ApplicationStates.INSTALLED);
	setTimeout(() => changeApplicationState(ApplicationStates.INITIAL), 10e3);
});
ipc.on("installFailed", () => changeApplicationState(ApplicationStates.FAILED));

// Trigger initial rendering
changeApplicationState(ApplicationStates.INITIAL);
