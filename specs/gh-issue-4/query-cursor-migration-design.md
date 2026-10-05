# QueryCursor migration — design & audit note

## Context

`LocalStorageDataSource` was a near copy of the pre-2.0.0 in-memory core adapter. It tracked
the last query's result set (`_lastMatchingDocs`), page size (`_lastLimit`) and position
(`_cursor`) on the data-source instance, and `Model.next()` advanced that shared state through
`DataSource.next()`. Interleaved queries over one data source clobbered each other.

entropic-bond 2.0.0 moved pagination into a per-query `QueryCursor`: `DataSource.find()` returns
`Promise<QueryCursor>` and `DataSource.next()` was removed. `Model` now keeps the cursor produced
by its own `find()`.

## Design

- `find()` builds the matching document array as before, then wraps it in
  `new QueryCursor( matchingDocs, queryObject.limit || 0 )`. The `null`-query fast path wraps
  `rawDataArray` with limit `0`. Nothing else about query processing changes.
- The adapter's shared cursor state, `next()`, `incCursor()` and `decCursor()` are deleted. The
  adapter no longer holds pagination state; the cursor returned to the caller owns it.
- Resolution is synchronous, so the default immediate `QueryCursorResolver` is adequate. No
  delay/resolver plumbing is needed, unlike core's `JsonDataSource`.

Pagination behaviour (page size, exhaustion, "no limit" semantics, position advance) now lives in
one module — core's `QueryCursor` — instead of being duplicated in every adapter.

## Audit note

No major architectural improvements are warranted: the change deepens the adapter by removing
shared state and delegates pagination to a single core module, which is exactly the leverage and
locality the migration targets.

Minor, non-blocking observation: `find()` instantiates `QueryCursor` in two branches inline, while
core's `JsonDataSource` centralises this in a private `createCursor()` helper. A `createCursor()`
helper here would read slightly better and keep the adapter shaped like its core sibling, but it is
a cosmetic refactor with no behavioural or testability impact, so it was left out to keep the
migration diff minimal.
