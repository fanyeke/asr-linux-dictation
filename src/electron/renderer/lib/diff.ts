/** Simple word/character-level diff for ASR→LLM comparison. */

export interface DiffSegment {
  text: string;
  type: "same" | "added" | "removed" | "changed";
}

/**
 * Compute a simple diff between two strings.
 *
 * Splits by whitespace (words) for English, or by character for
 * Chinese/mixed text. Returns segments annotated with change type.
 */
export function computeDiff(
  original: string,
  modified: string,
): DiffSegment[] {
  if (!original && !modified) return [];
  if (!original) return [{ text: modified, type: "added" }];
  if (!modified) return [{ text: original, type: "removed" }];
  if (original === modified) return [{ text: original, type: "same" }];

  // Split into tokens (words for mixed text)
  const tokensA = tokenize(original);
  const tokensB = tokenize(modified);

  // LCS-based simple diff
  const result: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < tokensA.length || j < tokensB.length) {
    if (i < tokensA.length && j < tokensB.length && tokensA[i] === tokensB[j]) {
      // Same token — accumulate
      const sameTokens: string[] = [tokensA[i]];
      i++;
      j++;
      while (
        i < tokensA.length &&
        j < tokensB.length &&
        tokensA[i] === tokensB[j]
      ) {
        sameTokens.push(tokensA[i]);
        i++;
        j++;
      }
      result.push({ text: sameTokens.join(" "), type: "same" });
    } else {
      // Tokens differ — collect a changed block
      const removed: string[] = [];
      const added: string[] = [];
      const lookAhead = 3;

      // Try to find next matching position
      let matchFound = false;
      for (let step = 1; step <= lookAhead; step++) {
        if (
          i + step < tokensA.length &&
          j < tokensB.length &&
          tokensA[i + step] === tokensB[j]
        ) {
          // A has extra tokens (removal)
          for (let k = 0; k < step; k++) {
            removed.push(tokensA[i + k]);
          }
          i += step;
          matchFound = true;
          break;
        }
        if (
          i < tokensA.length &&
          j + step < tokensB.length &&
          tokensA[i] === tokensB[j + step]
        ) {
          // B has extra tokens (addition)
          for (let k = 0; k < step; k++) {
            added.push(tokensB[j + k]);
          }
          j += step;
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        // Fallback: treat as change
        if (i < tokensA.length) {
          removed.push(tokensA[i]);
          i++;
        }
        if (j < tokensB.length) {
          added.push(tokensB[j]);
          j++;
        }
      }

      if (removed.length > 0) {
        result.push({ text: removed.join(" "), type: "removed" });
      }
      if (added.length > 0) {
        result.push({ text: added.join(" "), type: "added" });
      }
    }
  }

  return result;
}

function tokenize(text: string): string[] {
  // Split on whitespace, keeping punctuation attached to words
  return text.split(/\s+/).filter((t) => t.length > 0);
}
