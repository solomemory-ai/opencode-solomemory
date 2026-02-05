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
  if (isNaN(date.getTime())) return "";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  
  if (diffYear > 0) return `${diffYear}y ago`;
  if (diffMonth > 0) return `${diffMonth}mo ago`;
  if (diffWeek > 0) return `${diffWeek}w ago`;
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

export function formatContextForPrompt(
  profile: ProfileResponse | null,
  userMemories: MemoriesResponseMinimal,
  projectMemories: MemoriesResponseMinimal
): string {
  const parts: string[] = ["[SOLOMEMORY - Retrieved memories about user/project]"];

  if (CONFIG.injectProfile && profile?.profile) {
    const { static: staticFacts, dynamic: dynamicFacts } = profile.profile;

    if (staticFacts.length > 0) {
      parts.push("\nUser Profile:");
      staticFacts.slice(0, CONFIG.maxProfileItems).forEach((item: ProfileFact) => {
        const timeAgo = formatTimeAgo(item.validAt);
        const timeStr = timeAgo ? ` (${timeAgo})` : "";
        parts.push(`-${timeStr} ${item.fact}`);
      });
    }

    if (dynamicFacts.length > 0) {
      parts.push("\nRecent Context:");
      dynamicFacts.slice(0, CONFIG.maxProfileItems).forEach((item: ProfileFact) => {
        const timeAgo = formatTimeAgo(item.validAt);
        const timeStr = timeAgo ? ` (${timeAgo})` : "";
        parts.push(`-${timeStr} ${item.fact}`);
      });
    }
  }

  const projectResults = projectMemories.results || [];
  if (projectResults.length > 0) {
    parts.push("\nProject Knowledge:");
    projectResults.forEach((mem) => {
      const similarity = Math.round(mem.similarity * 100);
      const content = mem.memory || mem.chunk || "";
      const timeAgo = formatTimeAgo(mem.validAt || mem.createdAt);
      const timeStr = timeAgo ? ` (${timeAgo})` : "";
      parts.push(`- [${similarity}%]${timeStr} ${content}`);
    });
  }

  const userResults = userMemories.results || [];
  if (userResults.length > 0) {
    parts.push("\nRelevant Memories:");
    userResults.forEach((mem) => {
      const similarity = Math.round(mem.similarity * 100);
      const content = mem.memory || mem.chunk || "";
      const timeAgo = formatTimeAgo(mem.validAt || mem.createdAt);
      const timeStr = timeAgo ? ` (${timeAgo})` : "";
      parts.push(`- [${similarity}%]${timeStr} ${content}`);
    });
  }

  if (parts.length === 1) {
    return "";
  }

  parts.push("\n[To find more context: use solomemory tool with {mode: 'search', query: '<your question>'}]");

  return parts.join("\n");
}
