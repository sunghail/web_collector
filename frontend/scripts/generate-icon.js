const fs = require('fs');
const path = require('path');

// Simple PNG to ICO converter
// ICO format: header + directory entries + image data

const inputPath = path.join(__dirname, '..', 'resources', 'icon.png');
const outputPath = path.join(__dirname, '..', 'resources', 'icon.ico');

const pngData = fs.readFileSync(inputPath);

// ICO Header (6 bytes)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);      // Reserved
header.writeUInt16LE(1, 2);      // Type: 1 = ICO
header.writeUInt16LE(1, 4);      // Number of images: 1

// ICO Directory Entry (16 bytes)
const dirEntry = Buffer.alloc(16);
dirEntry.writeUInt8(0, 0);       // Width (0 = 256)
dirEntry.writeUInt8(0, 1);       // Height (0 = 256)
dirEntry.writeUInt8(0, 2);       // Color palette
dirEntry.writeUInt8(0, 3);       // Reserved
dirEntry.writeUInt16LE(1, 4);    // Color planes
dirEntry.writeUInt16LE(32, 6);   // Bits per pixel
dirEntry.writeUInt32LE(pngData.length, 8);  // Image size
dirEntry.writeUInt32LE(22, 12);  // Offset (6 header + 16 directory = 22)

// Write ICO file
const ico = Buffer.concat([header, dirEntry, pngData]);
fs.writeFileSync(outputPath, ico);

console.log(`ICO file created: ${outputPath}`);
console.log(`PNG size: ${pngData.length} bytes`);
console.log(`ICO size: ${ico.length} bytes`);
