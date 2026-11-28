import { describe, expect, it } from 'vitest';
import { fold, normalize, shortName, singular, withinEdits } from '../src';

describe('normalisation', () => {
  it('strips accents and tone marks so names can be typed plainly', () => {
    expect(fold('Ẹ̀fọ́')).toBe('efo');
    expect(normalize('Ìsú')).toBe('isu');
    expect(normalize('  Ewédú   leaves ')).toBe('ewedu leaf');
  });
  it('singularises common plurals', () => {
    expect(singular('tomatoes')).toBe('tomato');
    expect(singular('onions')).toBe('onion');
    expect(singular('leaves')).toBe('leaf');
    expect(singular('cloves')).toBe('clove');
    expect(singular('berries')).toBe('berry');
    expect(singular('eggs')).toBe('egg');
  });
  it('leaves short words and -ss/-us/-is words alone', () => {
    expect(singular('gas')).toBe('gas');
    expect(singular('yam')).toBe('yam');
    expect(singular('watercress')).toBe('watercress');
    expect(singular('asparagus')).toBe('asparagus');
  });
  it('tolerates one typo, not two', () => {
    expect(withinEdits('tomatoe', 'tomato', 1)).toBe(true);
    expect(withinEdits('crayfsh', 'crayfish', 1)).toBe(true);
    expect(withinEdits('tomatoe', 'potato', 1)).toBe(false);
  });
  it('shortens names for display', () => {
    expect(shortName('Spinach / efo tete (African spinach)')).toBe('Spinach / efo tete');
    expect(shortName('Yam')).toBe('Yam');
  });
});
