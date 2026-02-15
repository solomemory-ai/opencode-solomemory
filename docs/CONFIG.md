# Configuration

Optional. Create `~/.config/opencode/solomemory.jsonc` to customize behavior:

```jsonc
{
  "apiUrl": "https://api.solomemory.com",
  "maxMemories": 5,
  "maxProjectMemories": 10,
  "maxProfileItems": 5,
  "injectProfile": true,
  "platformIdentifier": "opencode",
  "autoSyncConversations": true,
  "dumpIngestPayloads": false,
  "dumpDir": "~/.config/opencode/solomemory/dumps/",
}
```

API key is configured during install (`npx oc-solomemory@latest install --api-key=KEY`) and stored separately in `~/.config/opencode/solomemory/credentials.json`.

## Options

| Option                  | Type    | Default                                | Description                                        |
| ----------------------- | ------- | -------------------------------------- | -------------------------------------------------- |
| `apiUrl`                | string  | `https://api.solomemory.com`           | API endpoint                                       |
| `maxMemories`           | number  | `5`                                    | Max memories injected per search                   |
| `maxProjectMemories`    | number  | `10`                                   | Max project-scoped memories injected               |
| `maxProfileItems`       | number  | `5`                                    | Max profile items shown                            |
| `injectProfile`         | boolean | `true`                                 | Inject user profile into context                   |
| `platformIdentifier`    | string  | `opencode`                             | Platform identifier sent with synced conversations |
| `autoSyncConversations` | boolean | `true`                                 | Auto-sync conversations on session idle            |
| `dumpIngestPayloads`    | boolean | `false`                                | Dump each ingest payload as JSON file to disk      |
| `dumpDir`               | string  | `~/.config/opencode/solomemory/dumps/` | Directory for dumped payload files (supports `~/`) |

## Environment Variable Overrides

All options can be overridden via `SOLOMEMORY_*` env vars (highest priority):

| Env Var                  | Config Equivalent    | Example                          |
| ------------------------ | -------------------- | -------------------------------- |
| `SOLOMEMORY_DUMP_INGEST` | `dumpIngestPayloads` | `SOLOMEMORY_DUMP_INGEST=true`    |
| `SOLOMEMORY_DUMP_DIR`    | `dumpDir`            | `SOLOMEMORY_DUMP_DIR=~/my-dumps` |

Resolution order: `SOLOMEMORY_*` env vars > `solomemory.jsonc` > `credentials.json` > defaults
