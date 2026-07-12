# GitNexus vendor tree (PolyForm Noncommercial)

- `gitnexus-upstream/` — sparse clone of https://github.com/abhigyanpatwari/GitNexus @ c6445096
- `gitnexus` / `gitnexus-web` — junctions into the upstream package dirs
- `LICENSE.GitNexus`, `NOTICE`, `COMMERCIAL.md` — license obligations

AgentOX runtime uses `server/src/codebaseIntelligence/gitnexus/` as the
integration bridge (analyze → tools → wiki). Native Ladybug `run-analyze` from
the vendored package can be enabled later via `CODEBASE_GITNEXUS_NATIVE=1`
after commercial rights and native deps are in place.

Required Notice: Copyright Abhigyan Patwari (https://github.com/abhigyanpatwari/GitNexus)
