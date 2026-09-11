import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('allows paths inside the app', () => {
    expect(safeReturnUrl('/approvals?status=all')).toBe('/approvals?status=all');
  });

  it.each([undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'requests'])(
    'rejects %s and returns home',
    (value) => {
      expect(safeReturnUrl(value)).toBe('/');
    },
  );
});
