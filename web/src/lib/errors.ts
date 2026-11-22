import { ApiError, UserError } from './apiError';

export interface ErrorInfo {
  title: string; // short headline
  message: string; // what happened, in plain words
  fields: { field: string; messages: string[] }[]; // per-field problems (validation)
  hints: string[]; // what the person can try
  technical: string[]; // for support: status, code, reference
}

const words = (key: string) => {
  const last = key.split('.').filter((p) => Number.isNaN(Number(p))).pop() ?? key;
  const spaced = last.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

function fieldErrorsOf(details: unknown): ErrorInfo['fields'] {
  const fe = (details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
  if (!fe || typeof fe !== 'object') return [];
  return Object.entries(fe).map(([field, messages]) => ({ field: words(field), messages: Array.isArray(messages) ? messages : [String(messages)] }));
}

/** One place that turns any thrown value into something a person can act on. */
export function describeError(err: unknown): ErrorInfo {
  const base: ErrorInfo = { title: 'Something went wrong', message: 'An unexpected problem occurred.', fields: [], hints: [], technical: [] };

  if (err instanceof UserError) return { ...base, title: 'Please check your entry', message: err.message };

  if (!(err instanceof ApiError)) {
    return { ...base, message: err instanceof Error && err.message ? err.message : base.message };
  }

  const technical = [
    `Status: ${err.status || 'no response'}`,
    err.code ? `Code: ${err.code}` : '',
    err.requestId ? `Reference: ${err.requestId}` : '',
    err.url ? `Request: ${err.url}` : '',
  ].filter(Boolean);
  const reference = err.requestId ? ` Quote reference ${err.requestId} when you report it.` : '';

  if (err.code === 'NETWORK') {
    return {
      ...base, technical,
      title: 'Can’t reach the server',
      message: 'The request did not get a response.',
      hints: [
        'The server may be waking up after being idle (free hosting sleeps). Wait up to a minute and try again.',
        'Check your internet connection.',
        'If it keeps failing, the site’s API address or allowed website setting is probably wrong. Tell the administrator.',
      ],
    };
  }
  if (err.code === 'TIMEOUT') {
    return { ...base, technical, title: 'The server took too long to answer', message: 'No reply arrived in time.', hints: ['Try again in a moment. The server may still be starting up.'] };
  }

  switch (true) {
    case err.code === 'INVALID_CREDENTIALS':
      return { ...base, technical, title: 'Sign-in failed', message: err.message, hints: ['Check the email and password. Ask an administrator to reset your password if you have forgotten it.'] };
    case err.status === 400 && err.code === 'VALIDATION_FAILED': {
      const fields = fieldErrorsOf(err.details);
      return { ...base, technical, fields, title: 'Some details need fixing', message: fields.length ? 'Please correct the following:' : err.message };
    }
    case err.status === 400:
      return { ...base, technical, title: 'That request could not be processed', message: err.message };
    case err.status === 401:
      return { ...base, technical, title: 'Please sign in again', message: err.message, hints: ['Your session may have expired.'] };
    case err.status === 403:
      return { ...base, technical, title: 'You can’t do that', message: err.message };
    case err.status === 404:
      return { ...base, technical, title: 'Not found', message: err.message };
    case err.status === 409:
      return { ...base, technical, title: 'This can’t be done right now', message: err.message };
    case err.status === 413:
      return { ...base, technical, title: 'Too much data', message: err.message };
    case err.status === 429:
      return { ...base, technical, title: 'Too many attempts', message: err.message, hints: ['Wait a few minutes before trying again.'] };
    case err.status === 502 || err.status === 503 || err.status === 504:
      return { ...base, technical, title: 'The server is temporarily unavailable', message: 'It may be starting up or being updated.', hints: ['Wait a minute and try again.'] };
    case err.status >= 500:
      return { ...base, technical, title: 'Something went wrong on our side', message: `${err.message}${reference}`, hints: ['Try again in a moment.'] };
    default:
      return { ...base, technical, message: err.message };
  }
}
