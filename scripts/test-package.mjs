import { mkdtemp, readFile, writeFile, copyFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this check through npm run test:package");
const workspace = await mkdtemp(join(tmpdir(), "algiviz-consumer-"));
const runNpm = (args, cwd) => execFileSync(process.execPath, [npm, ...args], {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"]
});
try {
    const packed = JSON.parse(runNpm(["pack", "--json", "--pack-destination", workspace], root));
    const filename = packed[0].filename;
    if (filename !== filename.split(/[\\/]/).at(-1)) throw new Error("Unexpected package filename");
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    await writeFile(join(workspace, "package.json"), JSON.stringify({ private: true, type: "module" }));
    runNpm(["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", join(workspace, filename)], workspace);
    const installed = JSON.parse(await readFile(join(workspace, "node_modules/@grundyjs/algiviz/package.json"), "utf8"));
    if (installed.version !== pkg.version) throw new Error("Installed version differs from packed version");
    await copyFile(join(root, "test/package-consumer.ts"), join(workspace, "consumer.ts"));
    await writeFile(join(workspace, "tsconfig.json"), JSON.stringify({
        compilerOptions: { target: "ES2022", module: "NodeNext", strict: true,
            noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
            noEmitOnError: true, types: [], outDir: "output" },
        files: ["consumer.ts"]
    }));
    execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", join(workspace, "tsconfig.json")], { stdio: "inherit" });
    execFileSync(process.execPath, [join(workspace, "output/consumer.js")], { cwd: workspace, stdio: "inherit" });
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
