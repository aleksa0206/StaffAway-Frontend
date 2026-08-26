import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('toApiError', () => {
  it('rephrases known backend messages', () => {
    const error = toApiError(httpError(401, { error: 'Invalid email or password' }));
    expect(error.kind).toBe('unauthorized');
    expect(error.message).toBe('Incorrect email or password.');
  });

  it('keeps the number of days from the minimum notice message', () => {
    const error = toApiError(
      httpError(409, { error: 'Leave requests must be submitted at least 3 day(s) in advance' }),
    );
    expect(error.message).toBe('Requests must be submitted at least 3 day(s) in advance.');
  });

  it('falls back to the default message for the error kind on unknown messages', () => {
    expect(toApiError(httpError(403, { error: 'Something internal' })).message).toBe(
      "You don't have permission to do this.",
    );
  });

  it('never shows the server message for a 500', () => {
    const error = toApiError(httpError(500, { error: 'Invalid email or password' }));
    expect(error.kind).toBe('server');
    expect(error.message).toBe('Something went wrong on the server. Please try again later.');
  });

  it('treats status 0 as a network error', () => {
    expect(toApiError(httpError(0)).kind).toBe('network');
  });

  it('passes per-field validation errors through', () => {
    const error = toApiError(
      httpError(400, { error: 'endDate: x', details: [{ path: 'endDate', message: 'x' }] }),
    );
    expect(error.kind).toBe('validation');
    expect(error.fieldErrors).toEqual([{ path: 'endDate', message: 'x' }]);
  });

  it('ignores details of an unexpected shape', () => {
    expect(toApiError(httpError(400, { details: 'not an array' })).fieldErrors).toEqual([]);
  });

  it('turns a non-HTTP error into a generic server error', () => {
    expect(toApiError(new Error('boom')).kind).toBe('server');
  });
});
