export const apiIdentity = { account: null, csrf: null };

export async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiIdentity.account
        ? { 'X-Queryroom-Account': apiIdentity.account, 'X-Queryroom-CSRF': apiIdentity.csrf }
        : {}),
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error || 'Could not connect to the workspace server.'), {
      status: response.status,
    });
  return data;
}
