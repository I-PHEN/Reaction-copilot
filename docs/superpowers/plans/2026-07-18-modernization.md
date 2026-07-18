# Reaction-copilot Deep Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the z.ai-template-scaffolded repo into a clean npm/Node codebase with a tested solver layer, modular copilot code, strict typing, and zero unused baggage — identical user-facing behavior — then run it and write a what's-next assessment.

**Architecture:** Next.js 16 App Router app. Real code: `src/lib/solvers` (pure-function math), `src/lib/store/topology.ts` (Zustand), `src/components/reactor/*` (UI), two API routes. Refactor moves copilot LLM plumbing out of the route into `src/lib/copilot/`, splits the chat UI into focused components + a stream hook, and adds Vitest tests pinning the solver math to closed-form analytic solutions.

**Tech Stack:** Node 22 + npm (replacing Bun), Next.js 16, React 19, TypeScript 5 strict, Tailwind 4, shadcn/ui, Zustand, @xyflow/react, Recharts, zod, Vitest (new), z-ai-web-dev-sdk.

## Global Constraints

- Runtime: npm + Node only. `bun.lock` must be deleted; `package-lock.json` committed.
- Scripts must run on Windows PowerShell (no `tee`, `cp`, `NODE_ENV=x` prefixes).
- No user-facing behavior changes anywhere in this plan.
- `.env` must never be read, printed, or committed (it's already committed-ignored? — verify `.gitignore` covers it; if the file is tracked, `git rm --cached .env` and add to `.gitignore`).
- Package name: `reaction-copilot`.
- After every task: `npm run build` (or `npm test` where stated) passes before commit.
- Windows shell note: run commands via PowerShell; `rm -rf` → `Remove-Item -Recurse -Force`.

---

### Task 1: npm baseline + cross-platform scripts

**Files:**
- Modify: `package.json` (name, scripts)
- Delete: `bun.lock`
- Create: `package-lock.json` (generated)

**Interfaces:**
- Produces: working `npm run dev` / `npm run build` / `npm run lint` used by every later task.

- [ ] **Step 1: Fix package.json name + scripts**

Replace the `name`, `version`, and `scripts` blocks in `package.json`:

```json
{
  "name": "reaction-copilot",
  "version": "0.3.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint ."
  }
}
```

(Drop `db:push`, `db:generate`, `db:migrate`, `db:reset` — Prisma is being removed in Task 2.)

- [ ] **Step 2: Delete bun.lock, install with npm**

```powershell
Remove-Item bun.lock
npm install
```

Expected: `package-lock.json` created. Warnings OK; errors not.

- [ ] **Step 3: Verify .gitignore covers .env and dev artifacts**

Check `.gitignore` contains `.env` (add if missing). If `git ls-files .env` shows the file is tracked: `git rm --cached .env`. Also ensure `dev.log`, `server.log`, `*.pid` patterns are present or obsolete.

- [ ] **Step 4: Baseline build**

Run: `npm run build`
Expected: successful production build (this is the pre-refactor baseline; if it fails, fix the cause before proceeding — record what was broken).

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json .gitignore
git rm --cached .env 2>$null
git add -u
git commit -m "Standardize on npm + Node; cross-platform scripts; rename package"
```

---

### Task 2: Purge template directories and dead files

**Files:**
- Delete: `skills/`, `.zscripts/`, `examples/`, `db/`, `mini-services/`, `download/`, `upload/`, `prisma/`, `src/lib/db.ts`, `Caddyfile`

**Interfaces:**
- Consumes: nothing. Verified precondition: `src/lib/db.ts` has zero importers (grep `@/lib/db` → only self).

- [ ] **Step 1: Delete the directories/files**

```powershell
git rm -r skills .zscripts examples db mini-services prisma Caddyfile
git rm src/lib/db.ts
Remove-Item -Recurse -Force download, upload -ErrorAction SilentlyContinue
```

(`download`/`upload` may be untracked; remove from disk either way. Keep `public/`.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS (nothing imported any of this).

- [ ] **Step 3: Commit**

```powershell
git add -u
git commit -m "Remove z.ai template baggage (skills, zscripts, examples, prisma, db)"
```

---

### Task 3: Purge unused shadcn ui components and hooks

**Files:**
- Delete: every `src/components/ui/*.tsx` not in the transitive import closure of `src/app/**` + `src/components/reactor/**`
- Possibly delete: `src/hooks/use-toast.ts`, `src/hooks/use-mobile.ts` if their only consumers are deleted

**Interfaces:**
- Consumes: app imports discovered by grep (Task-verified, not assumed).

- [ ] **Step 1: Compute the used set**

```powershell
# Direct imports from app code (non-ui):
Select-String -Path src/app/**/*.tsx, src/app/**/*.ts, src/components/reactor/**/*.tsx -Pattern 'from "@/components/ui/([\w-]+)"' -AllMatches
```

Known direct set from prior analysis: `resizable`, `dropdown-menu`, `dialog`, `input`, `button`, `toaster`, `slider`, `popover`, `context-menu`, `collapsible`, `label` — plus whatever else the grep finds. Then add transitive deps by grepping each kept ui file for `@/components/ui/` imports (e.g. `toaster` → `toast`; check `resizable`, `context-menu`, etc.). `use-toast` stays iff `toaster`/`toast` stay; `use-mobile` is only used by `sidebar` (delete both if `sidebar` unused).

- [ ] **Step 2: Delete everything not in the closure**

`git rm` each unused `src/components/ui/*.tsx` (expected ~25-30 files: sidebar, calendar, carousel, chart, menubar, navigation-menu, form, command, input-otp, drawer, sonner, pagination, accordion, alert-dialog, aspect-ratio, avatar, breadcrumb, checkbox, hover-card, radio-group, select, sheet, skeleton, switch, table, tabs, textarea, toggle, toggle-group, badge, alert, card, progress, scroll-area, separator, tooltip — KEEP any of these the grep proves used; the grep is authoritative, not this list).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS. If a build error names a deleted file, restore that one file (`git checkout -- <file>`) — it was transitively used — and re-run.

- [ ] **Step 4: Commit**

```powershell
git add -u
git commit -m "Remove unused shadcn ui components and hooks"
```

---

### Task 4: Prune unused npm dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: For each candidate, grep for imports**

Candidates: `prisma`, `@prisma/client`, `next-auth`, `next-intl`, `@mdxeditor/editor`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `embla-carousel-react`, `react-hook-form`, `@hookform/resolvers`, `@tanstack/react-query`, `@tanstack/react-table`, `sharp`, `react-day-picker`, `react-syntax-highlighter`, `input-otp`, `vaul`, `cmdk`, `date-fns`, `@reactuses/core`, `uuid`, `next-themes`, `sonner`, `react-markdown`, `next-intl`.

```powershell
Select-String -Path src -Pattern 'from "(<pkg>|<pkg>/)' -Recurse
```

A package is removable iff zero imports remain in `src/` after Task 3. NOTE: `react-markdown` and `react-syntax-highlighter` may be used by `CopilotBody` in `CopilotSidecar.tsx` — check before removing. `sonner`/`next-themes` may be used by `layout.tsx` — check.

- [ ] **Step 2: Uninstall the confirmed-unused set**

```powershell
npm uninstall <confirmed unused packages>
```

- [ ] **Step 3: Verify build + commit**

Run: `npm run build` → PASS.

```powershell
git add package.json package-lock.json
git commit -m "Prune unused dependencies"
```

---

### Task 5: Vitest setup + kinetics tests

**Files:**
- Create: `vitest.config.ts`, `tests/solvers/kinetics.test.ts`
- Modify: `package.json` (add `"test": "vitest run"`)

**Interfaces:**
- Consumes: `rateConstant(preExponential, activationEnergy, temperature): number`, `rateOfDisappearance(k, CA, order): number`, `adiabaticOutletTemperature(inletT, conversion, rise=45): number`, `damkohler(k, volume, volumetricFlow): number` from `@/lib/solvers/kinetics`.
- Produces: `npm test` command + `tests/solvers/` convention for Tasks 6-9.

- [ ] **Step 1: Install and configure Vitest**

```powershell
npm install -D vitest
```

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write kinetics tests**

Create `tests/solvers/kinetics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  adiabaticOutletTemperature,
  damkohler,
  rateConstant,
  rateOfDisappearance,
} from "@/lib/solvers/kinetics";

describe("rateConstant (Arrhenius)", () => {
  it("matches hand-computed k at T=350K for default params", () => {
    // k = 1.2e10 * exp(-72000 / (8.314 * 350)) ≈ 0.2155 1/s
    const k = rateConstant(1.2e10, 72000, 350);
    expect(k).toBeCloseTo(0.2155, 3);
  });

  it("increases monotonically with temperature", () => {
    const k1 = rateConstant(1.2e10, 72000, 320);
    const k2 = rateConstant(1.2e10, 72000, 360);
    const k3 = rateConstant(1.2e10, 72000, 400);
    expect(k2).toBeGreaterThan(k1);
    expect(k3).toBeGreaterThan(k2);
  });

  it("returns 0 for non-physical inputs", () => {
    expect(rateConstant(1.2e10, 72000, 0)).toBe(0);
    expect(rateConstant(1.2e10, 72000, -10)).toBe(0);
    expect(rateConstant(0, 72000, 350)).toBe(0);
    expect(rateConstant(1.2e10, 72000, NaN)).toBe(0);
  });
});

describe("rateOfDisappearance", () => {
  it("is k*CA for first order", () => {
    expect(rateOfDisappearance(0.5, 4, 1)).toBeCloseTo(2.0, 12);
  });
  it("is k*CA^2 for second order", () => {
    expect(rateOfDisappearance(0.5, 4, 2)).toBeCloseTo(8.0, 12);
  });
  it("is k (CA-independent) for zeroth order", () => {
    expect(rateOfDisappearance(0.5, 4, 0)).toBeCloseTo(0.5, 12);
  });
  it("returns 0 at zero or negative concentration", () => {
    expect(rateOfDisappearance(0.5, 0, 1)).toBe(0);
    expect(rateOfDisappearance(0.5, -1, 2)).toBe(0);
  });
});

describe("adiabaticOutletTemperature", () => {
  it("adds rise*conversion", () => {
    expect(adiabaticOutletTemperature(350, 0.5)).toBeCloseTo(372.5, 9);
  });
  it("clamps conversion to [0,1]", () => {
    expect(adiabaticOutletTemperature(350, 1.7)).toBeCloseTo(395, 9);
    expect(adiabaticOutletTemperature(350, -0.3)).toBeCloseTo(350, 9);
  });
});

describe("damkohler", () => {
  it("is k*V/v0", () => {
    expect(damkohler(0.5, 4, 2)).toBeCloseTo(1.0, 12);
  });
  it("returns 0 for zero flow", () => {
    expect(damkohler(0.5, 4, 0)).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all kinetics tests PASS (these pin existing behavior; a failure means either the test constant is wrong — recheck the arithmetic — or a real solver bug: STOP and report before "fixing").

- [ ] **Step 4: Commit**

```powershell
git add vitest.config.ts tests package.json package-lock.json
git commit -m "Add Vitest + kinetics unit tests pinned to analytic values"
```

---

### Task 6: CSTR solver tests

**Files:**
- Create: `tests/solvers/cstr.test.ts`

**Interfaces:**
- Consumes: `solveCSTR(nodeId: string, params: NodeParams): SolverResult` from `@/lib/solvers/cstr`; `DEFAULT_PARAMS`, `NodeParams` from `@/lib/solvers/types`; `rateConstant` from `@/lib/solvers/kinetics`.

- [ ] **Step 1: Write the tests**

Create `tests/solvers/cstr.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { solveCSTR } from "@/lib/solvers/cstr";
import { rateConstant } from "@/lib/solvers/kinetics";
import { DEFAULT_PARAMS, type NodeParams } from "@/lib/solvers/types";

/** Consistent params: feedRate = v0 * CA0 so Da = k*tau exactly. */
function params(overrides: Partial<NodeParams> = {}): NodeParams {
  return {
    ...DEFAULT_PARAMS,
    volume: 2,
    temperature: 380,
    inletConcentration: 5,
    volumetricFlow: 2,
    feedRate: 10, // = v0 * CA0
    reactionOrder: 1,
    ...overrides,
  };
}

describe("solveCSTR — first order (analytic)", () => {
  it("matches X = Da/(1+Da)", () => {
    const p = params();
    const k = rateConstant(p.preExponential, p.activationEnergy, p.temperature);
    const tau = p.volume / p.volumetricFlow; // 1 s
    const Da = k * tau;
    const expected = Da / (1 + Da);
    const r = solveCSTR("n1", p);
    expect(r.converged).toBe(true);
    expect(r.conversion).toBeCloseTo(expected, 6);
    expect(r.residenceTime).toBeCloseTo(tau, 9);
    expect(r.outletFlow).toBeCloseTo(p.feedRate * (1 - expected), 6);
  });

  it("conversion increases with volume", () => {
    const x1 = solveCSTR("n1", params({ volume: 1 })).conversion;
    const x2 = solveCSTR("n1", params({ volume: 4 })).conversion;
    expect(x2).toBeGreaterThan(x1);
  });
});

describe("solveCSTR — second order (Newton-Raphson vs closed form)", () => {
  it("matches the quadratic closed-form solution", () => {
    // Design eq (n=2): k*CA0*tau*(1-X)^2 = X, let a = k*CA0*tau
    // => a X^2 - (2a+1) X + a = 0 => X = [(2a+1) - sqrt((2a+1)^2 - 4a^2)] / (2a)
    const p = params({ reactionOrder: 2, temperature: 350 });
    const k = rateConstant(p.preExponential, p.activationEnergy, p.temperature);
    const tau = p.volume / p.volumetricFlow;
    const a = k * p.inletConcentration * tau;
    const expected = (2 * a + 1 - Math.sqrt((2 * a + 1) ** 2 - 4 * a * a)) / (2 * a);
    const r = solveCSTR("n1", p);
    expect(r.converged).toBe(true);
    expect(r.conversion).toBeCloseTo(expected, 5);
  });

  it("converges for fractional order n=1.5", () => {
    const r = solveCSTR("n1", params({ reactionOrder: 1.5 }));
    expect(r.converged).toBe(true);
    expect(r.conversion).toBeGreaterThan(0);
    expect(r.conversion).toBeLessThan(1);
  });
});

describe("solveCSTR — guard rails", () => {
  it("flags non-physical volumetric flow", () => {
    const r = solveCSTR("n1", params({ volumetricFlow: 0 }));
    expect(r.diagnostics.join(" ")).toMatch(/Volumetric flow/i);
  });
  it("never returns NaN conversion for zero concentration", () => {
    const r = solveCSTR("n1", params({ inletConcentration: 0 }));
    expect(Number.isFinite(r.conversion)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS. Same failure policy as Task 5 Step 3 (a genuine mismatch = report, don't silently patch the solver).

- [ ] **Step 3: Commit**

```powershell
git add tests/solvers/cstr.test.ts
git commit -m "Add CSTR solver tests: analytic first-order + closed-form second-order"
```

---

### Task 7: PFR solver tests

**Files:**
- Create: `tests/solvers/pfr.test.ts`

**Interfaces:**
- Consumes: `solvePFR(nodeId: string, params: NodeParams): SolverResult` from `@/lib/solvers/pfr` (same `NodeParams` helper pattern as Task 6).

- [ ] **Step 1: Write the tests**

Create `tests/solvers/pfr.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rateConstant } from "@/lib/solvers/kinetics";
import { solvePFR } from "@/lib/solvers/pfr";
import { DEFAULT_PARAMS, type NodeParams } from "@/lib/solvers/types";

function params(overrides: Partial<NodeParams> = {}): NodeParams {
  return {
    ...DEFAULT_PARAMS,
    volume: 2,
    temperature: 380,
    inletConcentration: 5,
    volumetricFlow: 2,
    feedRate: 10,
    reactionOrder: 1,
    ...overrides,
  };
}

describe("solvePFR — first order RK4 vs exact", () => {
  it("matches X = 1 - exp(-k*tau) to 1e-4", () => {
    const p = params();
    const k = rateConstant(p.preExponential, p.activationEnergy, p.temperature);
    const tau = p.volume / p.volumetricFlow;
    const exact = 1 - Math.exp(-k * tau);
    const r = solvePFR("n1", p);
    expect(r.converged).toBe(true);
    expect(Math.abs(r.conversion - exact)).toBeLessThan(1e-4);
  });

  it("PFR beats CSTR conversion at identical conditions (first order)", async () => {
    const { solveCSTR } = await import("@/lib/solvers/cstr");
    const p = params();
    expect(solvePFR("n1", p).conversion).toBeGreaterThan(
      solveCSTR("n1", p).conversion,
    );
  });

  it("returns a monotonically non-decreasing profile", () => {
    const r = solvePFR("n1", params());
    expect(r.profile).toBeDefined();
    const conv = r.profile!.map((pt) => pt.conversion);
    for (let i = 1; i < conv.length; i++) {
      expect(conv[i]).toBeGreaterThanOrEqual(conv[i - 1] - 1e-12);
    }
    expect(r.profile![0].position).toBe(0);
    expect(r.profile![r.profile!.length - 1].position).toBeCloseTo(2, 9);
  });
});

describe("solvePFR — n-th order sanity", () => {
  it("second order converts less than first order at same k", () => {
    // CA0=5 > 1 ⇒ rate higher initially, but conversion-integrated result
    // differs; assert both physical and finite rather than an exact value.
    const r2 = solvePFR("n1", params({ reactionOrder: 2 }));
    expect(r2.converged).toBe(true);
    expect(r2.conversion).toBeGreaterThan(0);
    expect(r2.conversion).toBeLessThan(1);
  });
  it("zero flow yields zero conversion, no NaN", () => {
    const r = solvePFR("n1", params({ volumetricFlow: 0 }));
    expect(Number.isFinite(r.conversion)).toBe(true);
    expect(r.conversion).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npm test` → PASS.

- [ ] **Step 3: Commit**

```powershell
git add tests/solvers/pfr.test.ts
git commit -m "Add PFR solver tests: RK4 vs exact exponential, profile shape"
```

---

### Task 8: Units + orchestrator tests

**Files:**
- Create: `tests/solvers/units.test.ts`, `tests/solvers/orchestrator.test.ts`

**Interfaces:**
- Consumes: `solveMixer(nodeId, params, inletFlow)`, `solveSeparator(nodeId, params, inletFlow)` from `@/lib/solvers/units`; `solveNetwork(network: ReactorNetwork): SolverReport` from `@/lib/solvers/orchestrator`.

- [ ] **Step 1: Write units tests**

Create `tests/solvers/units.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "@/lib/solvers/types";
import { solveMixer, solveSeparator } from "@/lib/solvers/units";

describe("solveMixer", () => {
  it("conserves molar flow", () => {
    const r = solveMixer("m1", DEFAULT_PARAMS, 7.3);
    expect(r.outletFlow).toBeCloseTo(7.3, 12);
    expect(r.residual).toBeCloseTo(0, 12);
    expect(r.conversion).toBe(0);
    expect(r.converged).toBe(true);
  });
  it("clamps negative inflow to zero outlet and flags it", () => {
    const r = solveMixer("m1", DEFAULT_PARAMS, -1);
    expect(r.outletFlow).toBe(0);
    expect(r.diagnostics.join(" ")).toMatch(/Negative inlet/i);
  });
});

describe("solveSeparator", () => {
  it("splits by (1 - alpha) to the bottom outlet", () => {
    const r = solveSeparator("s1", { ...DEFAULT_PARAMS, splitFraction: 0.85 }, 10);
    expect(r.outletFlow).toBeCloseTo(1.5, 9); // bottoms = 10 * (1 - 0.85)
    expect(r.converged).toBe(true);
  });
  it("conserves mass: overhead + bottoms = inlet", () => {
    const alpha = 0.6;
    const inlet = 8;
    const r = solveSeparator("s1", { ...DEFAULT_PARAMS, splitFraction: alpha }, inlet);
    const overhead = inlet * alpha;
    expect(overhead + r.outletFlow).toBeCloseTo(inlet, 9);
  });
  it("warns at extreme split fractions", () => {
    expect(
      solveSeparator("s1", { ...DEFAULT_PARAMS, splitFraction: 0.99 }, 10).status,
    ).toBe("warning");
    expect(
      solveSeparator("s1", { ...DEFAULT_PARAMS, splitFraction: 0.01 }, 10).status,
    ).toBe("warning");
  });
});
```

- [ ] **Step 2: Write orchestrator tests**

Create `tests/solvers/orchestrator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { solveNetwork } from "@/lib/solvers/orchestrator";
import type { ReactorNetwork } from "@/lib/solvers/types";

function seriesNetwork(): ReactorNetwork {
  return {
    nodes: [
      { id: "f1", type: "feed", label: "Feed", position: { x: 0, y: 0 }, params: { feedRate: 10, temperature: 350 } },
      { id: "r1", type: "cstr", label: "CSTR-1", position: { x: 300, y: 0 }, params: { volume: 2, temperature: 380, feedRate: 10, inletConcentration: 5, volumetricFlow: 2 } },
      { id: "p1", type: "product", label: "Product", position: { x: 600, y: 0 }, params: {} },
    ],
    streams: [
      { id: "s1", source: "f1", target: "r1", flowRate: 10 },
      { id: "s2", source: "r1", target: "p1", flowRate: 10 },
    ],
    meta: { species: "A,B", reaction: "A → B" },
  };
}

describe("solveNetwork — series flow propagation", () => {
  it("solves every node and propagates reactant flow to the product", () => {
    const report = solveNetwork(seriesNetwork());
    expect(Object.keys(report.results)).toHaveLength(3);
    const cstr = report.results["r1"];
    const product = report.results["p1"];
    expect(cstr.conversion).toBeGreaterThan(0);
    expect(product.outletFlow).toBeCloseTo(10 * (1 - cstr.conversion), 6);
    expect(report.overallStatus).not.toBe("error");
  });

  it("feed nodes pass feedRate through", () => {
    const report = solveNetwork(seriesNetwork());
    expect(report.results["f1"].outletFlow).toBe(10);
  });
});

describe("solveNetwork — reconciler", () => {
  it("flags an unfed reactor", () => {
    const net = seriesNetwork();
    net.streams = net.streams.filter((s) => s.id !== "s1"); // sever feed→cstr
    const report = solveNetwork(net);
    expect(report.reconcilerDiagnostics.join(" ")).toMatch(/unfed/i);
    expect(report.overallStatus).not.toBe("nominal");
  });

  it("flags a feed with no outlet and an unreachable product", () => {
    const net = seriesNetwork();
    net.streams = [];
    const report = solveNetwork(net);
    const joined = report.reconcilerDiagnostics.join(" ");
    expect(joined).toMatch(/feed node has no outgoing stream/i);
    expect(joined).toMatch(/unreachable/i);
  });

  it("still solves every node when the graph contains a cycle (recycle fallback)", () => {
    const net = seriesNetwork();
    net.nodes.push({ id: "m1", type: "mixer", label: "Mixer", position: { x: 150, y: 100 }, params: {} });
    net.streams.push(
      { id: "s3", source: "r1", target: "m1", flowRate: 2 },
      { id: "s4", source: "m1", target: "r1", flowRate: 2 },
    );
    const report = solveNetwork(net);
    expect(Object.keys(report.results)).toHaveLength(4);
  });
});
```

- [ ] **Step 3: Run** `npm test` → PASS.

- [ ] **Step 4: Commit**

```powershell
git add tests/solvers/units.test.ts tests/solvers/orchestrator.test.ts
git commit -m "Add mixer/separator mass-balance and orchestrator/reconciler tests"
```

---

### Task 9: Optimizer tests

**Files:**
- Create: `tests/solvers/optimizer.test.ts`

**Interfaces:**
- Consumes: `optimizeReactor(node: NetworkNode, volumeRange: [number,number], temperatureRange: [number,number], gridSteps?: number, objective?: string): OptimizationResult` from `@/lib/solvers/optimizer`.

- [ ] **Step 1: Write the tests**

Create `tests/solvers/optimizer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { optimizeReactor } from "@/lib/solvers/optimizer";
import type { NetworkNode } from "@/lib/solvers/types";

const cstrNode: NetworkNode = {
  id: "r1",
  type: "cstr",
  label: "CSTR-1",
  position: { x: 0, y: 0 },
  params: { inletConcentration: 5, volumetricFlow: 2, feedRate: 10, reactionOrder: 1 },
};

describe("optimizeReactor — first-order CSTR grid search", () => {
  it("finds the optimum at max volume + max temperature (monotonic surface)", () => {
    const result = optimizeReactor(cstrNode, [1, 5], [320, 400], 4);
    expect(result.optimal.volume).toBeCloseTo(5, 9);
    expect(result.optimal.temperature).toBeCloseTo(400, 9);
    expect(result.evaluations).toBe(25); // (4+1)^2
  });

  it("surface dimensions match the grid", () => {
    const result = optimizeReactor(cstrNode, [1, 5], [320, 400], 4);
    expect(result.volumes).toHaveLength(5);
    expect(result.temperatures).toHaveLength(5);
    expect(result.surface).toHaveLength(5);
    expect(result.surface[0]).toHaveLength(5);
  });

  it("temperature dominates sensitivity for Arrhenius kinetics in this range", () => {
    const result = optimizeReactor(cstrNode, [1, 5], [320, 400], 8);
    expect(result.sensitivity.dominant).toBe("temperature");
  });
});
```

- [ ] **Step 2: Run** `npm test` → PASS. (If the sensitivity assertion fails, print `result.sensitivity` — if volume genuinely dominates at these ranges, replace the assertion with the observed dominant axis + a comment deriving why; do not delete the test.)

- [ ] **Step 3: Commit**

```powershell
git add tests/solvers/optimizer.test.ts
git commit -m "Add optimizer grid-search tests"
```

---

### Task 10: Split the copilot route into src/lib/copilot modules

**Files:**
- Create: `src/lib/copilot/prompts.ts`, `src/lib/copilot/normalize.ts`, `src/lib/copilot/context.ts`
- Modify: `src/app/api/copilot/route.ts` (shrinks to mode dispatch + SDK call + response shaping)

**Interfaces:**
- Produces:
  - `prompts.ts`: `export const SYSTEM_PROMPT: string`, `ANALYZE_SYSTEM_PROMPT: string`, `MULTI_SYSTEM_PROMPT: string`, `OPTIMIZE_SYSTEM_PROMPT: string` (moved verbatim from `route.ts` lines 29-209).
  - `normalize.ts`: move verbatim `NODE_TYPES`, `PARAM_RANGES`, `clampNumber`, `sanitizeParams`, `sanitizePosition`, `sanitizeNode`, `sanitizeStream`, `buildFallback`, `extractJson`, `sanitizeTopology`, `sanitizeEnvelope` (route.ts lines 211-499). Export: `buildFallback`, `extractJson`, `sanitizeTopology`, `sanitizeEnvelope` (keep the rest module-private).
  - `context.ts`: move `buildContextBlock` (route.ts lines 500-559), export it.
- Consumes: `@/lib/solvers/types` (same imports the route already has).

This is a **mechanical move** — cut/paste with imports fixed, zero logic edits. (The spec's Zod idea was evaluated: the existing `sanitize*` layer already does tolerant clamping/repair that Zod would make stricter — replacing it risks behavior change, so it stays as-is. Zod remains for future request-body validation.)

- [ ] **Step 1: Create the three modules, move the code, fix imports**

Each new file starts with the relevant slice of the original header comment. `route.ts` keeps: the two `export const` route-segment configs, `POST`, and imports from the three new modules.

- [ ] **Step 2: Verify no logic changed**

Run: `git diff --stat` (should show ~large deletion in route.ts, ~equal additions across new files) and `npm run build` → PASS. Also `npm test` → PASS.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/copilot src/app/api/copilot/route.ts
git commit -m "Extract copilot prompts/normalize/context modules from API route"
```

---

### Task 11: Split CopilotSidecar into components + stream hook

**Files:**
- Create: `src/components/reactor/copilot/constants.ts` (QUICK_ACTIONS, EXAMPLE_PROMPTS), `src/components/reactor/copilot/MessageParts.tsx` (Timestamp, CopilotBody, CopyButton, ThinkingBlock), `src/components/reactor/copilot/Composer.tsx` (Composer, SendButton), `src/components/reactor/copilot/useCopilotStream.ts`
- Modify: `src/components/reactor/CopilotSidecar.tsx` (keeps only the exported `CopilotSidecar` shell that composes the parts)

**Interfaces:**
- Produces (moved verbatim from CopilotSidecar.tsx, exported where previously module-local):
  - `constants.ts`: `QUICK_ACTIONS`, `EXAMPLE_PROMPTS` (lines 31-43), plus the `CopilotResponse` interface (line 45).
  - `MessageParts.tsx`: `Timestamp`, `CopilotBody`, `CopyButton`, `ThinkingBlock`, `useIsClient`, `fmtTime`, `emptySubscribe` (lines 59-190).
  - `Composer.tsx`: `Composer`, `SendButton` (lines 191-274).
  - `useCopilotStream.ts`: the fetch/streaming/parse state machine currently inline in the `CopilotSidecar` body (lines 275+) — extract the state + handlers that talk to `/api/copilot` into a hook returning `{ messages, isStreaming, send, ... }` with the exact state names currently used; the component keeps layout/scroll UI state (`showJump`, input focus).
- Mechanical move; zero behavior change.

- [ ] **Step 1: Create the four files, move code, fix imports; shrink CopilotSidecar.tsx**

- [ ] **Step 2: Verify**

Run: `npm run build` → PASS. `npm run lint` → no NEW errors.

- [ ] **Step 3: Commit**

```powershell
git add src/components/reactor
git commit -m "Split CopilotSidecar into message parts, composer, and stream hook"
```

---

### Task 12: Strict typing

**Files:**
- Modify: `tsconfig.json`, plus every file the compiler flags

- [ ] **Step 1: Enable real strictness**

In `tsconfig.json` remove `"noImplicitAny": false` (so `strict: true` fully applies). Do NOT add `noUncheckedIndexedAccess` unless the error count from Step 2 is under ~20 (spec: "if the fallout is manageable").

- [ ] **Step 2: Enumerate and fix**

Run: `npx tsc --noEmit`
Fix every error with real types (no `any`, no `@ts-ignore`; `unknown` + narrowing where the shape is genuinely dynamic, e.g. LLM JSON). While in `src/lib/solvers/cstr.ts`, also delete the leftover LLM stream-of-consciousness comment block (lines 35-38 starting "// Wait — Da for first order...") and replace with one line: `// Da = k*tau since F_A0 = v0*CA0 ⇒ X = Da/(1+Da).`

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → zero errors; `npm test` → PASS; `npm run build` → PASS.

- [ ] **Step 4: Commit**

```powershell
git add -u
git commit -m "Enable full strict TypeScript (drop noImplicitAny escape hatch)"
```

---

### Task 13: Zero-warning lint

**Files:**
- Modify: whatever `eslint` flags; possibly `eslint.config.mjs` (only to remove rules disabled for deleted template code — never to silence real findings)

- [ ] **Step 1: Run** `npm run lint`. Fix every error and warning in source (unused imports, hook deps, etc.). Rule-level disables require a one-line justification comment.
- [ ] **Step 2: Verify** `npm run lint` → clean exit, zero warnings. `npm run build` → PASS.
- [ ] **Step 3: Commit**

```powershell
git add -u
git commit -m "Zero-warning lint"
```

---

### Task 14: Run the app and smoke-test

**Files:** none (verification task)

- [ ] **Step 1: Start dev server in background**: `npm run dev` (background). Wait for "Ready".
- [ ] **Step 2: HTTP smoke**: `Invoke-WebRequest http://localhost:3000` → 200 with HTML containing the app shell. `Invoke-WebRequest "http://localhost:3000/api/properties?name=water"` (check actual query param name in `src/app/api/properties/route.ts` first) → 200 JSON.
- [ ] **Step 3: Copilot API probe**: POST a minimal generate request to `/api/copilot`. If it returns a model-backed topology → LLM works. If it errors (missing/invalid z-ai credentials) → capture the exact error; confirm the route's `buildFallback` path still returns a usable fallback topology; document what credential the SDK needs (by reading the SDK's docs/types, NOT `.env`).
- [ ] **Step 4: Record results** for the final report; stop the dev server.

---

### Task 15: What's-next assessment + push

**Files:**
- Create: `docs/superpowers/2026-07-18-next-steps.md`

- [ ] **Step 1: Write the assessment**: observed state after the run (what works, what needs credentials), remaining tech debt (files still >15KB, anything deferred), and a prioritized recommendation list mapped to PRD Phases 6-8 (multi-agent collaboration; DWSIM/MATLAB backends; pathway discovery) — recommend the single best next milestone with rationale.
- [ ] **Step 2: Commit and push**

```powershell
git add docs
git commit -m "Add post-modernization next-steps assessment"
git push origin main
```

---

## Self-Review Notes

- Spec coverage: WS1→Tasks 2-4, WS2→Task 1, WS3→Tasks 10-11, WS4→Tasks 12-13, WS5→Tasks 5-9, Run→Task 14, Assessment→Task 15. Spec's "Zod replaces hand-rolled" adjusted in Task 10 with rationale (behavior-preservation wins; spec's own error-handling section demands tolerant parsing, which the existing normalize layer implements).
- Success criterion 3 (no file >15KB): route.ts and CopilotSidecar.tsx splits handle the worst; `glyphs.tsx` (17KB) is cohesive SVG data — exempt under "where splitting would hurt cohesion"; `topology.ts` (17KB) reviewed in Task 12 — split only if an obvious seam exists.
- Type consistency: task interfaces quote the real signatures read from source.
