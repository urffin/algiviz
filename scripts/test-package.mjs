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
    await copyFile(join(root, "test/package-graph.ts"), join(workspace, "graph.ts"));
    await copyFile(join(root, "test/package-tree.ts"), join(workspace, "tree.ts"));
    await copyFile(join(root, "test/package-grid.ts"), join(workspace, "grid.ts"));
    await copyFile(join(root, "test/package-grid-canvas.ts"), join(workspace, "grid-canvas.ts"));
    await copyFile(join(root, "test/package-tree-canvas.ts"), join(workspace, "tree-canvas.ts"));
    await copyFile(join(root, "test/package-graph-canvas.ts"), join(workspace, "graph-canvas.ts"));
    await copyFile(join(root, "test/package-list.ts"), join(workspace, "list.ts"));
    await copyFile(join(root, "test/package-list-player.ts"), join(workspace, "list-player.ts"));
    await copyFile(join(root, "test/package-list-canvas.ts"), join(workspace, "list-canvas.ts"));
    const installed = JSON.parse(await readFile(join(workspace, "node_modules/@grundyjs/algiviz/package.json"), "utf8"));
    if (installed.version !== pkg.version) throw new Error("Installed version differs from packed version");
    await copyFile(join(root, "test/package-consumer.ts"), join(workspace, "consumer.ts"));
    await copyFile(join(root, "test/package-player.ts"), join(workspace, "player.ts"));
    await copyFile(join(root, "test/package-viewport.ts"), join(workspace, "viewport.ts"));
    await copyFile(join(root, "test/package-worker.ts"), join(workspace, "worker.ts"));
    await copyFile(join(root, "test/package-worker-runtime.ts"), join(workspace, "worker-runtime.ts"));
    await copyFile(join(root, "examples/custom-objects.ts"), join(workspace, "custom-objects.ts"));
    await writeFile(join(workspace, "canvas-tree-no-dom.ts"), "import {createTreeRenderer} from '@grundyjs/algiviz/canvas/tree'; void createTreeRenderer;\n");
    for (const resolution of resolutions) {
        const compilerOptions = {
            target: "ES2022", module: resolution === "NodeNext" ? "NodeNext" : "ESNext",
            moduleResolution: resolution, strict: true, noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true, skipLibCheck: false, types: []
        };
        const headlessConfig = join(workspace, `tsconfig.headless.${resolution}.json`);
        await writeFile(headlessConfig, JSON.stringify({
            compilerOptions: { ...compilerOptions, lib: ["ES2022"], noEmit: true },
            files: ["headless.ts", "graph.ts", "tree.ts", "grid.ts", "list.ts"]
        }));
        execFileSync(process.execPath, [compiler, "-p", headlessConfig], { stdio: "inherit" });
        const excludedConfig = join(workspace, `tsconfig.canvas-tree-no-dom.${resolution}.json`);
        await writeFile(excludedConfig, JSON.stringify({compilerOptions:{...compilerOptions, lib:["ES2022"], noEmit:true},files:["canvas-tree-no-dom.ts"]}));
        let excluded = false;
        try { execFileSync(process.execPath, [compiler, "-p", excludedConfig], {encoding:"utf8",stdio:["ignore","pipe","pipe"]}); }
        catch (error) {
            const diagnostics = String(error.stdout).trim().split(/\r?\n/);
            if (error.status !== 2 || !diagnostics.every(line =>
                line.endsWith("error TS2304: Cannot find name 'CanvasRenderingContext2D'."))) throw error;
            excluded=true;
        }
        if (!excluded) throw new Error("Canvas tree unexpectedly compiled without DOM declarations");
        const gridExcluded = join(workspace, 'tsconfig.canvas-grid-no-dom.'+resolution+'.json');
        await writeFile(join(workspace,'canvas-grid-no-dom.ts'), "import {createGridRenderer} from '@grundyjs/algiviz/canvas/grid'; void createGridRenderer;\n");
        await writeFile(gridExcluded, JSON.stringify({compilerOptions:{...compilerOptions,lib:['ES2022'],noEmit:true},files:['canvas-grid-no-dom.ts']}));
        let gridRejected=false;
        try {execFileSync(process.execPath,[compiler,'-p',gridExcluded],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
        catch(error){const diagnostics=String(error.stdout);if(error.status!==2||!diagnostics.includes("Cannot find name 'CanvasRenderingContext2D'")||(diagnostics.match(/error TS/g)??[]).length!==1)throw error;gridRejected=true;}
        if(!gridRejected)throw Error('Canvas grid unexpectedly compiled without DOM');
        const listExcluded = join(workspace, "tsconfig.canvas-list-no-dom." + resolution + ".json");
        await writeFile(join(workspace, "canvas-list-no-dom.ts"), "import {createListRenderer} from '@grundyjs/algiviz/canvas/list'; void createListRenderer;\n");
        await writeFile(listExcluded, JSON.stringify({ compilerOptions: { ...compilerOptions, lib: ["ES2022"], noEmit: true }, files: ["canvas-list-no-dom.ts"] }));
        let listRejected = false;
        try { execFileSync(process.execPath, [compiler, "-p", listExcluded], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
        catch (error) {
            const diagnostics = String(error.stdout);
            if (error.status !== 2 || !diagnostics.includes("Cannot find name 'CanvasRenderingContext2D'") || (diagnostics.match(/error TS/g) ?? []).length !== 1) throw error;
            listRejected = true;
        }
        if (!listRejected) throw new Error("Canvas list unexpectedly compiled without DOM");
        const outDir = `output-${resolution}`;
        const domConfig = join(workspace, `tsconfig.dom.${resolution}.json`);
        await writeFile(domConfig, JSON.stringify({
            compilerOptions: { ...compilerOptions, lib: ["ES2022", "DOM"], noEmitOnError: true, outDir },
            files: ["consumer.ts", "custom-objects.ts", "player.ts", "viewport.ts", "worker.ts", "graph.ts", "graph-canvas.ts", "tree.ts", "tree-canvas.ts", "grid.ts", "grid-canvas.ts", "list.ts", "list-player.ts", "list-canvas.ts"]
        }));
        execFileSync(process.execPath, [compiler, "-p", domConfig], { stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "consumer.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "graph.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "tree.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "list-canvas.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "list.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "grid.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "grid-canvas.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "tree-canvas.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "graph-canvas.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "player.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "viewport.js")], { cwd: workspace, stdio: "inherit" });
        execFileSync(process.execPath, [join(workspace, outDir, "worker.js")], { cwd: workspace, stdio: "inherit" });
        const workerConfig = join(workspace, `tsconfig.worker.${resolution}.json`);
        await writeFile(workerConfig, JSON.stringify({
            compilerOptions: { ...compilerOptions, lib: ["ES2022", "WebWorker"], noEmit: true }, files: ["worker-runtime.ts"]
        }));
        execFileSync(process.execPath, [compiler, "-p", workerConfig], { stdio: "inherit" });
        console.log(`TypeScript ${compilerVersion} / ${resolution}: headless, DOM and runtime consumer passed`);
    }
    await copyFile(join(root, "examples/minimal.mjs"), join(workspace, "minimal.mjs"));
    const minimalTest = (await readFile(join(root, "test/minimal-example.test.mjs"), "utf8"))
        .replace("../examples/minimal.mjs", "./minimal.mjs");
    await writeFile(join(workspace, "minimal.test.mjs"), minimalTest);
    execFileSync(process.execPath, ["--test", join(workspace, "minimal.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/canvas-viewport.test.mjs"), join(workspace, "viewport.test.mjs"));
    execFileSync(process.execPath, ["--test", join(workspace, "viewport.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/playback-reentrancy.test.mjs"), join(workspace, "playback-reentrancy.test.mjs"));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "playback-reentrancy.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/async-source.test.mjs"), join(workspace, "async-source.test.mjs"));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "async-source.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/player-test-dom.mjs"), join(workspace, "player-test-dom.mjs"));
    for (const name of ["list.test.mjs", "list-playback.test.mjs", "list-test-fixtures.mjs"])
        await copyFile(join(root, `test/${name}`), join(workspace, name));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "list.test.mjs"), join(workspace, "list-playback.test.mjs")], { cwd: workspace, stdio: "inherit" });
    for (const name of ["grid.test.mjs", "grid-playback.test.mjs", "grid-test-fixtures.mjs"])
        await copyFile(join(root, `test/${name}`), join(workspace, name));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "grid.test.mjs"), join(workspace, "grid-playback.test.mjs")], { cwd: workspace, stdio: "inherit" });
    for (const name of ["tree.test.mjs", "tree-playback.test.mjs", "tree-test-fixtures.mjs"])
        await copyFile(join(root, "test", name), join(workspace, name));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "tree.test.mjs"), join(workspace, "tree-playback.test.mjs")], { cwd: workspace, stdio: "inherit" });
    for (const name of ["graph.test.mjs", "graph-dynamic.test.mjs"])
        await copyFile(join(root, "test", name), join(workspace, name));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test",
        join(workspace, "graph.test.mjs"), join(workspace, "graph-dynamic.test.mjs")], { cwd: workspace, stdio: "inherit" });
    for (const name of ["graph-captions.test.mjs", "graph-canvas.test.mjs", "graph-canvas-context.mjs", "graph-canvas-fixtures.mjs",
        "graph-topology-canvas.test.mjs", "graph-topology-fixture.mjs", "graph-edge-labels.test.mjs", "graph-edge-label-fixtures.mjs"])
        await copyFile(join(root, "test", name), join(workspace, name));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "graph-canvas.test.mjs"),
        join(workspace, "graph-captions.test.mjs"), join(workspace, "graph-topology-canvas.test.mjs"),
        join(workspace, "graph-edge-labels.test.mjs")], { cwd: workspace, stdio: "inherit" });
    for (const name of ["tree-canvas.test.mjs", "tree-canvas-playback.test.mjs", "tree-canvas-context.mjs", "tree-canvas-fixtures.mjs", "tree-slot-bounds.test.mjs", "tree-slot-fixtures.mjs", "tree-slot-oracle.mjs"])
        await copyFile(join(root, "test", name), join(workspace, name));
    execFileSync(process.execPath, ["--test", join(workspace, "tree-canvas.test.mjs"), join(workspace, "tree-canvas-playback.test.mjs"), join(workspace, "tree-slot-bounds.test.mjs")], { cwd: workspace, stdio: "inherit" });
    for(const name of ["grid-canvas.test.mjs","grid-canvas-playback.test.mjs","grid-canvas-fixtures.mjs","list-canvas.test.mjs"])
        await copyFile(join(root,"test/"+name),join(workspace,name));
    execFileSync(process.execPath,["--test",join(workspace,"grid-canvas.test.mjs"),join(workspace,"grid-canvas-playback.test.mjs"),join(workspace,"list-canvas.test.mjs")],{cwd:workspace,stdio:"inherit"});
    for (const name of ["array-result.test.mjs", "array-item-label.test.mjs"])
        await copyFile(join(root, "test", name), join(workspace, name));
    execFileSync(process.execPath, ["--test", join(workspace, "array-result.test.mjs"), join(workspace, "array-item-label.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/player-async.test.mjs"), join(workspace, "player-async.test.mjs"));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "player-async.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/worker-test-transport.mjs"), join(workspace, "worker-test-transport.mjs"));
    await copyFile(join(root, "test/worker-shared-buffer.test.mjs"), join(workspace, "worker-shared-buffer.test.mjs"));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "worker-shared-buffer.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/worker-source.test.mjs"), join(workspace, "worker-source.test.mjs"));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "worker-source.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/worker-post-errors.test.mjs"), join(workspace, "worker-post-errors.test.mjs"));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "worker-post-errors.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/player-worker.test.mjs"), join(workspace, "player-worker.test.mjs"));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "player-worker.test.mjs")], { cwd: workspace, stdio: "inherit" });
    for (const name of ["player-steps.test.mjs", "player-step-history.test.mjs"])
        await copyFile(join(root, "test", name), join(workspace, name));
    execFileSync(process.execPath, ["--test", join(workspace, "player-steps.test.mjs"), join(workspace, "player-step-history.test.mjs")], { cwd: workspace, stdio: "inherit" });
    await copyFile(join(root, "test/player-speed.test.mjs"), join(workspace, "player-speed.test.mjs"));
    execFileSync(process.execPath, ["--unhandled-rejections=strict", "--test", join(workspace, "player-speed.test.mjs")], { cwd: workspace, stdio: "inherit" });
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
