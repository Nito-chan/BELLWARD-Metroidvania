export type PlayerStateName =
  | 'idle'
  | 'run'
  | 'skid'
  | 'jump'
  | 'fall'
  | 'wallslide'
  | 'attack'
  | 'guard'
  | 'dash'
  | 'heal'
  | 'hurt'
  | 'dead';

/**
 * Momentary things the simulation did, in the tick they happened. Audio and visual
 * effects consume these instead of diffing state, so a footstep cannot double-fire and
 * a landing cannot be missed because the state changed twice in one tick.
 */
export type PlayerEvent =
  | 'jump'
  | 'land'
  | 'landHeavy'
  | 'footstep'
  | 'skid'
  | 'attack1'
  | 'attack2'
  | 'dash'
  | 'wallJump'
  | 'heal'
  | 'shield'
  | 'hurt'
  | 'death';
