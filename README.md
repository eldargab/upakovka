# upakovka

With `upakovka(1)` you manage your nodejs monorepo project as a single large npm package.

You have single `package.json` and 
relative  imports between internal modules - a simple structure which every developer and tool understands. 

For deployment or publishing you split your codebase into individual packages.

## Usage

Create `packing.json` file in the project's root directory

```json5
{
    "outDir": "packages", // output directory where to build individual packages
    "packages": [
        {
            "name": "tool-1", // name of the target package
            "js": [ // list of js entry points
                "lib/tool-1/main.js"
            ],
            "files": [ // list of non-js files to include into package
                {name: "README.md", src: "docs/tool-1/README.md"},
                "lib/tool-1/config.txt"
                // you don't have to list `.js.map` or `.d.ts` files here, 
                // they will be included automatically
            ],
            "package_json": { // miscellaneous fields to put into `package.json`
                // upakovka(1) will supply defaults for some fields like `.version`, `.author`, `.license`
                // based on the content of the project's `package.json`.
                "description": "tool-1 is for..."
            }
        }
    ]
}
```

Then just run `upakovka` with no arguments, and it will generate specified packages.

## How it works

For each package it recursively traverses js files by parsing commonjs `require` calls. 
It includes each internal module into the target package and 
for each external dependency it creates an entry in `.dependencies` of `package.json`.

## Caveats

This is an alpha quality software. Below is a list of issues we hope to fix soon:

* There is no support for `package-lock.json`.
* Supports only commonjs modules and ES2018 version of JavaScript
* Although `.d.ts` files corresponding to `.js` modules will be included automatically, 
  pure `.d.ts` declarations will be omitted. You have to list those manually under `.files`.
* There is no support for code splitting scenarios where you want to put each file into exactly one package.


## Installation

via npm

```
npm install upakovka
```