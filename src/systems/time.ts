/**
 * TIME OF DAY
 *
 * A real clock that the rest of the world reads from. Ambient colour, sky
 * colour, sun direction and shadow length are all keyframed against it and
 * interpolated, so the valley moves continuously from cold morning through
 * flat noon to a long gold evening rather than snapping between four states.
 *
 * Nothing here draws anything. Lighting consumes these values.
 */

import { clamp, invLerp, lerp } from '../core/math.ts';
import { rgbToCss } from '../art/palette.ts';

export interface DayKey {
  /** Hour of day, 0-24. */
  at: number;
  /** Ambient light colour — multiplied over the world. */
  ambient: [number, number, number];
  /** Ambient strength, 0 = pitch black, 1 = full daylight. */
  level: number;
  /** Sky colour, used for water tint and distance haze. */
  sky: [number, number, number];
}

/**
 * The day, as a lighting artist would key it. Note that dawn and dusk get
 * more keys than the middle of the day — that is where all the interesting
 * colour change happens, and where a coarse curve would look wrong.
 */
const KEYS: DayKey[] = [
  // Night sits at a moonlit floor rather than true black. A cozy game at
  // 11pm should still let you read the shape of your own farm — the darkness
  // is there to make the lanterns matter, not to hide the world.
  { at: 0, ambient: [92, 116, 178], level: 0.42, sky: [26, 34, 66] },
  { at: 4.2, ambient: [96, 120, 182], level: 0.44, sky: [32, 40, 76] },
  { at: 5.3, ambient: [140, 128, 168], level: 0.56, sky: [86, 76, 118] },
  { at: 6.2, ambient: [214, 148, 128], level: 0.72, sky: [206, 132, 118] },
  { at: 7.2, ambient: [255, 214, 178], level: 0.9, sky: [176, 196, 220] },
  { at: 9.0, ambient: [255, 245, 226], level: 0.98, sky: [150, 196, 232] },
  { at: 12.0, ambient: [255, 253, 245], level: 1.0, sky: [138, 192, 238] },
  { at: 15.5, ambient: [255, 244, 220], level: 0.99, sky: [148, 194, 232] },
  { at: 17.6, ambient: [255, 206, 156], level: 0.92, sky: [206, 186, 190] },
  { at: 18.8, ambient: [246, 158, 112], level: 0.78, sky: [238, 150, 108] },
  { at: 19.6, ambient: [186, 116, 116], level: 0.6, sky: [186, 106, 96] },
  { at: 20.4, ambient: [124, 112, 158], level: 0.52, sky: [92, 78, 112] },
  { at: 21.6, ambient: [96, 118, 180], level: 0.44, sky: [32, 40, 78] },
  { at: 24, ambient: [92, 116, 178], level: 0.42, sky: [26, 34, 66] },
];

export type Phase = 'dawn' | 'morning' | 'day' | 'evening' | 'dusk' | 'night';

export class TimeOfDay {
  /** Minutes since midnight, 0-1440. */
  minutes: number;
  day = 1;
  /** Real seconds per in-game day. */
  secondsPerDay = 900;
  paused = false;
  /** Debug/cinematic multiplier on the clock. */
  speed = 1;

  constructor(startHour = 6.4) {
    this.minutes = startHour * 60;
  }

  update(dt: number): void {
    if (this.paused) return;
    this.minutes += (dt * this.speed * 1440) / this.secondsPerDay;
    while (this.minutes >= 1440) {
      this.minutes -= 1440;
      this.day++;
    }
  }

  get hour(): number {
    return this.minutes / 60;
  }

  /** "6:40 am" — the format the clock in the HUD reads. */
  get label(): string {
    const h24 = Math.floor(this.hour);
    const m = Math.floor(this.minutes % 60);
    const suffix = h24 < 12 ? 'am' : 'pm';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
  }

  get phase(): Phase {
    const h = this.hour;
    if (h < 5.2) return 'night';
    if (h < 6.8) return 'dawn';
    if (h < 10) return 'morning';
    if (h < 16.5) return 'day';
    if (h < 19) return 'evening';
    if (h < 21) return 'dusk';
    return 'night';
  }

  /** 0 in full daylight, 1 in the dead of night. Drives lamps and fireflies. */
  get darkness(): number {
    return clamp(1 - (this.sample().level - 0.42) / 0.58, 0, 1);
  }

  /** How lit windows and lanterns should be, with a soft turn-on at dusk. */
  get lampStrength(): number {
    return clamp((this.darkness - 0.18) / 0.42, 0, 1);
  }

  sample(): { ambient: [number, number, number]; level: number; sky: [number, number, number] } {
    const h = this.hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].at <= h) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = invLerp(a.at, b.at, h);
    return {
      ambient: [
        lerp(a.ambient[0], b.ambient[0], t),
        lerp(a.ambient[1], b.ambient[1], t),
        lerp(a.ambient[2], b.ambient[2], t),
      ],
      level: lerp(a.level, b.level, t),
      sky: [lerp(a.sky[0], b.sky[0], t), lerp(a.sky[1], b.sky[1], t), lerp(a.sky[2], b.sky[2], t)],
    };
  }

  /** Ambient colour pre-multiplied by its level — what lighting fills with. */
  ambientCss(): string {
    const s = this.sample();
    return rgbToCss(s.ambient[0] * s.level, s.ambient[1] * s.level, s.ambient[2] * s.level);
  }

  skyCss(): string {
    const s = this.sample();
    return rgbToCss(s.sky[0], s.sky[1], s.sky[2]);
  }

  /**
   * Where shadows fall. Long and to the west at sunrise, short at noon, long
   * and to the east at sunset — the cheapest possible cue that time is passing.
   */
  shadow(): { dx: number; dy: number; alpha: number } {
    const h = this.hour;
    // Daylight fraction: 0 before sunrise and after sunset, 1 around noon.
    const up = clamp((h - 5.6) / 1.4, 0, 1) * clamp((20.2 - h) / 1.6, 0, 1);
    const t = clamp((h - 6) / 12, 0, 1); // 0 at sunrise, 1 at sunset
    const lengthen = 1 - Math.sin(t * Math.PI); // 0 at noon, 1 at the ends
    const len = 1.4 + lengthen * 5.5;
    return {
      dx: -Math.cos(t * Math.PI) * len,
      dy: 0.9 + lengthen * 0.8,
      alpha: (0.16 + up * 0.24) * (0.35 + up * 0.65),
    };
  }
}
