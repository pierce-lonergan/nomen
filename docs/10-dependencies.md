# Dependencies, and one advisory that is deliberately not "fixed"

Five runtime dependencies: `react`, `react-dom`, `react-router-dom`, `zustand`, `idb`. Everything
else — the 3D renderer, the audio synthesis, the image pipeline, the bust generator — is written
here rather than installed, because each of those would have cost more in bytes and in supply-chain
surface than it saved in code.

## `npm audit` reports 2 high-severity advisories, and the fix makes things worse

```
react-router  7.12.0 - 8.2.0
  React Router: RSC Mode CSRF Bypass Allows Action Execution Before 400 Response
  GHSA-qwww-vcr4-c8h2
```

**This is not reachable in this app.** The advisory is specific to React Router's RSC mode: server
actions executing before a rejected request returns 400. Nomen is a static SPA with `HashRouter`,
no server, no loaders, no actions, no RSC, and no runtime network calls at all. There is no request
to forge and nothing on a server to execute.

**And `npm audit fix --force` actively degrades security here.** There is no forward-patched
release: the only remediation npm offers is a *downgrade* to `react-router-dom@7.11.0`. Measured,
that trades one non-applicable advisory for **four applicable ones**:

| Downgrading to 7.11.0 introduces | |
| --- | --- |
| `GHSA-2w69-qvjg-hvjx` | XSS via open redirects |
| `GHSA-8v8x-cx79-35w7` | SSR XSS in `ScrollRestoration` |
| `GHSA-49rj-9fvp-4h2h` | RCE via vendored `turbo-stream` deserialisation |
| `GHSA-2j2x-hqr9-3h42` | Open redirect via protocol-relative URL reinterpretation |

So the project stays on the latest release (`7.18.2`) and carries the advisory knowingly. Taking
the "fix" would clear a scanner and leave the app less safe, which is the same category of error as
a green badge on a drill that does nothing.

**Revisit when** a patched `react-router` ≥ 8.2.1 ships. At that point the bump is free and should
be taken. Until then this file is the record of the decision, so nobody has to re-derive it from a
scanner output at three in the morning.

## What is checked, and where

- `npm audit` is **not** a deploy gate, precisely because of the above: a gate that can be satisfied
  by making the app less secure is not a gate, it is a ritual. The four real gates —
  tests, contrast, typecheck+build, browser smoke — all fail the deploy.
- No dependency is loaded at runtime from a CDN. `tests/typography.test.ts` asserts the stylesheets
  fetch nothing remote, and there is no `<script src>` to a third party anywhere.
- The service worker caches same-origin build output only, and never a person's records.
