import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AliyahNav, groupBySlug, type AliyahNavItem } from './AliyahNav.js';

const done = { done: 1, total: 1, fraction: 1 };
const empty = { done: 0, total: 1, fraction: 0 };

function items(slug: string, count: number): AliyahNavItem[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `${slug}:${String(i + 1)}`,
    slug,
    n: i + 1,
    summary: empty,
  }));
}

describe('groupBySlug', () => {
  it('keeps a single parsha as one group', () => {
    expect(groupBySlug(items('bereshit', 7))).toHaveLength(1);
  });

  it('splits two consecutive parshiyot into two groups', () => {
    const groups = groupBySlug([...items('matot', 7), ...items('masei', 7)]);
    expect(groups.map((g) => g.slug)).toEqual(['matot', 'masei']);
    expect(groups[0]?.items).toHaveLength(7);
    expect(groups[1]?.items).toHaveLength(7);
  });

  it('returns nothing for an empty list', () => {
    expect(groupBySlug([])).toEqual([]);
  });
});

describe('AliyahNav', () => {
  it('renders a single parsha as plain numbered buttons with no group label', () => {
    render(
      <AliyahNav
        aliyot={items('bereshit', 7)}
        names={{ bereshit: 'Bereshit' }}
        showSlug={false}
        onJump={vi.fn()}
        label="Aliyot"
      />,
    );
    expect(screen.queryByText('Bereshit')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('labels each group in a combined week instead of repeating 1-7 unmarked', () => {
    render(
      <AliyahNav
        aliyot={[...items('matot', 7), ...items('masei', 7)]}
        names={{ matot: 'Matot', masei: 'Masei' }}
        showSlug
        onJump={vi.fn()}
        label="Aliyot"
      />,
    );
    expect(screen.getByText('Matot')).toBeInTheDocument();
    expect(screen.getByText('Masei')).toBeInTheDocument();
    // 14 aliyot, not 7 — the fix is labelling the duplication, not hiding it.
    expect(screen.getAllByRole('button')).toHaveLength(14);
  });

  it('gives each button in a combined week a distinguishing accessible name', () => {
    render(
      <AliyahNav
        aliyot={[...items('matot', 2), ...items('masei', 2)]}
        names={{ matot: 'Matot', masei: 'Masei' }}
        showSlug
        onJump={vi.fn()}
        label="Aliyot"
      />,
    );
    expect(screen.getByRole('button', { name: 'Matot 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masei 1' })).toBeInTheDocument();
  });

  it('jumps using the item key, not just the aliyah number', async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();
    render(
      <AliyahNav
        aliyot={[...items('matot', 1), ...items('masei', 1)]}
        names={{ matot: 'Matot', masei: 'Masei' }}
        showSlug
        onJump={onJump}
        label="Aliyot"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Masei 1' }));
    expect(onJump).toHaveBeenCalledWith('masei:1');
  });

  it('marks a completed aliyah distinctly from one in progress', () => {
    render(
      <AliyahNav
        aliyot={[
          { key: 'a:1', slug: 'a', n: 1, summary: done },
          { key: 'a:2', slug: 'a', n: 2, summary: { done: 1, total: 3, fraction: 1 / 3 } },
          { key: 'a:3', slug: 'a', n: 3, summary: empty },
        ]}
        names={{ a: 'A' }}
        showSlug={false}
        onJump={vi.fn()}
        label="Aliyot"
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]?.className).toContain('color-accent)]');
    expect(buttons[2]?.className).not.toContain('bg-[var(--color-accent)]');
  });
});
