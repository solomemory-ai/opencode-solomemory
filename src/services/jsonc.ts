/**
 * Strips comments from JSONC content while respecting string boundaries.
 * Handles // and /* comments, URLs in strings, and escaped quotes.
 * Also removes trailing commas to support more relaxed JSONC format.
 */

interface ProcessState {
  result: string;
  i: number;
  inString: boolean;
  inSingleLineComment: boolean;
  inMultiLineComment: boolean;
}

function processStringChar(content: string, state: ProcessState): void {
  const char = content[state.i];
  if (char === undefined) return;

  // Count consecutive backslashes before this quote
  let backslashCount = 0;
  let j = state.i - 1;
  while (j >= 0 && content[j] === "\\") {
    backslashCount++;
    j--;
  }
  // Quote is escaped only if preceded by ODD number of backslashes
  if (backslashCount % 2 === 0) {
    state.inString = !state.inString;
  }
  state.result += char;
  state.i++;
}

function processSingleLineComment(content: string, state: ProcessState): void {
  const char = content[state.i];
  if (char === undefined) return;

  if (char === "\n") {
    state.inSingleLineComment = false;
    state.result += char;
  }
  state.i++;
}

function processMultiLineComment(content: string, state: ProcessState): void {
  const char = content[state.i];
  const nextChar = content[state.i + 1];

  if (char === "*" && nextChar === "/") {
    state.inMultiLineComment = false;
    state.i += 2;
    return;
  }
  if (char === "\n") {
    state.result += char;
  }
  state.i++;
}

function handleCommentStart(
  char: string | undefined,
  nextChar: string | undefined,
  state: ProcessState,
): boolean {
  if (char === "/" && nextChar === "/") {
    state.inSingleLineComment = true;
    state.i += 2;
    return true;
  }

  if (char === "/" && nextChar === "*") {
    state.inMultiLineComment = true;
    state.i += 2;
    return true;
  }

  return false;
}

function handleStringState(content: string, state: ProcessState, char: string): boolean {
  if (!state.inSingleLineComment && !state.inMultiLineComment && char === '"') {
    processStringChar(content, state);
    return true;
  }

  if (state.inString) {
    state.result += char;
    state.i++;
    return true;
  }

  return false;
}

function handleCommentState(content: string, state: ProcessState): boolean {
  if (state.inSingleLineComment) {
    processSingleLineComment(content, state);
    return true;
  }

  if (state.inMultiLineComment) {
    processMultiLineComment(content, state);
    return true;
  }

  return false;
}

function processCharacter(content: string, state: ProcessState): void {
  const char = content[state.i];
  const nextChar = content[state.i + 1];

  if (handleStringState(content, state, char ?? "")) {
    return;
  }

  if (handleCommentState(content, state)) {
    return;
  }

  if (handleCommentStart(char, nextChar, state)) {
    return;
  }

  if (char !== undefined) {
    state.result += char;
  }
  state.i++;
}

export function stripJsoncComments(content: string): string {
  const state: ProcessState = {
    result: "",
    i: 0,
    inString: false,
    inSingleLineComment: false,
    inMultiLineComment: false,
  };

  while (state.i < content.length) {
    processCharacter(content, state);
  }

  return state.result.replaceAll(/,\s*([}\]])/g, "$1");
}
