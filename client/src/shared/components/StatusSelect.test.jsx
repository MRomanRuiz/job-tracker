import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusSelect from './StatusSelect';

describe('StatusSelect', () => {
  it('shows all configured statuses when no transitions are provided', () => {
    const onChange = vi.fn();

    render(
      <StatusSelect
        value="pending"
        statuses={['pending', 'interview']}
        labels={{ pending: 'Pending', interview: 'Interview' }}
        onChange={onChange}
      />,
    );

    const select = screen.getByRole('combobox');
    expect(Array.from(select.options).map(option => option.value)).toEqual([
      'pending',
      'interview',
    ]);
    expect(select.disabled).toBe(false);

    fireEvent.change(select, { target: { value: 'interview' } });
    expect(onChange).toHaveBeenCalledWith('interview');
  });

  it('keeps suspended records from returning to pending when transitions are absent', () => {
    render(
      <StatusSelect
        value="suspended"
        statuses={['pending', 'interview']}
        labels={{ interview: 'Interview', suspended: 'Suspended' }}
        onChange={vi.fn()}
      />,
    );

    expect(Array.from(screen.getByRole('combobox').options).map(option => option.value)).toEqual([
      'interview',
      'suspended',
    ]);
  });

  it('filters transition options and allows selecting an allowed status', () => {
    const onChange = vi.fn();

    render(
      <StatusSelect
        value="pending"
        statuses={['pending', 'interview']}
        labels={{ pending: 'Pending', interview: 'Interview' }}
        transitions={{ pending: ['interview', 'unknown'] }}
        onChange={onChange}
      />,
    );

    const select = screen.getByRole('combobox');
    expect(Array.from(select.options).map(option => option.value)).toEqual([
      'pending',
      'interview',
    ]);
    expect(select.options[0].hidden).toBe(true);
    expect(select.disabled).toBe(false);

    fireEvent.change(select, { target: { value: 'interview' } });
    expect(onChange).toHaveBeenCalledWith('interview');
  });

  it('disables the select and falls back to the current value for unknown transitions', () => {
    render(
      <StatusSelect
        value="legacy"
        statuses={['pending']}
        labels={{}}
        transitions={{}}
        onChange={vi.fn()}
      />,
    );

    const select = screen.getByRole('combobox');
    expect(select.disabled).toBe(true);
    expect(select.options[0].textContent).toBe('legacy');
    expect(select.options[0].hidden).toBe(false);
    expect(select.options[0].disabled).toBe(true);
    expect(select.options).toHaveLength(1);
  });
});
