"use strict";

const fs = require("fs");

class Traverser{

	static isStringLike(val) { // a-zA-Z0-9\t
		return (val >= 32 && val <= 126) || val === 9
	}

	static getStringsFromChunk(chunk, minLength = 1){
		let strings = [];
		let stringLike = false;
		let stringStart = -1;
		for (let i = 0; i < chunk.length; i++) {
			let pieceIsStringLike = this.isStringLike(chunk[i]);
			if (i == 0 && !pieceIsStringLike) strings.push("");
			if (!stringLike && pieceIsStringLike) {
				stringStart = i;
			} else if (stringLike && !pieceIsStringLike && i - stringStart >= minLength) {
				let toMerge = chunk.slice(stringStart, i);
				toMerge.forEach((v,k,a) => {a[k]=String.fromCharCode(v)});
				strings.push(toMerge.join(""));
				stringStart = -1;
			}
			stringLike = pieceIsStringLike;
		}
		if(stringStart !== -1){
			let toMerge = chunk.slice(stringStart, chunk.length);
			toMerge.forEach((v,k,a) => {a[k]=String.fromCharCode(v)});
			strings.push(toMerge.join(""));
		}
		return strings;
	}

	static traverseFileWithRegex(filename, regex, chunkSize = regex.toString().length * 2){
		let buffer = Buffer.alloc(chunkSize);
		const fd = fs.openSync(filename, "r");
		let found = false;
		let result = [];
		let lastString = "";
		while(!found){
			const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, null);
			const chunkStrings = this.getStringsFromChunk([...buffer], 4);
			chunkStrings[0] = lastString + chunkStrings[0];
			if(chunkStrings.length > 0)
				for(let v of chunkStrings) {
					if(v.match(regex) && !found){
						found = true;
						result = [v, v.match(regex)];
						break;
					}
				}
			lastString = chunkStrings.pop();
			if(bytesRead < chunkSize) break; // EOF
		}
		fs.closeSync(fd);
		return result;
	}

}

//console.log(traverseFileWithRegex("Electron Framework", /Electron\/([0-9\.]*)/, 5 * 1024 * 1024));

module.exports = Traverser;
