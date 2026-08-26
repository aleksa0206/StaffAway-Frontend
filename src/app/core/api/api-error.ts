import { HttpErrorResponse } from '@angular/common/http';

export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'locked'
  | 'rateLimited'
  | 'network'
  | 'server';

export interface FieldError {
  path: string;
  message: string;
}

/** Normalized error: `message` is always safe to show to the user, with no internal details. */
export class ApiError {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    readonly message: string,
    readonly fieldErrors: FieldError[] = [],
  ) {}
}

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  validation: 'Some of the data is invalid. Check the highlighted fields.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have permission to do this.",
  notFound: 'The requested item does not exist or has been deleted.',
  conflict: "This action isn't possible in the current state of the data.",
  locked: 'The account is temporarily locked.',
  rateLimited: 'Too many requests. Wait a few minutes and try again.',
  network: "The server can't be reached. Check your connection and try again.",
  server: 'Something went wrong on the server. Please try again later.',
};

// Backend messages are written for developers (e.g. "LeaveBalance not found"); the ones users
// actually run into are rephrased here. Unknown messages fall back to the default for the kind.
const KNOWN_MESSAGES: ReadonlyArray<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
  [/^Invalid email or password$/, 'Incorrect email or password.'],
  [
    /locked/i,
    'The account is temporarily locked after too many failed attempts. Try again in 15 minutes.',
  ],
  [/^Invalid two-factor code$/, 'The code is incorrect. Check your authenticator app.'],
  [/temporary token/i, 'The sign-in has expired. Enter your email and password again.'],
  [/reset token/i, 'The password reset link is invalid or has expired. Request a new one.'],
  [/overlaps with an existing request/, 'This request overlaps an existing leave request.'],
  [
    /at least (\d+) day\(s\) in advance/,
    (m) => `Requests must be submitted at least ${m[1]} day(s) in advance.`,
  ],
  [/totalDays .* cannot exceed/, 'The number of days exceeds the selected period.'],
  [/^Only pending leave requests can be edited$/, 'Only pending requests can be edited.'],
  [/^Only pending leave requests can be deleted$/, 'Only pending requests can be withdrawn.'],
  [/own leave request/, "You can't decide on your own request."],
  [/direct reports/, 'You can only decide on requests from your direct reports.'],
  [
    /^LeaveBalance not found$/,
    'The employee has no balance for this leave type in that year. Hr needs to add it first.',
  ],
  [/already exists/, 'A record with this value already exists.'],
  [/referenced by other records/, "This can't be deleted because related data exists."],
  [/^Too many/, DEFAULT_MESSAGES.rateLimited],
];

function kindFromStatus(status: number): ApiErrorKind {
  switch (status) {
    case 0:
      return 'network';
    case 400:
    case 413:
      return 'validation';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    case 409:
      return 'conflict';
    case 423:
      return 'locked';
    case 429:
      return 'rateLimited';
    default:
      return 'server';
  }
}

function userMessage(backendMessage: unknown, kind: ApiErrorKind): string {
  if (typeof backendMessage === 'string' && kind !== 'server') {
    for (const [pattern, replacement] of KNOWN_MESSAGES) {
      const match = backendMessage.match(pattern);
      if (match) {
        return typeof replacement === 'string' ? replacement : replacement(match);
      }
    }
  }
  return DEFAULT_MESSAGES[kind];
}

function isFieldErrorList(value: unknown): value is FieldError[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item?.path === 'string' && typeof item?.message === 'string')
  );
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError('server', -1, DEFAULT_MESSAGES.server);
  }

  const kind = kindFromStatus(error.status);
  const body: unknown = error.error;
  const backendMessage =
    typeof body === 'object' && body !== null ? Reflect.get(body, 'error') : undefined;
  const details =
    typeof body === 'object' && body !== null ? Reflect.get(body, 'details') : undefined;

  return new ApiError(
    kind,
    error.status,
    userMessage(backendMessage, kind),
    isFieldErrorList(details) ? details : [],
  );
}
