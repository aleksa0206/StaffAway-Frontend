import { Holiday } from '../../core/api/models';
import { countWorkingDays } from './working-days';

function holiday(date: string, isRecurring: boolean): Holiday {
  return { id: 1, name: 'Holiday', date: `${date}T00:00:00.000Z`, isRecurring };
}

describe('countWorkingDays', () => {
  it('counts working days inclusively, without weekends', () => {
    // 2027-06-07 is a Monday, 2027-06-13 a Sunday.
    expect(countWorkingDays('2027-06-07', '2027-06-13', [])).toBe(5);
  });

  it('a one-day request on a weekday is one day', () => {
    expect(countWorkingDays('2027-06-09', '2027-06-09', [])).toBe(1);
  });

  it('a weekend only gives 0', () => {
    expect(countWorkingDays('2027-06-12', '2027-06-13', [])).toBe(0);
  });

  it('excludes a one-off holiday only in its year', () => {
    const holidays = [holiday('2027-06-08', false)];
    expect(countWorkingDays('2027-06-07', '2027-06-11', holidays)).toBe(4);
    expect(countWorkingDays('2028-06-06', '2028-06-09', holidays)).toBe(4);
  });

  it('excludes a recurring holiday in every year', () => {
    // 2027-01-01 is a Friday; the recurring holiday is defined with a different year.
    expect(countWorkingDays('2027-01-01', '2027-01-01', [holiday('2020-01-01', true)])).toBe(0);
  });

  it('a reversed or invalid range gives 0', () => {
    expect(countWorkingDays('2027-06-10', '2027-06-01', [])).toBe(0);
    expect(countWorkingDays('', '2027-06-01', [])).toBe(0);
  });
});
