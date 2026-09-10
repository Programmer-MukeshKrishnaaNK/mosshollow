/**
 * DIALOGUE
 *
 * A queue of lines with a typewriter reveal. Built as a general system from the
 * start — the same box will carry a sign, a note, and eventually a
 * conversation with a person — so it deals in speakers, pages and choices
 * rather than in "sign text".
 *
 * Two details that matter more than they look:
 *  - Pressing the interact key while a line is still revealing completes it
 *    instantly instead of skipping to the next one. Nothing is more irritating
 *    than a typewriter you cannot outrun.
 *  - Punctuation holds a beat longer than letters. It costs nothing and it is
 *    the difference between text appearing and text being *read to you*.
 */

export interface DialogueLine {
  /** Shown above the box. Omit for narration. */
  speaker?: string;
  text: string;
}

/** Characters that earn extra dwell time when revealed. */
const PAUSE_AFTER: Record<string, number> = {
  ',': 0.10,
  ';': 0.12,
  ':': 0.12,
  '.': 0.18,
  '!': 0.18,
  '?': 0.18,
  '—': 0.14,
};

const CHARS_PER_SECOND = 46;

export class Dialogue {
  private queue: DialogueLine[] = [];
  private index = 0;
  private revealed = 0;
  private timer = 0;
  private holdFor = 0;
  /** Rises as the box opens, falls as it closes. */
  open = 0;
  private closing = false;
  onClosed: (() => void) | null = null;

  get active(): boolean {
    return this.queue.length > 0 || this.open > 0.01;
  }

  /** True while the player should not be moving. */
  get blocking(): boolean {
    return this.queue.length > 0;
  }

  get line(): DialogueLine | null {
    return this.queue[this.index] ?? null;
  }

  /** How much of the current line has been revealed. */
  get visibleText(): string {
    const line = this.line;
    if (!line) return '';
    return line.text.slice(0, Math.floor(this.revealed));
  }

  get lineComplete(): boolean {
    const line = this.line;
    return !line || this.revealed >= line.text.length;
  }

  get pageIndex(): number {
    return this.index;
  }

  get pageCount(): number {
    return this.queue.length;
  }

  /** Start a conversation. Replaces anything already showing. */
  say(lines: readonly (DialogueLine | string)[]): void {
    this.queue = lines.map((l) => (typeof l === 'string' ? { text: l } : l));
    this.index = 0;
    this.revealed = 0;
    this.timer = 0;
    this.holdFor = 0;
    this.closing = false;
  }

  /**
   * The interact key. Completes the line if it is still revealing, otherwise
   * moves on. Returns true if it consumed the press.
   */
  advance(): boolean {
    if (!this.queue.length) return false;
    if (!this.lineComplete) {
      const line = this.line;
      if (line) this.revealed = line.text.length;
      this.holdFor = 0;
      return true;
    }
    this.index++;
    this.revealed = 0;
    this.timer = 0;
    this.holdFor = 0;
    if (this.index >= this.queue.length) {
      this.queue = [];
      this.index = 0;
      this.closing = true;
    }
    return true;
  }

  /** Close immediately, e.g. on cancel. */
  dismiss(): void {
    if (!this.queue.length) return;
    this.queue = [];
    this.index = 0;
    this.revealed = 0;
    this.closing = true;
  }

  update(dt: number): void {
    const target = this.queue.length ? 1 : 0;
    // Opens faster than it closes; a box that lingers reads as reluctant.
    const rate = target > this.open ? 14 : 10;
    this.open += (target - this.open) * Math.min(1, rate * dt);
    if (this.closing && this.open < 0.02) {
      this.closing = false;
      this.onClosed?.();
    }

    const line = this.line;
    if (!line || this.lineComplete) return;

    if (this.holdFor > 0) {
      this.holdFor -= dt;
      return;
    }
    this.timer += dt * CHARS_PER_SECOND;
    while (this.timer >= 1 && this.revealed < line.text.length) {
      this.timer -= 1;
      const ch = line.text[Math.floor(this.revealed)];
      this.revealed++;
      const pause = PAUSE_AFTER[ch];
      if (pause) {
        this.holdFor = pause;
        break;
      }
    }
  }
}
