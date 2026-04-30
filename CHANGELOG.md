# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## [0.2.0] - 2026-04-30

### Added
- Badge followed users' avatars with a green checkmark on GitHub pages (#1).
- Slide-in-from-right animation for the sidebar panel (#2).
- D3.js contributor collaboration graph in the sidebar (#4, #6).
- Private-repo support via cookie-based auth (#5).
- Installer: `--browser-path` flag and an "Other" menu option for Chrome for Testing.
- Installer: list all known browsers in the menu and auto-install missing ones.

### Fixed
- Installer: use full binary path in `pgrep` to avoid false-positive browser detection.
- Installer: remove `local` keyword from main script body for bash 3.2 compatibility.
- Installer: dynamic `/Applications` scan instead of hardcoded browser list.
- Installer: replace `mapfile` with a `while read` loop for bash 3.2 compatibility (macOS default).

### Docs
- Added collaboration graph mockup for issue #4.

## [0.1.2] - 2026-03-27

Initial public release.

[0.2.0]: https://github.com/xinbenlv/github-richcard/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/xinbenlv/github-richcard/releases/tag/v0.1.2
