import { CONFIG } from "../config.js";

// Time conversion constants
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;
const PERCENT_MULTIPLIER = 100;

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

interface TimeDifferences {
  year: number;
  month: number;
  week: number;
  day: number;
  hour: number;
  minute: number;
}

function calculateTimeDifferences(diffMs: number): TimeDifferences {
  const diffSec = Math.floor(diffMs / MS_PER_SECOND);
  const diffMin = Math.floor(diffSec / SECONDS_PER_MINUTE);
  const diffHr = Math.floor(diffMin / MINUTES_PER_HOUR);
  const diffDay = Math.floor(diffHr / HOURS_PER_DAY);
  const diffWeek = Math.floor(diffDay / DAYS_PER_WEEK);
  const diffMonth = Math.floor(diffDay / DAYS_PER_MONTH);
  const diffYear = Math.floor(diffDay / DAYS_PER_YEAR);

  return {
    year: diffYear,
    month: diffMonth,
    week: diffWeek,
    day: diffDay,
    hour: diffHr,
    minute: diffMin,
  };
}

function selectTimeUnit(diffs: TimeDifferences): string {
  if (diffs.year > 0) return `${String(diffs.year)}y ago`;
  if (diffs.month > 0) return `${String(diffs.month)}mo ago`;
  if (diffs.week > 0) return `${String(diffs.week)}w ago`;
  if (diffs.day > 0) return `${String(diffs.day)}d ago`;
  if (diffs.hour > 0) return `${String(diffs.hour)}h ago`;
  if (diffs.minute > 0) return `${String(diffs.minute)}m ago`;
  return "just now";
}

function formatTimeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffs = calculateTimeDifferences(diffMs);
  return selectTimeUnit(diffs);
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
      const similarity = Math.round(mem.similarity * PERCENT_MULTIPLIER);
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
    "\n[IMPORTANT: When the conversation topic changes or the user asks about something not covered above, you MUST proactively call the solomemory tool with {mode: 'search', query: '<relevant query>'} to retrieve additional context. Do not wait for the user to ask — search automatically whenever you lack context.]",
  );

  return parts.join("\n");
}
