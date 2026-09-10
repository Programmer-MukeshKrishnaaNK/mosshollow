/**
 * The dialogue box.
 *
 * Sits low and wide, in the same wood-and-paper language as the rest of the
 * interface. It grows out of its own centre as it opens rather than fading in,
 * which reads as something being handed to you.
 *
 * The advance caret is a small triangle that bobs — and only appears once the
 * line has finished revealing, so it is a genuine "ready" signal rather than
 * decoration.
 */

import { clamp } from '../core/math.ts';
import { PALETTE } from '../art/palette.ts';
import type { Dialogue } from '../systems/dialogue.ts';
import { LINE_HEIGHT, drawText, textWidth, wrapText } from './font.ts';
import { drawPanel } from './panel.ts';

const BOX_H = 48;
const MARGIN = 28;
const PAD = 10;

export function drawDialogue(
  ctx: CanvasRenderingContext2D,
  dlg: Dialogue,
  viewW: number,
  viewH: number,
  time: number,
): void {
  if (dlg.open <= 0.01) return;
  const t = clamp(dlg.open, 0, 1);
  // Ease out, so it settles rather than snapping to a stop.
  const ease = 1 - (1 - t) * (1 - t);

  const fullW = viewW - MARGIN * 2;
  const w = Math.round(fullW * (0.82 + ease * 0.18));
  const h = Math.round(BOX_H * (0.5 + ease * 0.5));
  const x = Math.round((viewW - w) / 2);
  const y = Math.round(viewH - 16 - h);

  ctx.globalAlpha = ease;
  drawPanel(ctx, x, y, w, h);

  const line = dlg.line;
  if (line && ease > 0.6) {
    let textY = y + PAD;

    if (line.speaker) {
      // The speaker's name sits on a small tab overlapping the top edge.
      const nameW = textWidth(line.speaker) + 10;
      drawPanel(ctx, x + 8, y - 7, nameW, 15);
      drawText(ctx, line.speaker, x + 13, y - 3, PALETTE.wood3);
      textY += 3;
    }

    const maxW = w - PAD * 2;
    const lines = wrapText(dlg.visibleText, maxW);
    lines.forEach((row, i) => {
      drawText(ctx, row, x + PAD, textY + i * LINE_HEIGHT, PALETTE.wood3);
    });

    if (dlg.lineComplete) {
      // A caret that bobs on a slow sine — never a blink, which reads as an
      // error state.
      const bob = Math.round(Math.sin(time * 5) * 1.2);
      const cx = x + w - 13;
      const cy = y + h - 12 + bob;
      ctx.fillStyle = PALETTE.wood2;
      ctx.fillRect(cx - 3, cy, 7, 1);
      ctx.fillRect(cx - 2, cy + 1, 5, 1);
      ctx.fillRect(cx - 1, cy + 2, 3, 1);
      ctx.fillRect(cx, cy + 3, 1, 1);
    }

    if (dlg.pageCount > 1) {
      // Bottom left, out of the text's way. Top right put it directly in the
      // path of the first wrapped line.
      const label = `${dlg.pageIndex + 1}/${dlg.pageCount}`;
      drawText(ctx, label, x + PAD, y + h - 13, PALETTE.wood1);
    }
  }
  ctx.globalAlpha = 1;
}
