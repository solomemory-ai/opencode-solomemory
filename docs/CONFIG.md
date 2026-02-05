# Configuration

Create `~/.config/opencode/solomemory.jsonc`:

```jsonc
{
  "apiKey": "your-api-key",
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

All fields optional. `SOLOMEMORY_API_KEY` env var takes precedence.

## Options

| Option                  | Type    | Default                      | Description                                        |
| ----------------------- | ------- | ---------------------------- | -------------------------------------------------- |
| `apiKey`                | string  | —                            | API key (or use `SOLOMEMORY_API_KEY` env var)      |
| `apiUrl`                | string  | `https://api.solomemory.com` | API endpoint                                       |
| `maxMemories`           | number  | `5`                          | Max memories injected per search                   |
| `maxProjectMemories`    | number  | `10`                         | Max project-scoped memories injected               |
| `maxProfileItems`       | number  | `5`                          | Max profile items shown                            |
| `injectProfile`         | boolean | `true`                       | Inject user profile into context                   |
| `containerTagPrefix`    | string  | `opencode`                   | Prefix for memory container tags                   |
| `platformIdentifier`    | string  | `opencode`                   | Platform identifier sent with synced conversations |
| `autoSyncConversations` | boolean | `true`                       | Auto-sync conversations on session idle            |

## Oh My OpenCode

If using [Oh My OpenCode](https://github.com/code-yeongyu/oh-my-opencode), disable its compaction hook:

```json
// ~/.config/opencode/oh-my-opencode.json
{
  "disabled_hooks": ["anthropic-context-window-limit-recovery"]
}
```
