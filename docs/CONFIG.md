# Configuration

Create `~/.config/opencode/solomemory.jsonc`:

```jsonc
{
  "apiKey": "your-api-key",
  "apiUrl": "https://api.solomemory.com",
  "similarityThreshold": 0.6,
  "maxMemories": 5,
  "maxProjectMemories": 10,
  "maxProfileItems": 5,
  "injectProfile": true,
  "containerTagPrefix": "opencode",
  "keywordPatterns": ["log\\s+this", "write\\s+down"],
  "compactionThreshold": 0.80
}
```

All fields optional. `SOLOMEMORY_API_KEY` env var takes precedence.

## Oh My OpenCode

If using [Oh My OpenCode](https://github.com/code-yeongyu/oh-my-opencode), disable its compaction hook:

```json
// ~/.config/opencode/oh-my-opencode.json
{
  "disabled_hooks": ["anthropic-context-window-limit-recovery"]
}
```
