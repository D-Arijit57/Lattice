# Delivery API load-test audit

Date: 2026-10-13/14. Raw k6 summaries and logs: `loadtest/results/`. Tooling: `run.sh`, `delivery.js`, `seed.py`, `count_queries.py`.

## 1. Scope and setup

| Item | Value |
|---|---|
| Endpoint under test | `GET /api/delivery/content-types/product/entries/` (50 rows/page, cursor pagination) |
| Tool | k6, constant-arrival-rate executor, 15 s warm-up then 45 s measured |
| Machine | Apple M1, 8 cores, 16 GB; Docker given 8 CPUs / 8 GB |
| Stack | Production backend image, gunicorn **1 sync worker** (the shipped default), Postgres 16 in a local container |
| Data | 100,000 entries in one content type, 2,000 API keys rotated round-robin (no key reaches the 60/min throttle) |
| Isolation | Own compose stack with no env file; `seed.py` refuses to run against a non-local host |
| Pass criteria | p95 < 500 ms, zero 5xx, zero 429 (measured phase, 200 responses only) |

Every run restarts the backend, so each starts cold with empty throttle counters.

**Not representative of production.** Postgres is on the same machine and the CPU is far faster than Render's free tier. Treat the *improvement* as real and the *absolute req/s* as laptop figures.

## 2. Findings, in the order they were found

### 2.1 Baseline: the list endpoint saturated early
The original code handled 12-20 req/s cleanly (p95 about 47-80 ms), collapsed on a ramp (p95 15.4 s, 216 dropped requests), and at 60 req/s collapsed (p95 27.8 s) even after the N+1 fix.

### 2.2 N+1 query (fixed)
`count_queries.py` showed **54 SQL queries for one 50-row list page**. The serializer reads `content_type_version.version_number` per row, and the delivery queryset lacked the `select_related` the member endpoint already had.
- Fix: `.select_related("content_type_version")`.
- Result: **54 -> 4 queries per list; detail 5 -> 4**.
- Guard: `test_list_query_count_does_not_grow_with_the_number_of_entries` (failed before the fix with 16 vs 6 queries, passes now).
- Effect on latency was small (about 45 ms -> about 40 ms). N+1 was real but not the bottleneck.

### 2.3 Missing index (fixed) - the actual bottleneck
`EXPLAIN ANALYZE` showed every list request did a sequential scan of all 100,000 rows plus a sort: **about 40-46 ms of database time per request**.
- A composite index on the version alone did not help: the query joined through `ContentTypeVersion`, and Postgres cannot read an index in sorted order across a join or an `IN (...)` list. The same index on a single-column filter ran in 0.12 ms.
- Fix: denormalized `Entry.content_type` (kept in sync by `Entry.save()`), plus index `(content_type, -created_at, -id)` mirroring `EntryCursorPagination.ordering`. Migration `0003` adds the column, backfills it, then makes it required. On the 100k-row database the backfill took about 1.8 s, with 0 nulls and 0 mismatches.
- Result: database time per list **about 46 ms -> 0.29 ms**, plan is now an Index Scan.
- Tests: 104 pass, including derived `content_type` and "list spans every version".

### 2.4 Test-harness bugs found and fixed (not API bugs)
- The `deep` scenario followed `next` links built from `X-Forwarded-Proto` (`https://localhost:8000/...`) against a plain-HTTP server, so every run hung. The script now rewrites `next` to `BASE`.
- The warm-up sent 20 deep iterations/s (60 req/s), overloading the server before measuring. It is now 5/s for `deep`.
- k6's reported requests/s averages in the warm-up, so early "throughput" numbers understated what was served. Judge by the rate set and the measured-phase latency instead.

## 3. Results: list endpoint, 1 worker

| Rate | Before fixes | After N+1 fix only | After N+1 fix and index |
|---|---|---|---|
| 20 req/s | p95 about 47-80 ms | p95 44 ms | **p95 17 ms** (3 repeats: 17.1-17.3 ms) |
| 60 req/s | not run | p95 27.8 s (saturated) | **p95 7.4 ms** |
| 100 req/s | not run | p95 41.6 s (saturated) | **p95 7.5 ms** |
| 150 req/s | not run | not run | **p95 17.2 ms** (p99 136 ms) |
| Ramp 150 -> 400 req/s | collapsed at about 20 req/s | not run | saturates between about 150 and 200 req/s |

All runs: 0 5xx, 0 429.

Notes:
- The 150 req/s tail (p99 136 ms) is queueing: a single worker is about 80-90% busy.
- p95 at 20 req/s (17 ms) is higher than at 60-100 req/s (7.5 ms). It is reproducible and not queueing (median 14 ms vs 5.5 ms). Likely cause is CPU idle/clock scaling on the laptop; this was **not verified**. Irrelevant to any conclusion, since every rate is far under the 500 ms threshold.
- "Before fixes" has no run at 60/100 req/s on the original code. The baseline and N+1-only columns are not a controlled before/after at those rates.

## 4. Other scenarios

| Scenario | Config | Result |
|---|---|---|
| Detail (`.../entries/{id}/`), steady | before the `content_type` change | 20/s p95 13 ms; 100/s p95 4.6 ms; 200/s p95 3.7 ms. Ramp saturated at about 235 req/s. |
| Deep (3 cursor pages/iteration) | before the index | 4 it/s (12 req/s) p95 62 ms; 6 it/s p95 48 ms; 8 it/s (24 req/s) p95 805 ms, saturated. No slowdown on later pages. |
| Health | 1 worker | about 115 req/s, p95 5 ms. |
| Throttle (dry run) | one key | 390 of 450 requests returned 429. The 60/min limit works. |
| 4 workers | list, before fixes | No better than 1 worker (saturated at 30-60 req/s); results inconsistent. Likely CPU contention with Postgres and k6 on the same laptop; unconfirmed. |

## 5. Not done (gaps)

- **Detail and deep were not rerun** after the index / `content_type` change (the detail queryset now filters on `content_type`). Expected unaffected or faster; unverified.
- **No run against deployed infrastructure.** No Render/Supabase/Vercel numbers exist. Production estimates are reasoning, not measurements: roughly 7-12 req/s per worker if Render and Supabase share a region, about 1 req/s if cross-continent.
- **No multi-worker result worth citing.** The 4-worker runs were affected by local CPU contention.
- **No memory/CPU profile** of the app container, and no soak test (long duration).
- **Multi-version content types** are covered by a correctness test, not by a load test; the seeded data has one version.
- Not committed at the time of writing: view change, `content_type` model/migration, tests, `delivery.js`/`seed.py` fixes, `loadtest/`.

## 6. What is safe to claim

Claims below are supported by saved results, and each states its conditions.

- Profiled the content-delivery API under k6 load (100k entries, 2k API keys) and found two compounding database problems: an N+1 (54 queries per 50-row list page) and a missing composite index (full table scan plus sort on every list).
- Cut queries per list request from 54 to 4 (`select_related`, with a regression test).
- Reduced list database time from about 46 ms to 0.3 ms by adding a denormalized `content_type` foreign key and a composite index matching the cursor-pagination ordering, shipped as a three-step migration with backfill (100k rows in 1.8 s).
- After the fixes, one gunicorn worker sustained 150 req/s at p95 17 ms with zero errors (local Docker, M1); the same endpoint previously saturated below 60 req/s (p95 > 25 s at 60 req/s).

Do not claim: production throughput, a specific "Nx faster" overall figure (there is no controlled before/after at 60+ req/s on the original code), or multi-worker scaling.
