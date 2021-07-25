import * as fs from "fs"
import * as PATH from "path"
import assert = require("assert")


export function read(file: string): string {
    try {
        return fs.readFileSync(file, 'utf-8')
    } catch(e: any) {
        if (e.code == 'ENOENT') {
            throw notFound(file)
        } else {
            throw e
        }
    }
}


export function stat(file: string): fs.Stats | undefined {
    try {
        return fs.statSync(file)
    } catch(e) {
        if (e.code == 'ENOENT') {
            return undefined
        } else {
            throw e
        }
    }
}


export function copy(src: string, dest: string): void {
    let src_stat = stat(src)
    if (src_stat == null) throw notFound(src)
    let dest_stat = stat(dest)
    if (src_stat.mtime < (dest_stat?.mtime || 0)) return
    if (dest_stat == null) {
        fs.mkdirSync(PATH.dirname(dest), {recursive: true})
    }
    fs.copyFileSync(src, dest)
}


export function write(dest: string, content: string): void {
    fs.mkdirSync(PATH.dirname(dest), {recursive: true})
    fs.writeFileSync(dest, content)
}


export function normalize(file: string, outOfPackageError?: string): string {
    file = PATH.normalize(file)
    if (file.startsWith('..')) {
        throw new BuildError(outOfPackageError || `encountered a file which does not belong to the project: ${file}`)
    }
    return file
}


export function deleteFiles(e: string, preserve: Set<string>): boolean {
    let s = stat(e)
    if (s == null) return false
    if (s.isFile()) {
        if (preserve.has(e)) {
            return true
        } else {
            fs.unlinkSync(e)
            return false
        }
    }
    if (s.isDirectory()) {
        let items = fs.readdirSync(e)
        let is_empty = !items.some(it => deleteFiles(PATH.join(e, it), preserve))
        if (is_empty) {
            fs.rmdirSync(e)
            return false
        } else {
            return true
        }
    }
    throw new BuildError(`${e} is not a file or directory`)
}


export function readJson<T=any>(file: string): T {
    let json = read(file)
    try {
        return JSON.parse(json)
    } catch(e) {
        throw new BuildError(`file ${file} has a syntax error`)
    }
}


export function sortKeys<T extends object>(src: T): T {
    assert(Object.getPrototypeOf(src) === Object.prototype, 'only plain js objects are supported by sortKeys()')
    let sorted: any = {}
    Object.keys(src).sort().forEach(key => {
        sorted[key] = (src as any)[key]
    })
    return sorted
}


export function notFound(file: string): BuildError {
    return new BuildError(`file ${file} not found`)
}


export class BuildError extends Error {}