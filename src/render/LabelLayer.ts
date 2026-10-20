import { Container, Text } from 'pixi.js';
import { PALETTE } from '../config/palette';
import type { RoomLabel } from '../world/Room';

/**
 * Short world-space inscriptions above doors. Text is rendered at 2x resolution and
 * anchored bottom-center so plaques sit on the wall rather than floating in screen space.
 */
export class LabelLayer {
  readonly view = new Container();

  constructor(labels: readonly RoomLabel[]) {
    for (const label of labels) {
      const text = new Text({
        text: label.text,
        style: {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: label.size ?? 8,
          fill: PALETTE[label.color],
          letterSpacing: 1.6,
          align: 'center',
          stroke: { color: PALETTE.void, width: 2 },
        },
      });
      text.anchor.set(0.5, 1);
      text.position.set(label.x, label.y);
      text.alpha = label.alpha ?? 0.8;
      text.resolution = 2;
      this.view.addChild(text);
    }
  }
}
