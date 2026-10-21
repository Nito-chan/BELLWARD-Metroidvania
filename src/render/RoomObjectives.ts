/**
 * Room objective state and presentation outside the boss encounter itself: collectible
 * pickups, breakable secrets, boss/Ordeal reward queues and the Tide-door ending trigger.
 * The scene owns the encounter; this class owns what a tick must report to RunSession and
 * the feedback that accompanies it.
 */
import { BOSS_REWARDS } from '../config/bossTypes';
import { BOSS_KINDS, type BossKind } from '../config/enemies';
import { PICKUP } from '../config/pickups';
import { bodyRect, overlaps } from '../combat/geometry';
import type { PlayerController } from '../player/PlayerController';
import type { Banner } from '../ui/Banner';
import type { Hud } from '../ui/Hud';
import type { Room } from '../world/Room';
import type { Camera } from './Camera';
import type { SceneAudio } from './CombatFeedback';
import type { EffectsLayer } from './EffectsLayer';
import type { PickupLayer } from './PickupLayer';
import type { TileLayer } from './TileLayer';
import { getPickup } from '../data/pickups';

export type RoomObjectivesOptions = {
  readonly room: Room;
  readonly player: PlayerController;
  readonly pickups: PickupLayer;
  readonly tileLayer: TileLayer;
  readonly effects: EffectsLayer;
  readonly camera: Camera;
  readonly banner: Banner;
  readonly hud: Hud;
  readonly audio: SceneAudio;
  readonly announce: (text: string) => void;
  readonly canCollectPickup: (id: string) => boolean;
  readonly secretBroken?: boolean;
  readonly sealOpen?: boolean;
  readonly bossRewardClaimed?: boolean;
  readonly ordealCleared?: boolean;
  readonly sigilCount?: number;
  readonly endingComplete?: boolean;
};

export class RoomObjectives {
  private readonly pendingPickups: string[] = [];
  private secretBrokenValue = false;
  private arenaClaimedValue: boolean;
  private ordealClearedValue: boolean;
  private sigilCountValue: number;
  private secretBrokenThisVisitValue: boolean;
  private pendingBossDefeatValue: BossKind | null = null;
  private pendingOrdealDefeatValue: BossKind | null = null;
  private pendingEndingValue = false;
  /** Ending triggers are one-shot per run, so closing the card cannot reopen it. */
  private endingFired: boolean;

  constructor(private readonly options: RoomObjectivesOptions) {
    this.secretBrokenThisVisitValue = options.secretBroken ?? false;
    this.arenaClaimedValue = options.bossRewardClaimed ?? false;
    this.ordealClearedValue = options.ordealCleared ?? false;
    this.sigilCountValue = options.sigilCount ?? 0;
    this.endingFired = options.endingComplete ?? false;
  }

  get arenaClaimed(): boolean {
    return this.arenaClaimedValue;
  }

  get ordealCleared(): boolean {
    return this.ordealClearedValue;
  }

  get sigilCount(): number {
    return this.sigilCountValue;
  }

  get secretBrokenThisVisit(): boolean {
    return this.secretBrokenThisVisitValue;
  }

  get sealOpen(): boolean {
    return this.options.sealOpen ?? false;
  }

  /** Pickup ids granted this tick; RunSession records them in the run save. */
  consumePickups(): readonly string[] {
    if (this.pendingPickups.length === 0) return [];
    return this.pendingPickups.splice(0, this.pendingPickups.length);
  }

  /** True on the tick the secret wall shattered; RunSession persists the room id. */
  consumeSecretBroken(): boolean {
    const broken = this.secretBrokenValue;
    this.secretBrokenValue = false;
    return broken;
  }

  consumeBossDefeat(): BossKind | null {
    const kind = this.pendingBossDefeatValue;
    this.pendingBossDefeatValue = null;
    return kind;
  }

  consumeOrdealDefeat(): BossKind | null {
    const kind = this.pendingOrdealDefeatValue;
    this.pendingOrdealDefeatValue = null;
    return kind;
  }

  consumeEnding(): boolean {
    const ended = this.pendingEndingValue;
    this.pendingEndingValue = false;
    return ended;
  }

  /** Walks over a collectible and asks the run whether it may be granted. */
  updatePickups(): void {
    const player = this.options.player;
    if (player.dead) return;
    const feet = player.feet;
    for (const placement of this.options.room.definition.pickups ?? []) {
      if (!this.options.pickups.has(placement.id)) continue;
      if (Math.abs(feet.x - placement.x) > PICKUP.radiusX) continue;
      if (Math.abs(feet.y - placement.y) > PICKUP.radiusY) continue;
      if (!this.options.canCollectPickup(placement.id)) continue;
      this.options.pickups.collect(placement.id);
      this.pendingPickups.push(placement.id);
      const def = getPickup(placement.id);
      this.options.effects.spark(placement.x, placement.y, 1);
      this.options.audio.playSfx('bell');
      this.options.banner.show(def.name.toUpperCase(), def.description, 120);
      this.options.announce(`${def.name}. ${def.description}`);
    }
  }

  /** A nail swing against cracked masonry opens a one-way secret passage. */
  tryBreakSecret(): void {
    const player = this.options.player;
    if (this.secretBrokenValue || !player.attackActive) return;
    const hitbox = player.attackHitbox();
    if (!hitbox || !this.options.room.tilemap.hasRoleInRect('breakable', hitbox)) return;
    this.options.room.tilemap.removeAll('breakable');
    this.options.tileLayer.removeRole('breakable');
    this.secretBrokenValue = true;
    this.secretBrokenThisVisitValue = true;
    this.options.effects.spark(hitbox.x + hitbox.w / 2, hitbox.y + hitbox.h / 2, player.facing);
    this.options.audio.playSfx('bossWard');
    this.options.camera.shake(4, 12);
    this.options.banner.show('A HIDDEN PASSAGE', 'The cracked stone gives way.', 150);
    this.options.announce('A hidden passage opens.');
  }

  /** First clear of a boss grants one mask and records the sigil for the run. */
  onBossDefeated(kind: BossKind, ordeal: boolean): void {
    if (ordeal) {
      this.pendingOrdealDefeatValue = kind;
      this.ordealClearedValue = true;
      this.options.hud.setHealth(this.options.player.hp, this.options.player.maxHp);
      return;
    }
    this.arenaClaimedValue = true;
    this.options.player.grantMaxHp(BOSS_REWARDS.maxHpPerSigil);
    this.sigilCountValue += 1;
    this.pendingBossDefeatValue = kind;
    this.options.hud.setSigils(this.sigilCountValue, BOSS_KINDS.length);
    this.options.hud.setHealth(this.options.player.hp, this.options.player.maxHp);
  }

  /** The Tide door ending fires once; the run owns the actual ending screen. */
  updateEnding(): void {
    const ending = this.options.room.definition.ending;
    if (
      !ending ||
      !this.sealOpen ||
      this.endingFired ||
      this.pendingEndingValue ||
      this.options.player.dead
    ) {
      return;
    }
    if (!overlaps(bodyRect(this.options.player.body), ending)) return;
    this.endingFired = true;
    this.pendingEndingValue = true;
    this.options.banner.show(ending.title, ending.subtitle, 240);
    this.options.announce(`${ending.title}. ${ending.subtitle}`);
    this.options.audio.playSfx('bell');
  }
}
