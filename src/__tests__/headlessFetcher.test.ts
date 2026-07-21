import { createBearerApitoFetcher } from '../headless/fetcher';

describe('createBearerApitoFetcher', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends headless auth and optional canonical scopes', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const fetcher = createBearerApitoFetcher({
      graphqlUrl: 'https://example.test/system/graphql',
      token: 'apt_user_token_secret',
      projectId: 'project-1',
      tenantId: 'tenant-1',
    });

    await fetcher('query { ok }');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer apt_user_token_secret');
    expect(headers['X-Use-Cookies']).toBe('false');
    expect(headers['X-Apito-Project-Id']).toBe('project-1');
    expect(headers['X-Apito-Tenant-ID']).toBe('tenant-1');
  });

  it('sends legacy ak_ staff tokens via X-Apito-Key', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const fetcher = createBearerApitoFetcher({
      graphqlUrl: 'https://example.test/secured/graphql',
      token: 'ak_project_user_key',
      projectId: 'project-1',
      tenantId: 'tenant-1',
    });

    await fetcher('query { ok }');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['X-Apito-Key']).toBe('ak_project_user_key');
    expect(headers.Authorization).toBeUndefined();
    expect(headers['X-Apito-Project-Id']).toBe('project-1');
    expect(headers['X-Apito-Tenant-ID']).toBe('tenant-1');
  });
});
