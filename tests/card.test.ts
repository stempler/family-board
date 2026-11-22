import { beforeAll, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/docs-sample.json';
import { de } from '../src/i18n';
import type { HassStates } from '../src/adapter';

vi.mock('../src/board', async (orig) => {
  const mod = await orig<typeof import('../src/board')>();
  return { ...mod, renderBoard: vi.fn(mod.renderBoard) };
});

import { renderBoard } from '../src/board';
import { FamilyBoardCard } from '../src/family-board-card';
import { THEMES } from '../src/themes/registry';

const states = fixture as unknown as HassStates;

beforeAll(() => {
  expect(customElements.get('family-board-card')).toBe(FamilyBoardCard);
});

async function make(config: unknown = { kids: [{ id: 'k1', theme: 'bricks', tap_path: '/family-board/aufgaben' }, { id: 'k2', theme: 'dino' }] }) {
  const el = document.createElement('family-board-card') as FamilyBoardCard;
  document.body.appendChild(el);
  el.setConfig(config);
  return el;
}

describe('family-board-card element', () => {
  it('renders one half per kid', async () => {
    const el = await make();
    el.hass = { states };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-kid-half]').length).toBe(2);
  });

  it('setConfig throws on an empty config', async () => {
    const el = await make();
    expect(() => el.setConfig({})).toThrow();
  });

  it('re-renders only when the model changed', async () => {
    const el = await make();
    vi.mocked(renderBoard).mockClear();
    el.hass = { states };
    await el.updateComplete;
    el.hass = { states: JSON.parse(JSON.stringify(states)) };
    await el.updateComplete;
    expect(renderBoard).toHaveBeenCalledTimes(1);
  });

  it('navigates on tap of a kid half with tap_path', async () => {
    const el = await make();
    el.hass = { states };
    await el.updateComplete;
    const fired = vi.fn();
    window.addEventListener('location-changed', fired);
    el.shadowRoot!.querySelector('[data-kid-half="k1"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(location.pathname).toBe('/family-board/aufgaben');
    expect(fired).toHaveBeenCalledTimes(1);
    window.removeEventListener('location-changed', fired);
  });

  it('ignores taps on kids without tap_path', async () => {
    const el = await make();
    el.hass = { states };
    await el.updateComplete;
    history.pushState(null, '', '/x');
    el.shadowRoot!.querySelector('[data-kid-half="k2"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(location.pathname).toBe('/x');
  });

  it('ignores taps on a kid that is not found, even with a tap_path', async () => {
    const el = await make({ kids: [{ id: 'no-such-kid', theme: 'bricks', tap_path: '/family-board/aufgaben' }] });
    el.hass = { states };
    await el.updateComplete;
    history.pushState(null, '', '/x');
    const half = el.shadowRoot!.querySelector('[data-kid-half="no-such-kid"]')!;
    expect(half.textContent).toContain(de.kidNotFound);
    half.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(location.pathname).toBe('/x');
  });

  it('shows the missing text without states', async () => {
    const el = await make();
    el.hass = { states: {} };
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain(de.missing);
  });

  it('uses the now property for the date (christmas scene on 10 December)', async () => {
    const el = await make();
    el.now = () => new Date(2026, 11, 10);
    el.hass = { states };
    await el.updateComplete;
    expect(el.shadowRoot!.innerHTML).toContain('data-theme="christmas"');
  });

  it('navigates on a tap of the season scene in a kid half (10 December)', async () => {
    const el = await make();
    el.now = () => new Date(2026, 11, 10);
    el.hass = { states };
    await el.updateComplete;
    history.pushState(null, '', '/x');
    const hit = el.shadowRoot!.querySelector('[data-kid-half="k1"] > rect[fill="transparent"]')!;
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(location.pathname).toBe('/family-board/aufgaben');
  });

  it('keeps a render error inside set hass, shows the fallback and retries on the next update', async () => {
    const el = await make();
    vi.mocked(renderBoard).mockImplementationOnce(() => { throw new Error('boom'); });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => { el.hass = { states }; }).not.toThrow();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain(de.renderError);
    error.mockRestore();
    el.hass = { states: JSON.parse(JSON.stringify(states)) };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-kid-half]').length).toBe(2);
  });

  it('builds a stub config from the TaskMate children when hass is given', () => {
    expect(FamilyBoardCard.getStubConfig({ states })).toEqual({ kids: [{ id: 'k1', theme: 'bricks' }, { id: 'k2', theme: 'dino' }] });
  });

  it('builds the stub config from prefixed TaskMate sensors and names them', () => {
    const prefixed = {
      'sensor.wohnzimmer_taskmate_overview': states['sensor.taskmate_overview'],
      'sensor.wohnzimmer_taskmate_rewards': states['sensor.taskmate_rewards'],
    };
    expect(FamilyBoardCard.getStubConfig({ states: prefixed })).toEqual({
      overview_entity: 'sensor.wohnzimmer_taskmate_overview',
      rewards_entity: 'sensor.wohnzimmer_taskmate_rewards',
      kids: [{ id: 'k1', theme: 'bricks' }, { id: 'k2', theme: 'dino' }],
    });
  });

  it('has a valid placeholder stub config without hass', async () => {
    const stub = FamilyBoardCard.getStubConfig();
    expect(stub).toEqual({ kids: [{ id: 'kind-1', theme: 'bricks' }] });
    const el = await make();
    expect(() => el.setConfig(stub)).not.toThrow();
    expect(FamilyBoardCard.getStubConfig({ states: {} })).toEqual(stub);
  });

  it('styles include reduced motion and every theme\'s css', () => {
    const styles = [FamilyBoardCard.styles].flat(Infinity) as Array<{ cssText: string }>;
    const text = styles.map((s) => s.cssText).join('\n');
    expect(text).toContain('prefers-reduced-motion');
    expect(text).toContain('.fb-anim');
    expect(text).toContain('animation: none');
    for (const theme of Object.values(THEMES)) {
      if (theme.css) expect(text, theme.id).toContain(theme.css.trim().slice(0, 40));
    }
  });

  it('lists the registered theme ids', () => {
    expect(FamilyBoardCard.themeIds).toEqual(Object.keys(THEMES));
  });

  it('exposes card metadata', () => {
    expect(new FamilyBoardCard().getCardSize()).toBe(8);
    expect((window as any).customCards).toContainEqual({ type: 'family-board-card', name: 'Family Board', description: 'Gezeichnete Punkteanzeige für TaskMate' });
  });
});
