# Full-site UI deployment — 2026-10-08

- Public site: https://shhuang.cc/
- Version/tag: 1.17.1 / v1.17.1
- Frozen source commit: 35c1e519d7fc2ae6ab52e9ef0e41d48d36bb933e
- Current release: /home/ccc/apps/afterhours/releases/35c1e51
- Rollback release retained: releases/6be11b4 (1.17.0)
- Backup: /home/ccc/apps/afterhours/shared/backups/full-site-ui-20261008T070726Z

## Verified

- Complete suite: 1,526 passed; focused suite: 13 passed.
- Responsive review: 75 final screenshots; no document horizontal overflow or page errors.
- Frozen release smoke: version 1.17.1, 11 exact assets, 21 exact themed HTML pages, authentication redirect.
- After switch: origin version 1.17.1, 11 exact assets; service and tunnel active; node PID 193262.
- SQLite integrity check: ok; schema unchanged; all 23 non-session tables match the online pre-deployment backup.
- Real browser at shhuang.cc: new create-room dialog shows saved-account-name notice and only room-name input; poker entry shows the same notice; lobby renders six-game carousel and connected character area.
- Multiplayer gameplay and account-name mutations were verified only in the isolated test database. No production test rooms or profile modifications were performed.

Distinct game layouts are retained. Main/action panels align at their top with consistent spacing; drawing canvas, race track and poker board retain their original behavior. See README.md and aligned/ for evidence and verification limits.

This deployment record is a subsequent documentation-only change; the release tag stays pinned to the frozen source commit above.
