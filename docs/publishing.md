# Publishing the package

[README](../README.md) · [Русский](ru/publishing.md)

## Release

Publishing is a maintainer action. Update the package version, lockfile and changelog;
run `npm test` and `npm run test:package`, commit and push, and check CI on the
candidate commit.

The [publish workflow](https://github.com/urffin/algiviz/blob/master/.github/workflows/npm-publish.yml) runs when a stable GitHub
Release is published. Drafts, prereleases and tag pushes alone do not publish.
Use `v` followed by the exact package version, such as `v0.8.0`, at the tested commit.

The workflow uses Node.js 24 and npm 11, checks the version and packed consumer,
then publishes with provenance through npm trusted publishing (OIDC).
The publish lifecycle also runs tests and rebuilds. No `NPM_TOKEN` secret is required.

The npm trusted publisher must match GitHub owner `urffin`, repository `algiviz`
and workflow `npm-publish.yml`. The workflow does not use a GitHub environment.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

After publication, verify the Actions run and the exact version in npm.
Never reuse an already published npm version. If a workflow fails, check whether
publication occurred before deciding whether to rerun it.
