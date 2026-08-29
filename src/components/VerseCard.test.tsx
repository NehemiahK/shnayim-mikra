import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerseCard, type VerseCardProps } from './VerseCard.js';
import { buildReadingUnits, type TargumSource } from '../lib/reading-units.js';
import { translator } from '../i18n.js';
import type { ParshaText, RashiComment } from '../lib/types.js';

const parsha: ParshaText = {
  slug: 'test',
  book: 'Genesis',
  nameEn: 'Test',
  nameHe: 'ניסיון',
  aliyot: [{ n: 1, from: 0, to: 0, startRef: '1:1', endRef: '1:1' }],
  verses: [
    {
      c: 1,
      v: 1,
      he: 'בְּרֵאשִׁית֖ בָּרָ֣א',
      on: 'בְּקַדְמִין בְּרָא',
      en: 'In the beginning God created',
      oe: [{ t: 'In the beginning' }, { t: 'created', b: true }],
    },
  ],
};

const rashi: RashiComment[] = [
  { he: [{ t: 'בראשית.', b: true }, { t: 'אָמַר רַבִּי' }], en: [{ t: 'Rabbi Isaac said' }] },
];

function setup(over: Partial<VerseCardProps> = {}, targum: TargumSource = 'onkelos') {
  const unit = buildReadingUnits([parsha], {
    structure: 'verse',
    targum,
    mikraRepetitions: 2,
  })[0];
  if (!unit) throw new Error('no unit');

  const props: VerseCardProps = {
    unit,
    parsha,
    hebrewStyle: 'taamim',
    showTranslation: false,
    rashiEnglish: false,
    onkelosEnglish: false,
    rashiFallbackToOnkelos: false,
    parallel: false,
    state: '0'.repeat(unit.steps.length),
    expanded: false,
    rashi: undefined,
    rashiLoading: false,
    t: translator('en'),
    onToggleStep: vi.fn(),
    onAdvance: vi.fn(),
    onToggleExpand: vi.fn(),
    onToggleAll: vi.fn(),
    ...over,
  };
  render(<VerseCard {...props} />);
  return props;
}

