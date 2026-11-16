# Tally

A simple, warm time tracker that installs to the iPhone home screen.

- **Today:** tap an activity to start its timer; tap another to switch.
- **Entries:** every session, editable, plus manual entries.
- **Week / Month:** where the time went, by activity and by day.
- Works offline. Signing in syncs data across devices through Supabase.

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # production build in dist/
```

The project carries its own Node 22 (the `node` dev dependency), so `npm run`
scripts work even where the system Node is older.

Pushing to `main` deploys to GitHub Pages.

## How it fits together

- `src/db.ts` is the local database (IndexedDB). The UI only reads and writes this.
- `src/sync.ts` mirrors it to Supabase in the background; the last edit wins.
- `src/stats.ts` and `src/time.ts` turn entries into weekly and monthly totals.
- `supabase/schema.sql` is the database schema, including row-level security.
- `scripts/make-icons.mjs` regenerates the PNG icons from `public/icon.svg`.
