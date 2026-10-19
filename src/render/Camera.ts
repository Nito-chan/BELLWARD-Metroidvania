import { CAMERA } from '../config/render';
import { VIEW } from '../config/world';
import { BellwardError } from '../core/Errors';
import { clamp, lerp } from '../core/Math2D';
import type { Rect, Vec2 } from '../core/Types';

/**
 * Room-bounded follow camera. Pure math, no Pixi: the simulation drives it once per
 * fixed tick, and the renderer samples an interpolated view so motion stays smooth at
 * any refresh rate without making the simulation frame-rate dependent.
 */
export class Camera {
  private prevX = 0;
  private prevY = 0;
  private currentX = 0;
  private currentY = 0;
  private bounds: Rect;

  constructor(bounds: Rect) {
    validateBounds(bounds);
    this.bounds = { ...bounds };
    this.snapTo(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
  }

  /** Smoothed camera position (top-left of the view), in world pixels. */
  get x(): number {
    return this.currentX;
  }

  get y(): number {
    return this.currentY;
  }

  /** Current view center in world pixels. */
  get center(): Vec2 {
    return { x: this.currentX + VIEW.width / 2, y: this.currentY + VIEW.height / 2 };
  }

  /** Replaces the room bounds (on room transitions) and re-clamps immediately. */
  setBounds(bounds: Rect): void {
    validateBounds(bounds);
    this.bounds = { ...bounds };
    this.currentX = clampAxis(this.currentX, this.bounds.x, this.bounds.w, VIEW.width);
    this.currentY = clampAxis(this.currentY, this.bounds.y, this.bounds.h, VIEW.height);
    this.prevX = this.currentX;
    this.prevY = this.currentY;
  }

  /** Places the camera immediately (no smoothing) so the focus sits at the view center. */
  snapTo(focusX: number, focusY: number): void {
    this.currentX = clampAxis(focusX - VIEW.width / 2, this.bounds.x, this.bounds.w, VIEW.width);
    this.currentY = clampAxis(focusY - VIEW.height / 2, this.bounds.y, this.bounds.h, VIEW.height);
    this.prevX = this.currentX;
    this.prevY = this.currentY;
  }

  /** Advances one fixed tick toward the focus point, honouring the deadzone and bounds. */
  update(focusX: number, focusY: number): void {
    this.prevX = this.currentX;
    this.prevY = this.currentY;

    const desiredX = desiredAxis(this.currentX, focusX, VIEW.width, CAMERA.deadzone.x);
    const desiredY = desiredAxis(this.currentY, focusY, VIEW.height, CAMERA.deadzone.y);
    this.currentX = clampAxis(
      this.currentX + (desiredX - this.currentX) * CAMERA.smoothing,
      this.bounds.x,
      this.bounds.w,
      VIEW.width,
    );
    this.currentY = clampAxis(
      this.currentY + (desiredY - this.currentY) * CAMERA.smoothing,
      this.bounds.y,
      this.bounds.h,
      VIEW.height,
    );
  }

  /** Top-left of the visible world rect, interpolated between the last two ticks. */
  view(alpha: number): Vec2 {
    return {
      x: lerp(this.prevX, this.currentX, alpha),
      y: lerp(this.prevY, this.currentY, alpha),
    };
  }
}

/** Returns the camera position that keeps the focus inside the deadzone without overshoot. */
function desiredAxis(current: number, focus: number, viewSize: number, deadzone: number): number {
  const center = current + viewSize / 2;
  const delta = focus - center;
  if (delta > deadzone) return current + (delta - deadzone);
  if (delta < -deadzone) return current + (delta + deadzone);
  return current;
}

/**
 * Clamps one camera axis to the room. Rooms narrower than the viewport are centered
 * (which intentionally pushes the camera into negative coordinates).
 */
function clampAxis(value: number, min: number, size: number, viewSize: number): number {
  if (size <= viewSize) {
    return min + (size - viewSize) / 2;
  }
  return clamp(value, min, min + size - viewSize);
}

function validateBounds(bounds: Rect): void {
  if (!(bounds.w > 0) || !(bounds.h > 0)) {
    throw new BellwardError(`camera bounds must be positive, got ${bounds.w}x${bounds.h}`);
  }
}
