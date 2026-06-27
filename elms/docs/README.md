# ELMS — Developer Package

Documentation for developers working on the ELMS Training Management System.

| Doc | What's in it |
|-----|--------------|
| **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** | Run it, project structure, conventions, **how-to-edit recipes**, wiring AI to real Claude, build & deploy. Start here. |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | One-page data-flow diagram and the five key ideas behind the design. |
| **[FUNCTION-REFERENCE.md](./FUNCTION-REFERENCE.md)** | **Every function, component, hook, type and data constant explained**, file by file. |

### 60-second orientation
1. `npm install && npm run dev` in `elms/` → http://localhost:5174
2. Sign in with a demo chip (Amara Okafor = admin).
3. Data lives in `src/data/seed.ts`; status logic in `src/lib/domain.ts`; AI in `src/lib/ai.ts`; state in `src/store/store.tsx`; screens in `src/pages/`.
4. To change what Green/Amber/Red means → `computeRag` in `src/lib/domain.ts`.
5. To make the AI live → swap `think(...)` for `callClaude(...)` in `src/lib/ai.ts` (see the Developer Guide §7).
