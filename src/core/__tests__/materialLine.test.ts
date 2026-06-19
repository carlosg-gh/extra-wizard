import { describe, expect, it } from 'vitest';
import { materialLineFromText } from '../index-build/materialLine';

describe('materialLineFromText', () => {
  it('returns the first line for normal extra-deck text', () => {
    expect(materialLineFromText('2 Level 4 monsters\nOnce per turn...')).toBe('2 Level 4 monsters');
  });

  it('skips the Pendulum Effect header to the monster materials', () => {
    const desc =
      '[ Pendulum Effect ]\nOnce per turn...\n----------------------------------------\n[ Monster Effect ]\n2 Pendulum Monsters\nGains ATK...';
    expect(materialLineFromText(desc)).toBe('2 Pendulum Monsters');
  });

  it('skips a separator rule immediately after the marker', () => {
    const desc = '[ Pendulum Effect ]\nx\n[ Monster Effect ]\n------\n1 Tuner + 1 non-Tuner monster\n...';
    expect(materialLineFromText(desc)).toBe('1 Tuner + 1 non-Tuner monster');
  });

  it('handles empty / nullish input', () => {
    expect(materialLineFromText('')).toBe('');
    expect(materialLineFromText(null)).toBe('');
    expect(materialLineFromText(undefined)).toBe('');
  });
});
