# client/

SolomemoryClient implementation, split by responsibility.

## Files

| File                        | Responsibility                           |
| --------------------------- | ---------------------------------------- |
| `index.ts`                  | Class assembly + singleton export        |
| `api-transport.http.ts`     | HTTP plumbing: auth, timeout, fetch      |
| `memory-search.methods.ts`  | Search: project, user, global, metadata  |
| `memory-crud.methods.ts`    | CRUD: add, ingest, delete, list          |
| `metadata-query.methods.ts` | Queries: profile, jobs, projects, topics |

## Dependencies

- **Imports from**: `../../config.js`, `../client-types.js`, `../error-reporter.js`, `../logger.js`
- **Imported by**: `../client.ts` (facade), then consumers via that path
