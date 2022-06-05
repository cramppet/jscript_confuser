/**
 * JavaScript and "JScript" obfuscator.
 */

const fs = require('fs');
const esprima = require('esprima');


// Monkeypatch for older versions of Node
String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.split(search).join(replacement);
};

function randString(length) {
  const ret = [];
  const charset = 'abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  for (let i = 0; i < length; i++) {
    const r = Math.round((Math.random() * 100)) % charset.length;
    ret.push(charset[r]);
  }
  return ret.join('');
}

function collectVariables(node) {
  let ret = [];
  if (node && node.body) {
    const body = node.body.body ? node.body.body : node.body;
    for (let i = 0; i < body.length; i++) {
      const stmt = body[i];
      // var x = *
      if (stmt.type == 'VariableDeclaration' && stmt.declarations.length == 1) {
        ret.push(stmt);
      }
      ret = ret.concat(collectVariables(stmt.body));
      ret = ret.concat(collectVariables(stmt.block));
      ret = ret.concat(collectVariables(stmt.handler));
      ret = ret.concat(collectVariables(stmt.finalizer));
    }
  }
  return ret;
}

function collectLiterals(node) {
  let ret = [];
  if (node && node.body) {
    const body = node.body.body ? node.body.body : node.body;
    for (let i = 0; i < body.length; i++) {
      const stmt = body[i];
      if (stmt.type == 'VariableDeclaration' && stmt.declarations.length == 1) {
        // var x = "a";
        if (stmt.declarations[0].init.type == 'Literal') {
          ret.push(stmt.declarations[0].init);
        }
        // var x = new Object("a");
        else if (stmt.declarations[0].init.type == 'NewExpression') {
          for (let arg of stmt.declarations[0].init.arguments) {
            if (arg.type == 'Literal') {
              ret.push(arg);
            }
          }
        }
      }
      // foo("bar");
      if (stmt.type == 'ExpressionStatement' && stmt.expression.type == 'CallExpression') {
        for (let arg of stmt.expression.arguments) {
          if (arg.type == 'Literal') {
            ret.push(arg);
          }
        }
      }
      ret = ret.concat(collectLiterals(stmt.body));
      ret = ret.concat(collectLiterals(stmt.block));
      ret = ret.concat(collectLiterals(stmt.handler));
      ret = ret.concat(collectLiterals(stmt.finalizer));
    }
  }
  return ret;
}

function main(args) {
  let scriptFile = fs.readFileSync(args[2], 'utf-8');
  const ast = esprima.parseScript(scriptFile, { 
    tolerant: true, // Tolerant for JScript
    loc: true,
    range: true,
  }); 
  
  let functions = [];
  let variables = [];
  let literals = [];

  // Identify areas in the AST for simple obfuscation
  for (let i = 0; i < ast.body.length; i++) {
    const stmt = ast.body[i];
    switch (stmt.type) {
      // Global variables
      case 'VariableDeclaration':
        if (stmt.declarations.length == 1) {
          variables.push(stmt);
        }
        // var x = "a";
        if (stmt.declarations[0].init.type == 'Literal') {
          literals.push(stmt.declarations[0].init);
        }
        // var x = new Object("a");
        else if (stmt.declarations[0].init.type == 'NewExpression') {
          for (let arg of stmt.declarations[0].init.arguments) {
            if (arg.type == 'Literal') {
              literals.push(arg);
            }
          }
        }
        break;
      // Global function calls
      case 'ExpressionStatement':
        if (stmt.expression && stmt.expression.type == 'CallExpression') {
          for (let arg of stmt.expression.arguments) {
            if (arg.type == 'Literal') {
              literals.push(arg);
            }
          }
        }
        break;
      // Global function declarations
      case 'FunctionDeclaration':
        functions.push(stmt);
        break;
      // All other code, walk the AST recursively
      default:
        if (stmt.body) {
          variables = variables.concat(collectVariables(stmt.body));
          literals = literals.concat(collectLiterals(stmt.body));
        }
        if (stmt.block) {
          variables = variables.concat(collectVariables(stmt.block));
          literals = literals.concat(collectLiterals(stmt.block));
        }
        if (stmt.handler) {
          variables = variables.concat(collectVariables(stmt.handler));
          literals = literals.concat(collectLiterals(stmt.handler));
        }
        if (stmt.finalizer) {
          variables = variables.concat(collectVariables(stmt.finalizer));
          literals = literals.concat(collectLiterals(stmt.finalizer));
        }
        break;
    }
  }

  // Sort by the length of the token (avoids stomping on partial matches)
  functions.sort((a,b) => a.id.name.length < b.id.name.length ? 1 : -1); 
  variables.sort((a,b) => a.declarations[0].id.name.length < b.declarations[0].id.name.length ? 1 : -1); 

  // Apply obfuscation to original source
  for (let i = 0; i < functions.length; i++) {
    const name = functions[i].id.name;
    scriptFile = scriptFile.replaceAll(name, randString(name.length));
  }

  for (let i = 0; i < variables.length; i++) {
    const name = variables[i].declarations[0].id.name;
    scriptFile = scriptFile.replaceAll(name, randString(name.length));
  }

  for (let i = 0; i < literals.length; i++) {
    const chars = [];
    const raw = literals[i].raw;
    const value = literals[i].value;
    for (let j = 0; j < value.length; j++) {
      chars.push(value.charCodeAt(j));
    }
    scriptFile = scriptFile.replaceAll(raw, `String.fromCharCode.apply(null, [${chars}])`);
  }

  console.log(scriptFile);
}

if (process.argv.length < 3) {
  console.error('usage: node index.js foo.js > obf.js')
  process.exit(1);
} else {
  main(process.argv);
}

