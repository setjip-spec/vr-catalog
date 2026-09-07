# APP-002 — VR Catalog — RECOVERY

## Canonical sources

1. GitHub repository: https://github.com/setjip-spec/vr-catalog
2. Canonical ТЗ: `docs/APP-002-TZ.md`
3. Live URL: https://setjip-spec.github.io/vr-catalog/
4. User DATA: Supabase `MINI-APPS-CLOUD`, row `APP-002` in `mini_app_state`
5. Independent disaster-recovery snapshot: Google Drive `03 MINI APPS — BACKUP SAFE`

## Normal recovery

If code is broken but GitHub is available:

1. use Git history / previous commit;
2. restore working files in `main`;
3. wait for GitHub Pages deployment;
4. verify the live URL;
5. verify Supabase login and user-state loading.

## Disaster recovery if repository is lost

1. open the latest Google BACKUP SAFE snapshot for APP-002;
2. restore the repository source snapshot ZIP;
3. create a new GitHub repository, preferably preserving APP-ID `APP-002`;
4. restore `docs/APP-002-TZ.md`, README, LINKS and source files;
5. enable GitHub Pages from `main` / root;
6. restore/update the live URL in `docs/LINKS.md` and REGISTRY;
7. reconnect to Supabase project `MINI-APPS-CLOUD` using the public Project URL and publishable key;
8. verify `mini_app_state` contains APP-002 for the user;
9. if cloud DATA is lost, restore the APP-002 JSON snapshot from Google BACKUP SAFE;
10. test login, status/comment saving, F5 persistence and phone synchronization;
11. create a fresh Google BACKUP SAFE snapshot after recovery.

## Important

- Never put Supabase `service_role`/secret keys in GitHub Pages.
- The publishable key is allowed in frontend code; RLS protects user rows.
- Static catalog data lives in GitHub `data-*.js`.
- Supabase stores personal state: edits, saved views, filter/column/sort state.
- `localStorage` is only a fast cache / migration fallback, not the only copy of personal data.
