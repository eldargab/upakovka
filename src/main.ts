import * as PATH from "path"
import * as detective from "detective"
import type {PackageJson} from "type-fest"
import {BuildError, copy, deleteFiles, normalize, read, readJson, sortKeys, stat, write} from "./util"
import isBuiltInModule = require("is-builtin-module")


export type PackageFile = string | {name: string, src: string}


export interface Package {
    name: string
    js: string[]
    files?: PackageFile[]
    package_json?: Partial<PackageJson>
}


export interface Config {
    outDir: string
    packages: Package[]
}


export interface Ctx {
    config: Config
    rootPackageJson: PackageJson
    rootPackageLockJson: any
}


export interface Build {
    outDir: string
    files: PackageFile[]
    packageJson: PackageJson & {dependencies: Record<string, string>}
}


export function build(ctx: Ctx, pkg: Package): Build {
    let out: Build = {
        outDir: PATH.join(ctx.config.outDir, pkg.name),
        files: [],
        packageJson: {
            ...pkg.package_json,
            name: pkg.name,
            version: pkg.package_json?.version || ctx.rootPackageJson.version,
            dependencies: {}
        }
    }

    // traverse js files
    {
        let seen = new Set<string>()
        pkg.js.forEach(function visit(file: string) {
            file = normalize(file)
            if (seen.has(file)) return
            seen.add(file)

            out.files.push(file)
            for (let f of relatedFiles(file)) {
                out.files.push(f)
            }

            let code = read(file)
            detective(code).forEach(dep => {
                if (dep[0] == '.') {
                    // it is a file
                    let ext = PATH.extname(dep)
                    if (ext != '.js' && ext != '.json') {
                        dep += '.js'
                    }
                    dep = PATH.join(PATH.dirname(file), dep)
                    visit(dep)
                } else if (!isBuiltInModule(dep)) {
                    // it is a npm package
                    let version = ctx.rootPackageJson.dependencies?.[dep]
                    if (version == null) {
                        throw new BuildError(`package ${dep} which is required by ${file} is not specified as a dependency in package.json`)
                    }
                    out.packageJson.dependencies[dep] = version
                }
            })
        })
    }

    // add non-js files
    pkg.files?.forEach(f => {
        let {name, src} = typeof f == 'string' ? {name: f, src: f} : f
        return {
            name: normalize(name, `file ${name} is outside of package`),
            src: normalize(src)
        }
    })

    // make content prettier and more stable, e.g. for better docker caching
    out.packageJson = sortPackageJson(out.packageJson)

    return out
}


function *relatedFiles(file: string): Generator<string> {
    if (!file.endsWith('.js')) return
    let basename = file.slice(0, -'.js'.length)
    let js_map = basename + '.js.map'
    if (stat(js_map)) {
        yield js_map
    }
    let d_ts = basename + '.d.ts'
    if (stat(d_ts)) {
        yield d_ts
    }
}


function sortPackageJson<T extends PackageJson>(src: T): T {
    let sorted: T = {
        name: src.name,
        version: src.version,
        private: src.private,
        description: src.description,
        keywords: src.keywords,
        repository: src.repository,
        license: src.license,
        author: src.author,
        ...src
    }
    if (src.dependencies) {
        sorted.dependencies = sortKeys(src.dependencies)
    }
    return sorted
}


export function writeBuild(ctx: Ctx, b: Build): void {
    // delete old files which do not belong to a new package
    let file_set = new Set<string>()
    b.files.forEach(f => file_set.add(typeof f == 'string' ? f : f.name))
    deleteFiles(b.outDir, file_set)

    // write package content
    function out(file: string): string {
        return PATH.join(b.outDir, file)
    }

    write(out('package.json'), JSON.stringify(b.packageJson, null, 4))

    b.files.forEach(f => {
        let {name, src} = typeof f == 'string' ? {name: f, src: f} : f
        let dest = out(name)
        copy(src, dest)
    })
}


export function buildContext(): Ctx {
    let config = readJson<Config>('packing.json')
    let rootPackageJson = readJson('package.json')
    let rootPackageLockJson = readJson('package-lock.json')
    return {config, rootPackageJson, rootPackageLockJson}
}


export function main(): void {
    try {
        let ctx = buildContext()
        ctx.config.packages.forEach(pkg => {
            let b = build(ctx, pkg)
            writeBuild(ctx, b)
            console.log(`built ${pkg.name}`)
        })
    } catch(e) {
        if (e instanceof BuildError) {
            console.error(`error: ${e.message}`)
        } else {
            console.error(e.stack)
        }
    }
}