describe('VerseCard', () => {
  it('shows the verse reference, Hebrew and Targum', () => {
    setup();
    expect(screen.getByText('1:1')).toBeInTheDocument();
    expect(screen.getByText(/בְּרֵאשִׁית/u)).toBeInTheDocument();
    expect(screen.getByText(/בְּקַדְמִין/u)).toBeInTheDocument();
  });

  it('renders one dot per reading step', () => {
    setup();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(3);
  });

  it('reflects completed steps', () => {
    setup({ state: '110' });
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2);
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(1);
  });

  describe('whole-verse checkbox', () => {
    it('is unchecked when nothing is done', () => {
      setup({ state: '000' });
      expect(screen.getByRole('checkbox', { name: /Mark verse read/u })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });

    it('shows a mixed state when only some steps are done', () => {
      setup({ state: '010' });
      expect(screen.getByRole('checkbox', { name: /Mark verse read/u })).toHaveAttribute(
        'aria-checked',
        'mixed',
      );
    });

    it('is checked once every step is done', () => {
      setup({ state: '111' });
      expect(screen.getByRole('checkbox', { name: /Mark verse read/u })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('calls onToggleAll on click regardless of current state', async () => {
      const user = userEvent.setup();
      const props = setup({ state: '010' });
      await user.click(screen.getByRole('checkbox', { name: /Mark verse read/u }));
      expect(props.onToggleAll).toHaveBeenCalledTimes(1);
    });

    it('names the specific verse, so multiple cards on one page are distinguishable', () => {
      setup();
      expect(screen.getByRole('checkbox', { name: 'Mark verse read 1:1' })).toBeInTheDocument();
    });
  });

  describe('Targum in English', () => {
    it('keeps it behind a disclosure rather than under the Aramaic', () => {
      setup();
      expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(screen.queryByText(/In the beginning/u)).not.toBeInTheDocument();
    });

    it('opens on demand', async () => {
      const user = userEvent.setup();
      setup();
      await user.click(screen.getByRole('button', { name: 'English' }));
      expect(screen.getByText(/In the beginning/u)).toBeInTheDocument();
    });

    it('starts open when the setting asks for it', () => {
      setup({ onkelosEnglish: true });
      expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('marks where Onkelos departs from the literal Hebrew', () => {
      setup({ onkelosEnglish: true });
      // The bold runs are the whole point of shipping this edition.
      expect(screen.getByText('created', { selector: 'strong' })).toBeInTheDocument();
    });

    it('does not nest the disclosure inside the tap-to-mark target', () => {
      setup();
      for (const button of screen.getAllByRole('button')) {
        expect(button.querySelector('button')).toBeNull();
      }
    });
  });

  it('advances Mikra when the Hebrew is tapped', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('button', { name: 'Mikra 1:1' }));
    expect(props.onAdvance).toHaveBeenCalledWith('mikra');
  });

  it('toggles a single pass when its dot is tapped', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('button', { name: 'Mikra first reading 1:1' }));
    expect(props.onToggleStep).toHaveBeenCalledWith('test:1:1:mikra1');
  });

  it('strips cantillation in nikud mode', () => {
    setup({ hebrewStyle: 'nikud' });
    const text = screen.getByText(/בְּרֵאשִׁית/u).textContent ?? '';
    expect(text).not.toMatch(/[֑-֯]/u);
  });

  it('shows the translation inline when enabled', () => {
    setup({ showTranslation: true });
    expect(screen.getByText('In the beginning God created')).toBeInTheDocument();
  });

  it('hides the translation by default', () => {
    setup();
    expect(screen.queryByText('In the beginning God created')).not.toBeInTheDocument();
  });

  it('reveals translation and Rashi when expanded', () => {
    setup({ expanded: true, rashi });
    expect(screen.getByRole('heading', { name: 'Translation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rashi' })).toBeInTheDocument();
    expect(screen.getByText('In the beginning God created')).toBeInTheDocument();
    // Rashi's Hebrew is the reading; its English waits behind the accordion.
    expect(screen.getByText(/אָמַר רַבִּי/u)).toBeInTheDocument();
    expect(screen.queryByText(/Rabbi Isaac said/u)).not.toBeInTheDocument();
  });

  it('opens Rashi\'s English on demand without disturbing the Hebrew', async () => {
    const user = userEvent.setup();
    setup({ expanded: true, rashi });

    // Both the Targum and Rashi now carry an "English" disclosure, so scope
    // to the Rashi section of the expanded panel.
    const rashiSection = screen.getByRole('heading', { name: 'Rashi' }).parentElement!;
    const toggle = within(rashiSection).getByRole('button', { name: 'English' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Rabbi Isaac said/u)).toBeInTheDocument();
    expect(screen.getByText(/אָמַר רַבִּי/u)).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText(/Rabbi Isaac said/u)).not.toBeInTheDocument();
  });

  it('starts Rashi\'s English open when the setting asks for it', () => {
    setup({ expanded: true, rashi, rashiEnglish: true });
    expect(screen.getByText(/Rabbi Isaac said/u)).toBeInTheDocument();
    const rashiSection = screen.getByRole('heading', { name: 'Rashi' }).parentElement!;
    expect(within(rashiSection).getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('marks the dibur hamatchil so Rashi stays navigable', () => {
    setup({ expanded: true, rashi });
    const bold = screen.getByText(/בראשית\./u, { selector: 'strong' });
    expect(bold).toBeInTheDocument();
  });

  it('says so when a verse has no Rashi', () => {
    setup({ expanded: true, rashi: [] });
    expect(screen.getByText('No Rashi on this verse.')).toBeInTheDocument();
  });

  it('falls back to Onkelos when Rashi is the third reading but this verse has none', () => {
    setup({ rashi: [], rashiFallbackToOnkelos: true }, 'rashi');
    expect(screen.getByText('No Rashi here — Targum instead:')).toBeInTheDocument();
    expect(screen.getByText(/בְּקַדְמִין/u)).toBeInTheDocument();
    expect(screen.queryByText('No Rashi on this verse.')).not.toBeInTheDocument();
    // The dot must say what is actually being read here, not what was assigned.
    expect(screen.getByRole('button', { name: 'Onkelos 1 1:1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rashi 1 1:1' })).not.toBeInTheDocument();
  });

  it('does not fall back when the setting is off, even with no Rashi', () => {
    setup({ rashi: [], rashiFallbackToOnkelos: false }, 'rashi');
    expect(screen.getByText('No Rashi on this verse.')).toBeInTheDocument();
    expect(screen.queryByText(/בְּקַדְמִין/u)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rashi 1 1:1' })).toBeInTheDocument();
  });

  it('does not fall back for a verse that actually has Rashi', () => {
    setup({ rashi, rashiFallbackToOnkelos: true }, 'rashi');
    expect(screen.queryByText('No Rashi here — Targum instead:')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rashi 1 1:1' })).toBeInTheDocument();
  });

  it('shows a loading hint while Rashi is fetched', () => {
    setup({ expanded: true, rashiLoading: true });
    expect(screen.getByText(/Loading/u)).toBeInTheDocument();
  });

  it('uses Rashi as the third reading when configured', () => {
    setup({ rashi }, 'rashi');
    // Rashi has no tap-the-text control — it holds its own English disclosure,
    // so its dot is the way to mark it read.
    expect(screen.getByRole('button', { name: 'Rashi 1 1:1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Onkelos 1:1' })).not.toBeInTheDocument();
    expect(screen.getByText(/אָמַר רַבִּי/u)).toBeInTheDocument();
  });

  it('offers both Onkelos and Rashi when configured', () => {
    setup({ rashi }, 'both');
    expect(screen.getByRole('button', { name: 'Onkelos 1:1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rashi 1 1:1' })).toBeInTheDocument();
  });

  it('does not nest interactive controls inside a tap target', () => {
    setup({ rashi }, 'rashi');
    for (const button of screen.getAllByRole('button')) {
      expect(button.querySelector('button')).toBeNull();
    }
  });

  it('exposes expansion state to assistive technology', async () => {
    const user = userEvent.setup();
    const props = setup();
    const toggle = screen.getByRole('button', { name: /Show Rashi and translation/u });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(props.onToggleExpand).toHaveBeenCalled();
  });
});
