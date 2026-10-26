# Contributing to AlgiViz

## Development

Requires Node.js 22 or later and npm.

```sh
npm ci
npm test
npm run test:package
```

`npm test` builds the library, checks TypeScript fixtures and runs the tests.
`npm run test:package` builds a tarball, installs it offline in an isolated temporary
consumer, compiles against the installed declarations and exercises public APIs,
including rejection of the removed `/core` export. The temporary consumer is removed afterward.

GitHub Actions runs both checks on pushes to `master` and pull requests, using
Node.js 22 and 24 on Linux and Windows. CI checks do not publish packages.

`npm pack` rebuilds automatically. The archive includes dist, README, LICENSE,
CHANGELOG and package metadata. Source and issues:
[urffin/algiviz](https://github.com/urffin/algiviz). Licensed under MIT.

[Benchmarks](https://github.com/urffin/algiviz/blob/master/docs/performance.md) · [Publishing](https://github.com/urffin/algiviz/blob/master/docs/publishing.md)
