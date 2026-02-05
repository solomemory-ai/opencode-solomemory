# Configuration

Optional. Create `~/.config/opencode/solomemory.jsonc` to customize behavior:

```jsonc
{
  "apiUrl": "https://api.solomemory.com",
  "maxMemories": 5,
  "maxProjectMemories": 10,
  "maxProfileItems": 5,
  "injectProfile": true,
  "containerTagPrefix": "opencode",
  "platformIdentifier": "opencode",
  "autoSyncConversations": true,
}
```

API key is configured during install (`npx oc-solomemory@latest install --api-key=KEY`) and stored separately in `~/.solomemory-opencode/credentials.json`.

## Options

| Option                  | Type    | Default                      | Description                                        |
| ----------------------- | ------- | ---------------------------- | -------------------------------------------------- |
| `apiUrl`                | string  | `https://api.solomemory.com` | API endpoint                                       |
| `maxMemories`           | number  | `5`                          | Max memories injected per search                   |
| `maxProjectMemories`    | number  | `10`                         | Max project-scoped memories injected               |
| `maxProfileItems`       | number  | `5`                          | Max profile items shown                            |
| `injectProfile`         | boolean | `true`                       | Inject user profile into context                   |
| `containerTagPrefix`    | string  | `opencode`                   | Prefix for memory container tags                   |
| `platformIdentifier`    | string  | `opencode`                   | Platform identifier sent with synced conversations |
| `autoSyncConversations` | boolean | `true`                       | Auto-sync conversations on session idle            |
