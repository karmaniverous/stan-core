### Changelog

All notable changes to this project will be documented in this file. Dates are displayed in UTC.

#### [0.2.0](https://github.com/karmaniverous/stan-core/compare/0.1.3...0.2.0)

- docs(project): add Zod schema/type naming convention [`f37f7ff`](https://github.com/karmaniverous/stan-core/commit/f37f7ffd9096a5d8dcfa8b13ee14deb361f482e9)
- docs(dev-plan): append-only Completed, no timestamp, no numbering; Completed last [`87e73d1`](https://github.com/karmaniverous/stan-core/commit/87e73d198089573219f56e8342ac49d5608f5b26)
- chore(interop): post core-config slimming + CLI config extraction plan/code to stan-cli [`f33a448`](https://github.com/karmaniverous/stan-core/commit/f33a448ad82e4682a22118b02cfa8e1d79da9f24)

#### [0.1.3](https://github.com/karmaniverous/stan-core/compare/0.1.1...0.1.3)

> 9 October 2025

- docs(system): clarify diagnostics and post‑patch listing [`faa23b2`](https://github.com/karmaniverous/stan-core/commit/faa23b2c7e7b7dc95e78e94bd1a2303af66e1f7c)
- chore: release v0.1.3 [`9e77d7f`](https://github.com/karmaniverous/stan-core/commit/9e77d7f0e01f2ea28575f6f92581f8b1add8a535)
- fixed system prompt generator & updated prompt [`349e1d4`](https://github.com/karmaniverous/stan-core/commit/349e1d4e8d5e9939935cc762cf8d99fa86d3591e)
- docs(system): make diagnostics listings mandatory; remove legacy “optional on request” [`40ab4dc`](https://github.com/karmaniverous/stan-core/commit/40ab4dc50b272c96bf667eefbc978c46b539ce12)

#### [0.1.1](https://github.com/karmaniverous/stan-core/compare/0.1.0...0.1.1)

> 7 October 2025

- docs(system): 300‑LOC hard gate + decomposition; diagnostics = listings only [`7363cd6`](https://github.com/karmaniverous/stan-core/commit/7363cd68b74e0fbb06dad7f0f1907c82d1eb05c3)
- chore: release v0.1.1 [`e7815da`](https://github.com/karmaniverous/stan-core/commit/e7815dac4f3678352791d4829c467cf82cb06525)

#### 0.1.0

> 6 October 2025

- Initial commit [`1494037`](https://github.com/karmaniverous/stan-core/commit/1494037cdc692696f4fd4eecfdecdf0b5d6a5ea1)
- chore(core): remove CLI adapters/runner and CLI-only deps from stan-core [`13f0e9e`](https://github.com/karmaniverous/stan-core/commit/13f0e9eea4a2f000397d8edce500493548d3d5e8)
- renamed repo & updated version [`2e447bc`](https://github.com/karmaniverous/stan-core/commit/2e447bc23bc705c9d6da890706c947cf4160af3e)
- chore: release v0.1.0 [`df558ba`](https://github.com/karmaniverous/stan-core/commit/df558ba5d49dce4afc8fcf6b92dacc9d681694ee)
- docs(core/cli): swappable core + interop threads [`cea12e3`](https://github.com/karmaniverous/stan-core/commit/cea12e3b9eb9e3b9dfc9ea7dbffcd0935d23e68f)
- docs(core): prune CLI content; converge requirements and plan on stan-core [`f81d10f`](https://github.com/karmaniverous/stan-core/commit/f81d10f41e3ceabd6e6e9be157c3295d5ab48899)
- updated dependencies [`3dbb202`](https://github.com/karmaniverous/stan-core/commit/3dbb20200388b65078a10187e41d5f36c1d8bdfd)
- feat(core): export patch/imports; update README [`5877692`](https://github.com/karmaniverous/stan-core/commit/58776928481adc66fb92cb1ce42ae44976957fa9)
- refactor(core): remove presentation helpers; export CORE_VERSION; fix TSDoc [`dde1c6a`](https://github.com/karmaniverous/stan-core/commit/dde1c6a040ff0a0c5aac58de28f29b75311cc719)
- chore(core): remove readPatchSource; move acquisition to CLI [`57cb5be`](https://github.com/karmaniverous/stan-core/commit/57cb5be140b26f1de1daf7f1c310dafb2ad159d7)
- feat(patch): creation-fallback; docs: re-export public types [`b9d4f44`](https://github.com/karmaniverous/stan-core/commit/b9d4f44bdeb859b35609bcaf370be77e6037b729)
- refactor(core): surface archive/imports notes via callbacks; remove console I/O [`2f182d4`](https://github.com/karmaniverous/stan-core/commit/2f182d4626af92823e61800c0c1e34e3ad7fb619)
- chore(knip+interop): ignore unused helpers; ask CLI if needed [`958d986`](https://github.com/karmaniverous/stan-core/commit/958d98664736caae48cff395a7ce6b7a8da4bc50)
- fix(config): align Zod v4 record + scripts typing [`bcc1164`](https://github.com/karmaniverous/stan-core/commit/bcc11642fa8609a574c81672958d54a8f2c1dd00)
- chore(core): add interop notes for stan-cli safe deletions [`3228fae`](https://github.com/karmaniverous/stan-core/commit/3228fae069b32ab292f75d2dc09ccea4510fdb4f)
- chore(interop): confirm top-level exports for stan-cli wiring [`5bd4470`](https://github.com/karmaniverous/stan-core/commit/5bd44709914e9c3591e89e4bd780cfff3938704b)
- refactor(core): remove clipboard import; inject clipboardRead [`5160037`](https://github.com/karmaniverous/stan-core/commit/5160037ca360e581eaef2282ce8978ad6aafc1d5)
- chore(plan): advance core/CLI decomposition and console‑free surfaces [`7b1e795`](https://github.com/karmaniverous/stan-core/commit/7b1e7957911342723aa6a706217e98421c0e3731)
- refactor(core): inject clipboard read into patch source; remove clipboard dep from engine [`1b967f1`](https://github.com/karmaniverous/stan-core/commit/1b967f1bdd1a36c3ab5f544e131d3df85ee121ae)
- chore(core): finalize top-level exports and types path for CLI wiring [`2046003`](https://github.com/karmaniverous/stan-core/commit/2046003b021abea400ebd21a7e409660184362d8)
- fix(config): normalize scripts type-mismatch message [`df0bc32`](https://github.com/karmaniverous/stan-core/commit/df0bc3283f5947176d0446ef65fbb4701f958ea9)
- chore(lint/docs): fix tsdoc/regex lint; re-export ApplyResult for docs [`dd8cad0`](https://github.com/karmaniverous/stan-core/commit/dd8cad035629fd007bf7686848fd933583eec959)
