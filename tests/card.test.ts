import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
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

  it('switches to and from the birthday picture over midnight without a reload', async () => {
    const el = await make({ kids: [{ id: 'k1', theme: 'bricks', birthday: '12-10' }, { id: 'k2', theme: 'dino' }] });
    const html = () => el.shadowRoot!.innerHTML;
    el.now = () => new Date(2026, 11, 9, 23, 59);
    el.hass = { states };
    await el.updateComplete;
    expect(html()).not.toContain('data-theme="birthday"');
    el.now = () => new Date(2026, 11, 10, 0, 1);
    el.hass = { states };
    await el.updateComplete;
    expect(html()).toContain('data-theme="birthday"');
    el.now = () => new Date(2026, 11, 11, 0, 1);
    el.hass = { states };
    await el.updateComplete;
    expect(html()).not.toContain('data-theme="birthday"');
  });

  it('switches to the birthday picture when TaskMate reports the birthday on the same date', async () => {
    const el = await make({ kids: [{ id: 'k1', theme: 'bricks' }, { id: 'k2', theme: 'dino' }] });
    const html = () => el.shadowRoot!.innerHTML;
    el.now = () => new Date(2026, 5, 10, 8, 0);
    el.hass = { states };
    await el.updateComplete;
    expect(html()).not.toContain('data-theme="birthday"');
    const next = JSON.parse(JSON.stringify(states)) as HassStates;
    const children = next['sensor.taskmate_overview'].attributes.children as Record<string, unknown>[];
    children.find((c) => c.id === 'k1')!.birthday = { multiplier: 2, age: 7 };
    el.now = () => new Date(2026, 5, 10, 8, 1);
    el.hass = { states: next };
    await el.updateComplete;
    expect(html()).toContain('data-theme="birthday"');
    expect(html().match(/data-part="candle"/g) ?? []).toHaveLength(7);
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

const KIDS = [{ id: 'k1', theme: 'bricks' }, { id: 'k2', theme: 'dino' }];
const area = (w: number, h: number) => () => ({ w, h });

/** A card set up before it is attached, so the first measurement sees the override. */
function card(fill: unknown, measure?: () => { w: number; h: number }): FamilyBoardCard {
  const el = document.createElement('family-board-card') as FamilyBoardCard;
  if (measure) el.measure = measure;
  el.setConfig({ kids: KIDS, fill });
  return el;
}

/** hui-panel-view → (shadow root) → hui-card → child, as in Home Assistant frontend 20261028.6. */
function inPanel(child: Element): Element {
  const panel = document.createElement('hui-panel-view');
  const wrapper = document.createElement('hui-card');
  panel.attachShadow({ mode: 'open' }).append(wrapper);
  wrapper.append(child);
  document.body.append(panel);
  return panel;
}

/** Waits until no update is pending, including the one firstUpdated's measurement requests. */
async function settle(el: FamilyBoardCard) {
  while (!(await el.updateComplete));
}

async function show(el: FamilyBoardCard, s: HassStates = states) {
  el.hass = { states: s };
  await settle(el);
}

const viewBox = (el: FamilyBoardCard) => el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox');
const cardHeight = (el: FamilyBoardCard) => el.shadowRoot!.querySelector<HTMLElement>('ha-card')!.style.height;

function expectNotFilling(el: FamilyBoardCard) {
  expect(viewBox(el)).toBe('0 0 800 450');
  expect(el.shadowRoot!.querySelector('ha-card')!.hasAttribute('style')).toBe(false);
  expect(el.shadowRoot!.querySelector('ha-card')!.hasAttribute('class')).toBe(false);
}

describe('family-board-card fill', () => {
  it('fills the measured area with fill: true', async () => {
    const el = card(true, area(1152, 720));
    document.body.append(el);
    await show(el);
    expect(viewBox(el)).toBe('0 0 720 450');
    expect(cardHeight(el)).toBe('720px');
  });

  it('fills under auto as the panel view\'s own card', async () => {
    const el = card('auto', area(1152, 720));
    inPanel(el);
    await show(el);
    expect(viewBox(el)).toBe('0 0 720 450');
    expect(cardHeight(el)).toBe('720px');
  });

  it('does not fill under auto inside a stack in a panel view', async () => {
    const el = card('auto', area(1152, 720));
    const stack = document.createElement('hui-vertical-stack-card');
    const inner = document.createElement('hui-card');
    stack.attachShadow({ mode: 'open' }).append(inner);
    inner.append(el);
    inPanel(stack);
    await show(el);
    expectNotFilling(el);
  });

  it('does not fill under auto outside a panel view', async () => {
    const el = card('auto', area(1152, 720));
    document.body.append(el);
    await show(el);
    expectNotFilling(el);
  });

  it('does not fill with fill: false in a panel view', async () => {
    const el = card(false, area(1152, 720));
    inPanel(el);
    await show(el);
    expectNotFilling(el);
  });

  it('does not fill an area narrower than 100 px', async () => {
    const el = card(true, area(80, 720));
    document.body.append(el);
    await show(el);
    expectNotFilling(el);
  });

  describe('window measurement', () => {
    let top = 56;
    const innerHeight = window.innerHeight;
    let rects: { mockRestore(): void } | undefined;
    afterEach(() => {
      top = 56;
      rects?.mockRestore();
      Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true, writable: true });
    });

    /** Only the ha-card has a box, as in a browser where the inline host and hui-card report width 0. */
    function measured(): FamilyBoardCard {
      Object.defineProperty(window, 'innerHeight', { value: 776, configurable: true, writable: true });
      rects = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        return (this.localName === 'ha-card' ? { top, width: 1152 } : { top, width: 0 }) as DOMRect;
      });
      return card(true);
    }

    it('fills after the first update, before any hass, measuring the ha-card not the host', async () => {
      vi.useFakeTimers();
      const el = measured();
      document.body.append(el);
      await settle(el);
      expect(cardHeight(el)).toBe('720px');
      await show(el);
      expect(viewBox(el)).toBe('0 0 720 450');
    });

    it('rounds the height down for a fractional top edge', async () => {
      top = 56.5;
      const el = measured();
      document.body.append(el);
      await show(el);
      expect(cardHeight(el)).toBe('719px');
    });

    it('measures from the card\'s top edge to the bottom of the window and follows a move on refit()', async () => {
      const el = measured();
      document.body.append(el);
      await show(el);
      expect(viewBox(el)).toBe('0 0 720 450');
      expect(cardHeight(el)).toBe('720px');
      top = 0;
      el.refit();
      await el.updateComplete;
      expect(cardHeight(el)).toBe('776px');
      expect(viewBox(el)).not.toBe('0 0 720 450');
    });

    it('picks up a move after 2 s without refit()', async () => {
      vi.useFakeTimers();
      const el = measured();
      document.body.append(el);
      await show(el);
      top = 0;
      vi.advanceTimersByTime(1999);
      await el.updateComplete;
      expect(cardHeight(el)).toBe('720px');
      vi.advanceTimersByTime(1);
      await el.updateComplete;
      expect(cardHeight(el)).toBe('776px');
      expect(viewBox(el)).not.toBe('0 0 720 450');
    });

    it('picks up a move on the next hass set', async () => {
      const el = measured();
      document.body.append(el);
      await show(el);
      top = 0;
      await show(el);
      expect(cardHeight(el)).toBe('776px');
      expect(viewBox(el)).not.toBe('0 0 720 450');
    });
  });

  it('marks no item as new on a size-only redraw', async () => {
    let size = { w: 1152, h: 720 };
    const el = card(true, () => size);
    document.body.append(el);
    await show(el);
    const more = JSON.parse(JSON.stringify(states)) as HassStates;
    const kids = more['sensor.taskmate_overview'].attributes.children as Array<Record<string, unknown>>;
    kids.find((c) => c.id === 'k1')!.spendable_balance = 13;
    await show(el, more);
    expect(el.shadowRoot!.querySelectorAll('.fb-new').length).toBeGreaterThan(0);
    size = { w: 1440, h: 720 };
    el.refit();
    await el.updateComplete;
    expect(viewBox(el)).toBe('0 0 900 450');
    expect(el.shadowRoot!.querySelectorAll('.fb-new').length).toBe(0);
  });

  it('does not redraw when refit() finds the same size', async () => {
    const el = card(true, area(1152, 720));
    document.body.append(el);
    await show(el);
    const before = el._svg;
    vi.mocked(renderBoard).mockClear();
    el.refit();
    await el.updateComplete;
    expect(renderBoard).not.toHaveBeenCalled();
    expect(el._svg).toBe(before);
  });

  it('stops measuring once removed', async () => {
    vi.useFakeTimers();
    const measure = vi.fn(area(1152, 720));
    const el = card(true, measure);
    document.body.append(el);
    await show(el);
    expect(measure).toHaveBeenCalled();
    el.remove();
    measure.mockClear();
    vi.advanceTimersByTime(10_000);
    window.dispatchEvent(new Event('resize'));
    expect(measure).not.toHaveBeenCalled();
  });

  it('re-measures on a window resize', async () => {
    const measure = vi.fn(area(1152, 720));
    const el = card(true, measure);
    document.body.append(el);
    await show(el);
    measure.mockClear();
    window.dispatchEvent(new Event('resize'));
    expect(measure).toHaveBeenCalledTimes(1);
  });
});

