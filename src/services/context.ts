import { CONFIG } from "../config.js";

interface ProfileFact {
  fact: string;
  validAt?: string;
}

interface ProfileResponse {
  profile: {
    static: ProfileFact[];
    dynamic: ProfileFact[];
  } | null;
}

interface MemoryResultMinimal {
  similarity: number;
  memory?: string;
  chunk?: string;
  validAt?: string;
  createdAt?: string;
}

interface MemoriesResponseMinimal {
  results?: MemoryResultMinimal[];
}

function formatTimeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffYear > 0) return `${String(diffYear)}y ago`;
  if (diffMonth > 0) return `${String(diffMonth)}mo ago`;
  if (diffWeek > 0) return `${String(diffWeek)}w ago`;
  if (diffDay > 0) return `${String(diffDay)}d ago`;
  if (diffHr > 0) return `${String(diffHr)}h ago`;
  if (diffMin > 0) return `${String(diffMin)}m ago`;
  return "just now";
}

function formatProfileSection(facts: ProfileFact[], title: string, maxItems: number): string[] {
  const lines: string[] = [];
  if (facts.length > 0) {
    lines.push(`\n${title}:`);
    for (const item of facts.slice(0, maxItems)) {
      const timeAgo = formatTimeAgo(item.validAt);
      const timeStr = timeAgo ? ` (${timeAgo})` : "";
      lines.push(`-${timeStr} ${item.fact}`);
    }
  }
  return lines;
}

function formatMemorySection(memories: MemoryResultMinimal[], title: string): string[] {
  const lines: string[] = [];
  if (memories.length > 0) {
    lines.push(`\n${title}:`);
    for (const mem of memories) {
      const similarity = Math.round(mem.similarity * 100);
      const content = mem.memory ?? mem.chunk ?? "";
      const timeAgo = formatTimeAgo(mem.validAt ?? mem.createdAt);
      const timeStr = timeAgo ? ` (${timeAgo})` : "";
      lines.push(`- [${String(similarity)}%]${timeStr} ${content}`);
    }
  }
  return lines;
}

export function formatContextForPrompt(
  profile: ProfileResponse | null,
  userMemories: MemoriesResponseMinimal,
  projectMemories: MemoriesResponseMinimal,
): string {
  const parts: string[] = ["[SOLOMEMORY - Retrieved memories about user/project]"];

  if (CONFIG.injectProfile && profile?.profile) {
    const { static: staticFacts, dynamic: dynamicFacts } = profile.profile;
    const profileLines = [
      ...formatProfileSection(staticFacts, "User Profile", CONFIG.maxProfileItems),
      ...formatProfileSection(dynamicFacts, "Recent Context", CONFIG.maxProfileItems),
    ];
    parts.push(...profileLines);
  }

  const projectResults = projectMemories.results ?? [];
  parts.push(...formatMemorySection(projectResults, "Project Knowledge"));

  const userResults = userMemories.results ?? [];
  parts.push(...formatMemorySection(userResults, "Relevant Memories"));

  if (parts.length === 1) {
    return "";
  }

  parts.push(
    "\n[To find more context: use solomemory tool with {mode: 'search', query: '<your question>'}]",
  );

  return parts.join("\n");
}
