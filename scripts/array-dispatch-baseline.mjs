import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

// Includes the scene cache, but still creates an array dispatcher on each draw.
export const baselineCommit = '25040d157527e7564bde088b3c5b76bdcc398ecf';
export function baselineModule(sceneUrl = new URL('../dist/scene/index.js', import.meta.url).href) {
    // Frozen copy of that commit, so tests also work in CI's shallow checkout.
    const source = readFileSync(new URL('../test/fixtures/array-dispatch-before.ts', import.meta.url), 'utf8');
    const javascript = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
    }).outputText.replace('"../scene/index.js"', JSON.stringify(sceneUrl));
    return { javascript, sha256: createHash('sha256').update(source).digest('hex') };
}
export async function loadBaseline() {
    return import('data:text/javascript;base64,' + Buffer.from(baselineModule().javascript).toString('base64'));
}