describe('family-board-card fill observers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('measures again after a re-attach', async () => {
    vi.useFakeTimers();
    const measure = vi.fn(area(1152, 720));
    const el = card(true, measure);
    document.body.append(el);
    await show(el);
    el.remove();
    document.body.append(el);
    measure.mockClear();
    window.dispatchEvent(new Event('resize'));
    expect(measure).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it('keeps the filled board when hass is set while detached', async () => {
    const el = card(true, area(1152, 720));
    document.body.append(el);
    await show(el);
    el.remove();
    await show(el, JSON.parse(JSON.stringify(states)));
    expect(viewBox(el)).toBe('0 0 720 450');
    expect(cardHeight(el)).toBe('720px');
  });

  it('observes the ha-card, refits on the next frame, and observes again after a re-attach', async () => {
    const observed: Element[] = [];
    const callbacks: Array<() => void> = [];
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { callbacks.push(cb); }
      observe(target: Element) { observed.push(target); }
      disconnect = disconnect;
    });
    const frames: Array<() => void> = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let size = { w: 1152, h: 720 };
    const el = card(true, () => size);
    document.body.append(el);
    await show(el);
    const haCard = el.shadowRoot!.querySelector('ha-card');
    expect(observed).toEqual([haCard]);
    size = { w: 1440, h: 720 };
    callbacks[0]();
    callbacks[0]();
    expect(frames).toHaveLength(1);
    await settle(el);
    expect(viewBox(el)).toBe('0 0 720 450');
    frames[0]();
    await settle(el);
    expect(viewBox(el)).toBe('0 0 900 450');
    expect(el.shadowRoot!.querySelector('ha-card')).toBe(haCard);
    el.remove();
    expect(disconnect).toHaveBeenCalled();
    document.body.append(el);
    expect(observed).toEqual([haCard, haCard]);
  });
});
