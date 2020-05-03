'use strict';
const prompt = require('prompt-sync')({sigint: true});
console.log('Glasscordify\n');
console.log('Please specify what you want to patch');
console.log('Discord is NOT supported');
const app = prompt('App: ');
console.log(app);
