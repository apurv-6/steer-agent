# Project State: SteerAgent

## Current Phase
**Phase**: 1 — Core Infrastructure & Pilot Reliability
**Status**: Not started
**Plan**: Not yet created

## Session Context
- GSD workflow initialized: 2026-02-24
- PROJECT.md committed: bd2b7a9
- config.json committed: b99a3e3
- Research committed: 25a474e
- REQUIREMENTS.md committed: cc077c4
- ROADMAP.md committed: (pending)

## Key Decisions
- Zod 3.x frozen (MCP SDK requires it)
- EventBus + SessionStore in core (not extension-specific)
- File-based IPC for hook-to-extension bridge (signal file + FileSystemWatcher)
- MCP is primary integration path (chat participant may fail in Cursor)
- Advisory mode default (suggest-only, not blocking by default)
- YOLO execution mode, comprehensive depth, quality models

## Notes
- v0.2 code exists with working scoring, patching, routing — needs cohesion, not rewrite
- CoinSwitch pilot: 14 devs, measure throughput/cost/first-pass success
- Hook `user_message` field needs empirical Cursor testing
