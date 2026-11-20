let unauthorizedHandler = null;

/**
 * Registers a callback invoked when any protected API returns 401 Unauthorized.
 */
export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

/**
 * Wrapper around fetch that enforces same-origin credentials and redirects to login on 401.
 */
export async function apiFetch(url, options = {}) {
  const { skipAuthRedirect = false, ...fetchOptions } = options;
  const res = await fetch(url, {
    ...fetchOptions,
    credentials: 'same-origin',
  });

  if (res.status === 401 && !skipAuthRedirect && typeof unauthorizedHandler === 'function') {
    unauthorizedHandler();
  }

  return res;
}
