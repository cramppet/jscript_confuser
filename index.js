/**
 * jscript_confuser: Simple JavaScript and JScript obfuscator.
 */

const fs = require('fs');
const esprima = require('esprima');

// Monkey patch for older versions of Node
String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, 'g'), replacement);
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function randString(length) {
  const ret = [];
  const charset = 'abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  for (let i = 0; i < length; i++) {
    const r = Math.round((Math.random() * 100)) % charset.length;
    ret.push(charset[r]);
  }
  return ret.join('');
}

function encodeString(s) {
  const chars = [];
  for (let i = 0; i < s.length; i++) {
    chars.push(s.charCodeAt(i));
  }
  return `String.fromCharCode.apply(null, [${chars}])`;
}

function main(args) {
  const scriptFile = fs.readFileSync(args[2], 'utf-8');
  let obfuscatedFile = scriptFile.slice();
  esprima.parseScript(scriptFile, { tolerant: true }, (node) => {
    // Encode string literals
    if (node.type == 'Literal' && typeof node.value == 'string') {
      const encoded = encodeString(node.value);
      obfuscatedFile = obfuscatedFile.replaceAll(escapeRegExp(node.raw), encoded);
    }
    // Change function names/references
    else if (node.type == 'FunctionDeclaration') {
      const name = node.id.name;
      const newName = randString(name.length);
      obfuscatedFile = obfuscatedFile.replaceAll(`\\b${name}\\b`, newName);
    }
    // Change variable names/references
    else if (node.type == 'VariableDeclaration' && node.declarations.length == 1) {
      const name = node.declarations[0].id.name;
      const newName = randString(name.length);
      // We have to be careful not to replace property names that are the same
      // as our variable names. Also, the JavaScript regex interface doesn't 
      // seem to honor non-capture groups in a sensible way so we have to do
      // extra work to ensure we don't replace more than we need to.
      const matches = [...scriptFile.matchAll(`([^\\w\\.])(${name})\\b`)];
      for (let i = 0; i < matches.length; i++) {
        const match = escapeRegExp(matches[i][0]) + '\\b'; // Add word boundary
        const replacement = `${matches[i][1]}${newName}`;  // Keep preceeding character
        obfuscatedFile = obfuscatedFile.replaceAll(match, replacement);
      }
    }
  });
  console.log(obfuscatedFile);
}

if (process.argv.length < 3) {
  console.error('usage: node index.js foo.js > obf.js')
  process.exit(1);
} else {
  main(process.argv);
}
