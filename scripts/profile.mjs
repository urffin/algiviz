import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { profileWorkloads, profileWorkload, createProfileMock, profileSize, profilePolicy } from '../test/profile-workloads.mjs';
const { values } = parseArgs({ options: { profile: { type: 'boolean' }, output: { type: 'string' } } });
const report = { environment: { runtime: process.version, platform: process.platform, arch: process.arch,
    cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, date: new Date().toISOString(),
    sceneSourceSha256: createHash('sha256').update(await fs.readFile('src/scene/index.ts')).digest('hex'),
    sourceChanges: execFileSync('git', ['status', '--porcelain', '--', 'src/scene/index.ts'], { encoding: 'utf8' }).trim(),
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), libraryVersion: JSON.parse(await fs.readFile('package.json', 'utf8')).version,
    harnessSha256: createHash('sha256').update(await fs.readFile(new URL('../test/profile-workloads.mjs', import.meta.url))).digest('hex'),
    canvas: profileSize, backend: 'counting mock Canvas; JS CPU only' }, policy: profilePolicy, workloads: [] };
for (const workload of profileWorkloads) {
    const mock = createProfileMock();
    const row = await profileWorkload(workload, { context: mock.context });
    report.workloads.push(row);
    console.log(JSON.stringify({ name: row.name, objects: row.objects, ms: Object.fromEntries(Object.entries(row.phases).map(([key, value]) => [key, +value.medianMs.toFixed(5)])) }));
}
if (values.output) await fs.writeFile(path.resolve(values.output), JSON.stringify(report, null, 2));
console.log('Completed ' + report.workloads.length + ' real-example profiles; stages overlap, not FPS.');
