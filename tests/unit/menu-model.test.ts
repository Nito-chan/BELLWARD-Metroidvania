import { describe, expect, it } from 'vitest';
import type { AudioMix } from '../../src/audio/AudioManager';
import { defaultBindings, type Bindings } from '../../src/input/bindings';
import { MenuModel } from '../../src/ui/menu/MenuModel';
import type { MenuAudio } from '../../src/ui/menu/menuTypes';

function fakeAudio(): MenuAudio & { mix: AudioMix; muted: boolean } {
  const state = {
    mix: { master: 0.9, music: 0.65, sfx: 0.9 },
    muted: false,
    getMix: () => ({ ...state.mix }),
    setVolume: (bus: keyof AudioMix, value: number) => {
      state.mix[bus] = value;
    },
    isMuted: () => state.muted,
    setMuted: (muted: boolean) => {
      state.muted = muted;
      return state.muted;
    },
  };
  return state;
}

function makeModel(): {
  model: MenuModel;
  audio: ReturnType<typeof fakeAudio>;
  applied: Bindings[];
  apply: (next: Bindings) => void;
} {
  const audio = fakeAudio();
  const applied: Bindings[] = [];
  const apply = (next: Bindings): void => {
    applied.push(next);
  };
  const model = new MenuModel({
    bindings: defaultBindings(),
    audio,
    applyBindings: apply,
  });
  return { model, audio, applied, apply };
}

describe('MenuModel screens', () => {
  it('opens on pause, navigates, and backs out one level at a time', () => {
    const { model } = makeModel();
    expect(model.screen).toBeNull();

    model.open();
    expect(model.screen).toBe('pause');
    model.navigate('settings');
    expect(model.back()).toBe('changed');
    expect(model.screen).toBe('pause');
    expect(model.back()).toBe('closed');
    expect(model.screen).toBeNull();
  });

  it('opens directly on the map and closes it with Back/Escape', () => {
    const { model } = makeModel();
    model.open('map');
    expect(model.screen).toBe('map');
    expect(model.capture).toBeNull();
    expect(model.back()).toBe('closed');
    expect(model.screen).toBeNull();
  });

  it('cancels an active capture instead of leaving the screen', () => {
    const { model } = makeModel();
    model.open();
    model.navigate('controls');
    model.beginCapture('jump', 'key', 0);
    expect(model.capture).not.toBeNull();
    expect(model.back()).toBe('cancelled');
    expect(model.capture).toBeNull();
    expect(model.screen).toBe('controls');
    expect(model.status).toContain('cancelled');
  });
});

describe('MenuModel rebinding', () => {
  it('binds a keyboard slot and reports it', () => {
    const { model, applied } = makeModel();
    model.navigate('controls');
    model.beginCapture('jump', 'key', 0);
    expect(model.statusTone).toBe('capture');

    model.useKey('KeyQ');
    expect(model.capture).toBeNull();
    expect(model.bindings.keyboard.jump).toEqual(['KeyQ', 'Space']);
    expect(applied).toHaveLength(1);
    expect(applied[0]?.keyboard.jump[0]).toBe('KeyQ');
    expect(model.status).toContain('Q');
  });

  it('keeps capture open on a cross-action conflict and applies nothing', () => {
    const { model, applied } = makeModel();
    model.navigate('controls');
    model.beginCapture('jump', 'key', 0);
    model.useKey('ArrowRight');

    expect(model.capture).not.toBeNull();
    expect(model.statusTone).toBe('error');
    expect(model.status).toContain('Move right');
    expect(applied).toHaveLength(0);
    expect(model.bindings.keyboard.jump[0]).toBe('KeyZ');
  });

  it('rejects a key already used by the same action, and reserved keys', () => {
    const { model } = makeModel();
    model.navigate('controls');
    model.beginCapture('jump', 'key', 0);
    model.useKey('Space');
    expect(model.status).toContain('Jump · Key 2');
    expect(model.capture).not.toBeNull();

    model.useKey('Escape');
    expect(model.status).toContain('belongs to the menu');
  });

  it('binds gamepad buttons and rejects reserved or conflicting ones', () => {
    const { model } = makeModel();
    model.navigate('controls');
    model.beginCapture('jump', 'pad', 0);
    model.usePadButton(2); // attack's X
    expect(model.statusTone).toBe('error');
    expect(model.capture).not.toBeNull();

    model.usePadButton(9); // Start belongs to the menu
    expect(model.status).toContain('belongs to the menu');

    model.usePadButton(4); // left bumper is free
    expect(model.capture).toBeNull();
    expect(model.bindings.gamepad.buttons.jump).toEqual([4]);
    expect(model.status).toContain('LB');
  });

  it('arms reset before restoring defaults', () => {
    const { model, applied } = makeModel();
    model.navigate('controls');
    model.beginCapture('jump', 'key', 0);
    model.useKey('KeyQ');
    expect(model.bindings.keyboard.jump[0]).toBe('KeyQ');

    expect(model.requestReset()).toBe('armed');
    expect(model.resetArmed).toBe(true);
    expect(model.bindings.keyboard.jump[0]).toBe('KeyQ');

    expect(model.requestReset()).toBe('applied');
    expect(model.bindings.keyboard.jump[0]).toBe('KeyZ');
    expect(applied).toHaveLength(2);
  });

  it('disarms reset when another edit starts', () => {
    const { model } = makeModel();
    model.navigate('controls');
    model.requestReset();
    model.beginCapture('jump', 'key', 0);
    expect(model.resetArmed).toBe(false);
  });
});

describe('MenuModel sound settings', () => {
  it('steps volume in configured increments and clamps at both ends', () => {
    const { model, audio } = makeModel();
    expect(model.adjustVolume('master', -1)).toBe(0.85);
    expect(audio.mix.master).toBe(0.85);
    expect(model.adjustVolume('master', 10)).toBe(1);
    model.setVolume('master', -1);
    expect(model.getVolume('master')).toBe(0);
  });

  it('toggles mute idempotently through the audio port', () => {
    const { model, audio } = makeModel();
    expect(model.toggleMute()).toBe(true);
    expect(audio.muted).toBe(true);
    expect(model.status).toContain('muted');
    expect(model.toggleMute()).toBe(false);
    expect(audio.muted).toBe(false);
  });

  it('toggles the accessibility camera shake only when the port is present', () => {
    let enabled = true;
    const model = new MenuModel({
      bindings: defaultBindings(),
      audio: fakeAudio(),
      accessibility: {
        screenShake: () => enabled,
        setScreenShake: (next) => {
          enabled = next;
          return enabled;
        },
      },
      applyBindings: () => undefined,
    });
    expect(model.supportsScreenShake()).toBe(true);
    expect(model.screenShakeEnabled()).toBe(true);
    expect(model.toggleScreenShake()).toBe(false);
    expect(model.status).toContain('disabled');
    expect(model.toggleScreenShake()).toBe(true);
    expect(model.status).toContain('enabled');

    const withoutPort = makeModel().model;
    expect(withoutPort.supportsScreenShake()).toBe(false);
    expect(withoutPort.toggleScreenShake()).toBe(true);
  });
});
