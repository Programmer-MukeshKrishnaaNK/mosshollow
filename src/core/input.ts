/**
 * Keyboard input. Tracks held keys plus edge state so gameplay code can ask
 * "is this held" and "was this pressed this frame" without caring about
 * browser key repeat.
 */

export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'run'
  | 'interact'
  | 'cancel'
  | 'debug'
  | 'timeWarp'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4'
  | 'slot5'
  | 'slot6'
  | 'slot7'
  | 'slot8'
  | 'ledger'
  | 'tabNext'
  | 'menu';

const BINDINGS: Record<string, Action> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyE: 'interact',
  Space: 'interact',
  Enter: 'interact',
  Escape: 'menu',
  Backquote: 'debug',
  KeyT: 'timeWarp',
  KeyI: 'ledger',
  Tab: 'tabNext',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
  Digit4: 'slot4',
  Digit5: 'slot5',
  Digit6: 'slot6',
  Digit7: 'slot7',
  Digit8: 'slot8',
};

/** Keys the browser would otherwise scroll or scrub the page with. */
const SWALLOW = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

export class Input {
  /**
   * An analog vector from the on-screen stick, when there is one. Keyboard is
   * still the source of truth whenever a key is down: a player with both a
   * keyboard and a touchscreen should never find the stick fighting them.
   */
  stickX = 0;
  stickY = 0;
  /** Actions the touch layer is holding. Edges are derived, not re-fired. */
  private touchHeld = new Set<Action>();
  private held = new Set<Action>();
  private pressedThisFrame = new Set<Action>();
  private releasedThisFrame = new Set<Action>();
  /** Newest horizontal/vertical press wins, so reversals feel instant. */
  private lastHorizontal: 'left' | 'right' | null = null;
  private lastVertical: 'up' | 'down' | null = null;
  /** True once the player has actually touched the keyboard. */
  anyInputYet = false;

  constructor(private target: EventTarget = window) {
    this.target.addEventListener('keydown', this.onKeyDown as EventListener);
    this.target.addEventListener('keyup', this.onKeyUp as EventListener);
    window.addEventListener('blur', this.onBlur);
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    const action = BINDINGS[ev.code];
    if (SWALLOW.has(ev.code)) ev.preventDefault();
    if (!action) return;
    this.anyInputYet = true;
    if (ev.repeat) return;
    if (!this.held.has(action)) this.pressedThisFrame.add(action);
    this.held.add(action);
    if (action === 'left' || action === 'right') this.lastHorizontal = action;
    if (action === 'up' || action === 'down') this.lastVertical = action;
  };

  private onKeyUp = (ev: KeyboardEvent): void => {
    const action = BINDINGS[ev.code];
    if (!action) return;
    this.held.delete(action);
    this.releasedThisFrame.add(action);
    if (this.lastHorizontal === action) this.lastHorizontal = null;
    if (this.lastVertical === action) this.lastVertical = null;
  };

  /** Losing focus mid-walk should stop the player, not leave keys stuck down. */
  private onBlur = (): void => {
    this.held.clear();
    this.lastHorizontal = null;
    this.lastVertical = null;
  };

  isDown(action: Action): boolean {
    return this.held.has(action) || this.touchHeld.has(action);
  }

  /**
   * Replace the whole set of touch-held actions for this frame.
   *
   * Edges are computed by diffing against last frame rather than by clearing
   * and re-adding. Clearing every frame made a *held* button look like a fresh
   * press sixty times a second, which meant the bag button opened and closed
   * the satchel on alternate frames and a held action button re-triggered
   * continuously. A button held down is one press and then nothing.
   */
  setTouchHeld(next: ReadonlySet<Action>): void {
    for (const a of next) {
      if (!this.touchHeld.has(a) && !this.held.has(a)) this.pressedThisFrame.add(a);
    }
    for (const a of this.touchHeld) {
      if (!next.has(a) && !this.held.has(a)) this.releasedThisFrame.add(a);
    }
    this.touchHeld = new Set(next);
  }

  wasPressed(action: Action): boolean {
    return this.pressedThisFrame.has(action);
  }

  wasReleased(action: Action): boolean {
    return this.releasedThisFrame.has(action);
  }

  /** -1, 0 or 1. Ties break toward the most recently pressed direction. */
  axisX(): number {
    const l = this.held.has('left');
    const r = this.held.has('right');
    if (!l && !r && this.stickX !== 0) return this.stickX;
    if (l && r) return this.lastHorizontal === 'left' ? -1 : 1;
    return l ? -1 : r ? 1 : 0;
  }

  axisY(): number {
    const u = this.held.has('up');
    const d = this.held.has('down');
    if (!u && !d && this.stickY !== 0) return this.stickY;
    if (u && d) return this.lastVertical === 'up' ? -1 : 1;
    return u ? -1 : d ? 1 : 0;
  }

  /** Call once at the very end of each frame. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    window.removeEventListener('blur', this.onBlur);
  }
}
