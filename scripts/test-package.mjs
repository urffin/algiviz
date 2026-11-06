import { mkdtemp, readFile, writeFile, copyFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this check through npm run test:package");
const { values } = parseArgs({ options: {
    typescript: { type: "string" },
    resolution: { type: "string", default: "NodeNext" }
} });
if (values.typescript !== undefined && !/^\d+\.\d+\.\d+$/.test(values.typescript)) {
    throw new Error("--typescript must be an exact stable compiler version");
}
if (!["NodeNext", "Bundler", "all"].includes(values.resolution)) {
    throw new Error("--resolution must be NodeNext, Bundler or all");
}
const resolutions = values.resolution === "all" ? ["NodeNext", "Bundler"] : [values.resolution];
const workspace = await mkdtemp(join(tmpdir(), "algiviz-consumer-"));
const runNpm = (args, cwd) => execFileSync(process.execPath, [npm, ...args], {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"]
});
try {
    const packed = JSON.parse(runNpm(["pack", "--json", "--pack-destination", workspace], root));
    if (packed[0].files.some(file => /^dist\/(core|compat)\//.test(file.path))) {
        throw new Error("Tarball contains removed legacy modules");
    }
    const filename = packed[0].filename;
    if (filename !== filename.split(/[\\/]/).at(-1)) throw new Error("Unexpected package filename");
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    await writeFile(join(workspace, "package.json"), JSON.stringify({ private: true, type: "module" }));
    runNpm(["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", join(workspace, filename)], workspace);
    // Keep the repository compiler pinned; install alternate consumers only
    // inside the unique temporary workspace owned by this invocation.
    let compilerRoot = join(root, "node_modules/typescript");
    const buildCompiler = JSON.parse(await readFile(join(compilerRoot, "package.json"), "utf8"));
    if (values.typescript !== undefined && values.typescript !== buildCompiler.version) {
        runNpm(["install", "--save-exact", "--ignore-scripts", "--no-audit", "--no-fund", `typescript@${values.typescript}`], workspace);
        compilerRoot = join(workspace, "node_modules/typescript");
    }
    const compilerVersion = JSON.parse(await readFile(join(compilerRoot, "package.json"), "utf8")).version;
    if (values.typescript !== undefined && compilerVersion !== values.typescript) {
        throw new Error("Installed consumer compiler differs from requested version");
    }
    const compiler = join(compilerRoot, "bin/tsc");
    await copyFile(join(root, "test/package-exports.mjs"), join(workspace, "exports.mjs"));
    execFileSync(process.execPath, [join(workspace, "exports.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/package-headless.ts"), join(workspace, "headless.ts"));
    const installed = JSON.parse(await readFile(join(workspace, "node_modules/@grundyjs/algiviz/package.json"), "utf8"));
    if (installed.version !== pkg.version) throw new Error("Installed version differs from packed version");
    await copyFile(join(root, "test/package-consumer.ts"), join(workspace, "consumer.ts"));
    await copyFile(join(root, "examples/custom-objects.ts"), join(workspace, "custom-objects.ts"));
    for (const resolution of resolutions) {
        const compilerOptions = {
            target: "ES2022", module: resolution === "NodeNext" ? "NodeNext" : "ESNext",
            moduleResolution: resolution, strict: true, noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true, skipLibCheck: false, types: []
        };
        const headlessConfig = join(workspace, `tsconfig.headless.${resolution}.json`);
        await writeFile(headlessConfig, JSON.stringify({
            compilerOptions: { ...compilerOptions, lib: ["ES2022"], noEmit: true },
            files: ["headless.ts"]
        }));
        execFileSync(process.execPath, [compiler, "-p", headlessConfig], { stdio: "inherit" });
        const outDir = `output-${resolution}`;
        const domConfig = join(workspace, `tsconfig.dom.${resolution}.json`);
        await writeFile(domConfig, JSON.stringify({
            compilerOptions: { ...compilerOptions, lib: ["ES2022", "DOM"], noEmitOnError: true, outDir },
            files: ["consumer.ts", "custom-objects.ts"]
        }));
        execFileSync(process.execPath, [compiler, "-p", domConfig], { stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "consumer.js")], { cwd: workspace, stdio: "inherit" });
        console.log(`TypeScript ${compilerVersion} / ${resolution}: headless, DOM and runtime consumer passed`);
    }
    await copyFile(join(root, "examples/minimal.mjs"), join(workspace, "minimal.mjs"));
    const minimalTest = (await readFile(join(root, "test/minimal-example.test.mjs"), "utf8"))
        .replace("../examples/minimal.mjs", "./minimal.mjs");
    await writeFile(join(workspace, "minimal.test.mjs"), minimalTest);
    execFileSync(process.execPath, ["--test", join(workspace, "minimal.test.mjs")], { cwd: workspace, stdio: "inherit" });
    console.log(`Packed consumer passed: ${pkg.name}@${pkg.version}`);
} finally {
    // Delete only the unique temporary directory created by this invocation.
    const parent = await realpath(tmpdir());
    const target = await realpath(workspace);
    const child = relative(parent, target);
    if (!child || child.startsWith("..") || isAbsolute(child) || dirname(target) !== parent) {
        throw new Error(`Refusing cleanup outside temporary parent: ${target}`);
    }
    await rm(target, { recursive: true, force: true });
}
