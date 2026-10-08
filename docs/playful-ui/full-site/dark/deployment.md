# Dark appearance deployment — 2026-10-08

- Public site: https://shhuang.cc/
- Version/tag: 1.18.0 / v1.18.0
- Frozen tested source: 8a1d0e1e980718afaf47a00d48aae8d85afcd3d6
- Maintenance branch: style/playful-paper
- Current release: /home/ccc/apps/afterhours/releases/8a1d0e1
- Rollback retained: releases/35c1e51 (1.17.1)
- Backup: /home/ccc/apps/afterhours/shared/backups/dark-mode-20261008T074527Z
- Original saved style branch remains archive/playful-paper-v1.17.1 at ba0811b233a8727e457dbcf147c4587a47e27d1b.

## Verification

- Linux complete suite: 1,532 passed, 0 failed/cancelled/skipped, 259,241.80725ms. Final targeted tests: 38 passed.
- Browser review: 78 dark screenshots across desktop/tablet/mobile, zero page errors or document horizontal overflow; five game starts and scoped three-seat gameplay, drawing transport and 200% text checked in an isolated temporary database.
- Manual appearance: keyboard toggle, saved preference on reload, same-origin tab sync, restoring system preference, open form draft retention, header/focus at 320/390/768/1440 verified.
- Fixed normal-text/solid-background contrast samples: no failing entries in the final page and scoped gameplay-state audits. This is not full WCAG or assistive-technology certification.
- Frozen archive smoke: 1.18.0, 15 exact assets, anonymous auth redirect and 21 exact themed HTML pages; temporary database only.
- Origin after switch: 1.18.0 and 15 exact assets; service and tunnel active; service PID 197241.
- SQLite integrity: ok; schema unchanged; all 23 non-session tables match the pre-deployment online backup.
- Real public browser, authenticated lobby: settings/button/avatar order, actual light→dark button response, appearance options and version v1.18.0 verified. No production rooms or account settings were changed; the appearance choice is local to the browser.
- Real public anonymous Chromium: /login responds 200, follows dark media preference, toggles to light and retains it after reload. Public screenshots: public-login-dark.png and public-login-light.png.

Business/game APIs, room synchronization, original character movement and drawing renderer remain unchanged. The only server-source change adds the fixed public static route for the appearance bootstrap. No dependencies added. Remaining verification limits are documented in ../../DARK-MODE.md.

This is a documentation-only follow-up; the immutable release tag remains pinned to the frozen source above. No GitHub push or merge was performed.
