# Lattice Frontend

Developer-oriented control plane for Lattice's backend — manage organizations, content types, schema versions, fields, and entries.

Vite + React 19 + TypeScript + Tailwind + React Router.

## Run locally

**Prerequisites:** Node.js, and the Lattice backend running (see `../backend`).

```
npm install
cp .env.example .env
npm run dev
```

## Roles in the UI

There is one app for everyone. The organization routes return `my_role` (0 viewer, 1 editor, 2 admin, 3 owner), and the pages decide what to show from it:

- `src/lib/roles.ts` holds the role numbers, one table of the minimum role per action (`MINIMUM_ROLE`, mirroring the backend), the role summaries and the soft colour per role.
- `src/lib/org-context.tsx` gives pages `useCan()`: `const can = useCan(); can("editEntries") && <Button>...`.
- `src/components/RoleBadge.tsx` draws a role label, so the colours are the same everywhere.
- Hiding a button is only a courtesy. The backend is the only real gate.

Routes outside an organization: `/account` (your roles and invitations) and `/` (opens your first organization, or the dashboard for people who belong to none). An organization URL you are not a member of redirects to `/`.
