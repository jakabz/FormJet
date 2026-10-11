import { IFormConfig, IGradient } from '../../models/IFormConfig';
import { backgroundCss, contrastTextColor, hasBox, isFormWidth, isHexColor, normalizeHexColor, resolveModeStyle } from '../FormStyle';
import { parseConfig } from '../LayoutResolver';
import { configJson } from './helpers';

function parseStyle(style: unknown): ReturnType<typeof parseConfig> {
  return parseConfig(configJson({ style: { base: style } }));
}

describe('FormStyle', () => {
  it('isHexColor / normalizeHexColor / isFormWidth', () => {
    expect(isHexColor('#abc')).toBe(true);
    expect(isHexColor('#A1B2C3')).toBe(true);
    expect(isHexColor('#12345')).toBe(false);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor(5)).toBe(false);
    expect(normalizeHexColor('#ABC')).toBe('#aabbcc');
    expect(isFormWidth(960)).toBe(true);
    expect(isFormWidth(100)).toBe(false);
    expect(isFormWidth('960')).toBe(false);
  });

  it('contrastTextColor: sötét háttéren fehér, világoson sötét szöveg', () => {
    expect(contrastTextColor('#0f6cbd')).toBe('#ffffff');
    expect(contrastTextColor('#fff4ce')).toBe('#201f1e');
  });

  describe('resolveModeStyle', () => {
    const gradient: IGradient = { type: 'linear', angle: 90, colors: ['#111111', '#222222'] };

    it('a mód tulajdonságonként felülírja az alapot', () => {
      expect(resolveModeStyle({ base: { accentColor: '#000000', maxWidth: 900 }, new: { accentColor: '#ffffff' } }, 'new')).toEqual({
        accentColor: '#ffffff',
        maxWidth: 900
      });
      expect(resolveModeStyle(undefined, 'edit')).toEqual({});
    });

    it('egyszínű háttér a módban lecseréli az alapból örökölt színátmenetet', () => {
      expect(resolveModeStyle({ base: { backgroundGradient: gradient }, edit: { background: '#ffffff' } }, 'edit')).toEqual({
        background: '#ffffff'
      });
      expect(resolveModeStyle({ base: { backgroundGradient: gradient }, edit: { borderWidth: 3 } }, 'edit').backgroundGradient).toBe(gradient);
    });
  });

  describe('backgroundCss / hasBox', () => {
    it('színátmenet és egyszínű háttér', () => {
      expect(backgroundCss({ backgroundGradient: { type: 'linear', angle: 135, colors: ['#fff9f5', '#ffe8dc'] } })).toBe(
        'linear-gradient(135deg, #fff9f5, #ffe8dc)'
      );
      expect(backgroundCss({ backgroundGradient: { type: 'linear', colors: ['#fff', '#000'] } })).toBe('linear-gradient(180deg, #fff, #000)');
      expect(backgroundCss({ backgroundGradient: { type: 'radial', colors: ['#fff', '#000'] } })).toBe(
        'radial-gradient(circle at center, #fff, #000)'
      );
      expect(backgroundCss({ background: '#abc' })).toBe('#abc');
      expect(backgroundCss({})).toBeUndefined();
    });

    it('ellenőrizetlen színátmenetből nem készül CSS', () => {
      const unsafe = { type: 'linear', angle: 90, colors: ['red;x', '#000'] } as unknown as IGradient;
      expect(backgroundCss({ background: '#abc', backgroundGradient: unsafe })).toBe('#abc');
      const badAngle = { type: 'linear', angle: '90deg);x', colors: ['#fff', '#000'] } as unknown as IGradient;
      expect(backgroundCss({ backgroundGradient: badAngle })).toBe('linear-gradient(180deg, #fff, #000)');
    });

    it('hasBox: háttér, keretszín vagy pozitív keretvastagság esetén igaz', () => {
      expect(hasBox({ background: '#fff' })).toBe(true);
      expect(hasBox({ borderColor: '#000' })).toBe(true);
      expect(hasBox({ borderWidth: 2 })).toBe(true);
      expect(hasBox({ borderWidth: 0 })).toBe(false);
      expect(hasBox({ borderRadius: 8 })).toBe(false);
    });
  });

  describe('ellenőrzés a parseConfig-ban', () => {
    it('az érvényes stílus megmarad, az ismeretlen kulcsok és üres részek kimaradnak', () => {
      const config = parseConfig(
        configJson({ style: { base: { accentColor: '#ABC', unknown: 'x', maxWidth: 1200 }, print: { accentColor: '#000' }, new: {} } })
      ).config as IFormConfig;
      expect(config.style).toEqual({ base: { accentColor: '#ABC', maxWidth: 1200 } });
      expect(parseConfig(configJson()).config?.style).toBeUndefined();
    });

    it('szabad CSS-re alkalmas értékek elutasítva', () => {
      [
        { background: 'url(https://x/y.png)' },
        { accentColor: 'red' },
        { background: '#fff;position:fixed' },
        { density: 'tiny' },
        { maxWidth: '960' },
        { maxWidth: 100 },
        { borderWidth: 20 },
        { borderWidth: -1 },
        { borderRadius: '50%' }
      ].forEach((style) => expect(parseStyle(style).error).toBeDefined());
      expect(parseConfig(configJson({ style: 'x' })).error).toBeDefined();
    });

    it('a színátmenet csak típusból, szögből és két hex színből állhat', () => {
      [
        { backgroundGradient: { type: 'conic', colors: ['#fff', '#000'] } },
        { backgroundGradient: { type: 'linear', colors: ['#fff', '#000', '#111'] } },
        { backgroundGradient: { type: 'linear', colors: ['#fff', 'url(x)'] } },
        { backgroundGradient: { type: 'linear', angle: 400, colors: ['#fff', '#000'] } },
        { backgroundGradient: { type: 'linear', angle: '90deg', colors: ['#fff', '#000'] } },
        { backgroundGradient: 'linear-gradient(red, blue)' }
      ].forEach((style) => expect(parseStyle(style).error).toBeDefined());
    });

    it('sugaras színátmenetnél a szög nem tárolódik', () => {
      const config = parseStyle({ backgroundGradient: { type: 'radial', angle: 45, colors: ['#FFF', '#000'], extra: 1 } }).config as IFormConfig;
      expect(config.style?.base?.backgroundGradient).toEqual({ type: 'radial', colors: ['#FFF', '#000'] });
    });

    it('szekció és mező stílusa is ellenőrzött, a hiba útvonallal jön', () => {
      expect(parseConfig(configJson({ sections: [{ id: 's', columns: 1, fields: [], style: { new: { borderColor: '#12' } } }] })).error).toContain(
        'sections[0].style.new.borderColor'
      );
      expect(parseConfig(configJson({ fields: { A: { style: { base: { labelColor: '#gggggg' } } } } })).error).toContain(
        'fields.A.style.base.labelColor'
      );
    });
  });
});
