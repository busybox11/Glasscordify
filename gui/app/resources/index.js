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
	READY: "READY",
	DOWNLOADING: "DOWNLOADING",
	ERRORED: "ERRORED",
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
		if (newState === currentState || currentState === ApplicationStates.ERRORED) return;

		subButtonElement.innerHTML = "";
		let headline = `Make your installed Electron app look <span class="sexy">${sexyWords[Math.floor(Math.random() * sexyWords.length)]}</span> with <span class="glasscord">Glasscord</span>`;
		if (newState === ApplicationStates.DOWNLOADING) {
			headline = "Downloading Glasscord<br/>Please wait..."
			buttonElement.style.display = "none";
		} else if (newState === ApplicationStates.ERRORED) {
			headline = "<span class=\"whoops\">Whoops!</span> An error occurred while initializing. Make sure you're connected to Internet and try again."
			const btn = buttonElement.cloneNode(true);
			btn.addEventListener('click', () => ipc.send('restart'))
			btn.className = "button red";
			btn.innerText = "Restart Glasscordify";
			buttonElement.parentNode.replaceChild(btn, buttonElement);
		} else if (newState === ApplicationStates.DRAGGING) {
			headline = "<span class=\"drag-text\">Drag the application</span><br/>on the appropriate button!";
			buttonElement.style.display = "block";
			buttonElement.className = "button glasscord outline";
			buttonElement.innerText = "Install";
			secondaryButtonElement.style.display = "block";
		} else {
			secondaryButtonElement.style.display = "none";
			if (newState === ApplicationStates.FAILED) {
				headline = "<span class=\"whoops\">Whoops!</span> This application is not supported by Glasscord!"
			}

			// Main button
			let buttonMain;
			buttonElement.style.display = "block";
			if (newState === ApplicationStates.READY) {
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
			if (newState === ApplicationStates.FAILED) {
				subButtonElement.innerText = "I am very sorry!";
			} else {
				const uninstallButton = createElement("a", {
					href: "#",
					role: "button",
					innerText: "Uninstall it",
					events: { click: e => e.preventDefault() | ipc.send("uninstall-clicked") }
				});
				subButtonElement.appendChild(document.createTextNode("Got tired? "));
				subButtonElement.appendChild(uninstallButton);
				subButtonElement.appendChild(document.createTextNode("."));
			}
		}
		headlineElement.innerHTML = headline;
		console.log('Glasscordify > New state: ' + newState)
		currentState = newState;
	});
}

// Event
document.querySelector(".close").addEventListener("click", () => ipc.send("close"));
document.querySelector(".minimize").addEventListener("click", () => ipc.send("minimize"));
buttonElement.addEventListener("click", () => currentState !== ApplicationStates.DRAGGING && !buttonElement.disabled && ipc.send("install-clicked"));

// Modal
const modal = document.querySelector('.modal');
const openModal = function () {
	window.requestAnimationFrame(() => {
		document.body.classList.add('i-wish-backdrop-filter-would-work-and-not-require-me-to-blur-the-body')
		modal.setAttribute('aria-hidden', 'false'); // Mark it as immediately visible
		modal.classList.remove('hidden');
		modal.classList.add('entering');
		setTimeout(() => window.requestAnimationFrame(() => {
			modal.classList.remove('entering');
		}), 300)
	});
}
const closeModal = function () {
	window.requestAnimationFrame(() => {
		document.body.classList.remove('i-wish-backdrop-filter-would-work-and-not-require-me-to-blur-the-body')
		modal.setAttribute('aria-hidden', 'true'); // Mark it as immediately hidden
		modal.classList.add('leaving');
		setTimeout(() => window.requestAnimationFrame(() => {
			modal.classList.remove('leaving');
			modal.classList.add('hidden');
		}), 300)
	});
}

document.querySelector('.modal-inner').addEventListener('click', e => e.stopPropagation());
document.querySelector('#awesome').addEventListener('click', openModal);
document.querySelector('#modal-close').addEventListener('click', closeModal);
document.querySelector('.modal').addEventListener('click', closeModal);

// Drag and drop
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
	if (currentState === ApplicationStates.DRAGGING) changeApplicationState(ApplicationStates.READY);
	return false;
};
buttonElement.addEventListener("drop", e => {
	if (currentState === ApplicationStates.DRAGGING && e.dataTransfer.files.length !== 0) {
		ipc.send("install-drop", [ ...e.dataTransfer.files ].map(f => f.path));
	}
});
secondaryButtonElement.addEventListener("drop", e => {
	if (currentState === ApplicationStates.DRAGGING && e.dataTransfer.files.length !== 0) {
		ipc.send("uninstall-drop", [ ...e.dataTransfer.files ].map(f => f.path));
	}
});

// IPC events
ipc.on("install-success", () => {
	changeApplicationState(ApplicationStates.INSTALLED);
	setTimeout(() => changeApplicationState(ApplicationStates.READY), 10e3);
});
ipc.on("install-failed", () => changeApplicationState(ApplicationStates.FAILED));
ipc.on("asar-download", () => changeApplicationState(ApplicationStates.DOWNLOADING));
ipc.on("asar-success", () => changeApplicationState(ApplicationStates.READY));
ipc.on("asar-failure", () => changeApplicationState(ApplicationStates.ERRORED));

// Trigger initial rendering
changeApplicationState(ApplicationStates.READY);
ipc.send('ready');
