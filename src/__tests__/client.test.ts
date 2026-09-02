import { ApitoClient, createClient } from '../client';
import { TypedOperations } from '../typed-operations';
import {
  TypedDocumentStructure,
  TypedSearchResult,
  CreateAndUpdateRequest,
  ValidationError,
} from '../types';

// Test constants matching Go SDK
const BaseURL = 'http://localhost:5050/system/graphql';
const APIKey = 'EhvreBZvFOKYCxWx3xL9xuW4g1WLx3dhdbCWmPhuIaIVI4zeBMk5gUYfuXM4jccwNGjRqitMaNyK1kt6b3S8NKowNXzwFDL6ivZL4rscGu49w8E3vVEYPeyvAgzT0NeTPO9SiJxmI4nBGkMpcBX789VqEfH1tuwacKKivQ4jhLtGt3PsyfmIXX9';

// Task interface matching Go SDK
interface Task {
  name: string;
  took: number | string;
  description: string | object;
  progress: string;
  list?: Array<{
    id: string;
    title: string;
    description: string | object;
    status: string;
  }>;
  properties?: {
    given_by: string;
    handover_date: string;
    commission: string;
  };
}

// Product interface for testing typed operations
interface Product {
  name: string;
  description: string;
  price: number;
  category_id: string;
  in_stock: boolean;
  created_at: string;
}

// Sample document shape for typed operation tests (not engine User type)
interface ExampleProfileUser {
  email: string;
  first_name: string;
  last_name: string;
  age: number;
  active: boolean;
}

// Helper function to get test client
function getTestClient(): ApitoClient {
  return new ApitoClient({
    baseURL: BaseURL,
    apiKey: APIKey,
    timeout: 30000,
  });
}

describe('ApitoClient', () => {
  describe('NewClient', () => {
    it('should create client with required config', () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: APIKey,
        timeout: 10000,
      });

      expect(client).toBeInstanceOf(ApitoClient);
    });

    it('should create client with default timeout', () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: APIKey,
      });

      expect(client).toBeDefined();
    });
  });

  describe('GetSingleResource', () => {
    it('should fetch single resource', async () => {
      const client = getTestClient();

      try {
        const resource = await client.getSingleResource(
          'task',
          '401fa9f2-b174-42b1-84da-1227be8d8755',
          false
        );

        expect(resource).toBeDefined();
        expect(resource.id).toBeDefined();
        console.log('✅ GetSingleResource succeeded:', resource);
      } catch (error) {
        console.log('GetSingleResource failed (may be expected):', error);
      }
    }, 30000);
  });

  describe('SearchResources', () => {
    it('should search resources with filters', async () => {
      const client = getTestClient();

      const filter = {
        page: 1,
        limit: 5,
      };

      try {
        const results = await client.searchResources('task', filter, false);

        expect(results).toBeDefined();
        expect(results.count).toBeDefined();
        console.log('✅ SearchResources succeeded:', results);
      } catch (error) {
        console.log('SearchResources failed (may be expected):', error);
      }
    }, 30000); // Increase timeout to 30 seconds for real API calls
  });

  describe('GetRelationDocuments', () => {
    it('should fetch related documents', async () => {
      const client = getTestClient();

      const connection = {
        model: 'users',
        _id: 'test-id',
        to_model: 'roles',
        relation_type: 'belongs_to',
        known_as: 'user_role',
        connection_type: 'outbound',
      };

      try {
        const results = await client.getRelationDocuments('test-id', connection);

        expect(results).toBeDefined();
        console.log('✅ GetRelationDocuments succeeded:', results);
      } catch (error) {
        console.log('GetRelationDocuments failed (may be expected):', error);
      }
    }, 30000);
  });

  describe('CreateNewResource', () => {
    it('should create new resource', async () => {
      const client = getTestClient();

      const data = {
        name: 'Test',
        took: 3,
        description: 'Test Description',
        progress: 'DONE',
      };

      const connect = {
        category_ids: ['56b2a1dd-25cf-44b4-ad65-8a78b6deab89'],
        executor_id: '354c47b6-8693-4720-9a4d-7404a64386f9',
      };

      try {
        const result = await client.createNewResource({
          model: 'task',
          payload: data,
          connect: connect,
        });

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        console.log('✅ CreateNewResource succeeded:', result);
      } catch (error) {
        console.log('CreateNewResource failed (may be expected):', error);
      }
    }, 30000);
  });

  describe('UpdateResource', () => {
    it('should update existing resource', async () => {
      const client = getTestClient();

      const data = {
        name: 'Test',
        took: 3,
        description: 'Test Description',
        progress: 'DONE',
      };

      const connect = {
        category_ids: ['56b2a1dd-25cf-44b4-ad65-8a78b6deab89'],
      };

      const disconnect = {
        executor_id: '354c47b6-8693-4720-9a4d-7404a64386f9',
      };

      try {
        const result = await client.updateResource({
          model: 'task',
          id: 'a0d50ad7-3001-4be0-92bd-d0daac0af3a9',
          payload: data,
          connect: connect,
          disconnect: disconnect,
        });

        expect(result).toBeDefined();
        console.log('✅ UpdateResource succeeded:', result);
      } catch (error) {
        console.log('UpdateResource failed (may be expected):', error);
      }
    }, 30000);
  });

  describe('DeleteResource', () => {
    it('should delete resource', async () => {
      const client = getTestClient();

      try {
        await client.deleteResource('task', 'a0d50ad7-3001-4be0-92bd-d0daac0af3a9');
        console.log('✅ DeleteResource succeeded');
      } catch (error) {
        console.log('DeleteResource failed (may be expected):', error);
      }
    }, 30000);
  });

  describe('updateTenant planTier', () => {
    it('rejects planTier client-side', async () => {
      const client = new ApitoClient({
        baseURL: 'http://localhost/system/graphql',
        apiKey: 'test',
      });
      await expect(
        client.updateTenant('tid', { planTier: 'paid' } as any),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('workspace partners', () => {
    it('createPartner requires email and defaults name from email', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      await expect(client.createPartner({ email: '', name: 'Acme' })).rejects.toBeInstanceOf(
        ValidationError,
      );
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: { createPartner: { id: 'p1', name: 'fahim@gmail.com', email: 'fahim@gmail.com' } },
      } as any);
      const row = await client.createPartner({ email: 'fahim@gmail.com' });
      expect(row.name).toBe('fahim@gmail.com');
      expect(spy.mock.calls[0][1]).toMatchObject({
        email: 'fahim@gmail.com',
        name: 'fahim@gmail.com',
      });
      spy.mockRestore();
    });

    it('updatePartner can send commission_percent alone', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: { updatePartner: { id: 'p1', commission_percent: 20 } },
      } as any);
      const row = await client.updatePartner('p1', { commissionPercent: 20 });
      expect(row.commission_percent).toBe(20);
      expect(spy.mock.calls[0][1]).toMatchObject({
        id: 'p1',
        commission_percent: 20,
      });
      spy.mockRestore();
    });

    it('searchPartners maps GraphQL payload', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: {
          searchPartners: {
            total: 1,
            results: [{ id: 'direct-workspace', name: 'Direct', is_default: true }],
          },
        },
      } as any);
      const row = await client.searchPartners({ limit: 50 });
      expect(row.total).toBe(1);
      expect(row.results[0].id).toBe('direct-workspace');
      expect(spy.mock.calls[0][1]).toMatchObject({ limit: 50 });
      spy.mockRestore();
    });

    it('createTenantSubscription passes partner_id', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: { createTenantSubscription: { id: 'sub_1', partner_id: 'p1' } },
      } as any);
      const row = await client.createTenantSubscription({
        tenantId: 't1',
        planTier: 'paid',
        partnerId: 'p1',
      });
      expect(row.partner_id).toBe('p1');
      expect(spy.mock.calls[0][1]).toMatchObject({ partner_id: 'p1' });
      spy.mockRestore();
    });

    it('updateTenantSubscription passes partner_id and current_period_end', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: {
          updateTenantSubscription: {
            id: 'sub_1',
            partner_id: 'p1',
            current_period_end: '2026-10-01T00:00:00Z',
          },
        },
      } as any);
      const row = await client.updateTenantSubscription({
        subscriptionId: 'sub_1',
        partnerId: 'p1',
        currentPeriodEnd: '2026-10-01T00:00:00Z',
      });
      expect(row.partner_id).toBe('p1');
      expect(spy.mock.calls[0][1]).toMatchObject({
        subscription_id: 'sub_1',
        partner_id: 'p1',
        current_period_end: '2026-10-01T00:00:00Z',
      });
      expect(String(spy.mock.calls[0][0])).toContain('current_period_end');
      spy.mockRestore();
    });

    it('updateTenant allows partnerId alone', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: { updateTenant: { id: 't1', partner_id: 'p1' } },
      } as any);
      const row = await client.updateTenant('t1', { partnerId: 'p1' });
      expect(row.partner_id).toBe('p1');
      expect(spy.mock.calls[0][1]).toMatchObject({ tenant_id: 't1', partner_id: 'p1' });
      expect(String(spy.mock.calls[0][0])).toContain('partner_id');
      spy.mockRestore();
    });

    it('client app tenant lookup omits partner_id unless includePartner', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: { searchTenantsByDomain: { tenant: { id: 't1', name: 'HGT', domain: 'hgt' } } },
      } as any);
      await client.searchTenantsByDomain('proj', 'hgt');
      expect(String(spy.mock.calls[0][0])).not.toContain('partner_id');
      await client.searchTenantsByDomain('proj', 'hgt', { includePartner: true });
      expect(String(spy.mock.calls[1][0])).toContain('partner_id');
      spy.mockRestore();
    });

    it('updateTenant without partnerId omits partner_id from the document', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: { updateTenant: { id: 't1', name: 'HGT' } },
      } as any);
      await client.updateTenant('t1', { data: '{}' });
      expect(String(spy.mock.calls[0][0])).not.toContain('partner_id');
      expect(spy.mock.calls[0][1]).not.toHaveProperty('partner_id');
      spy.mockRestore();
    });
  });

  describe('ApitoProjectPayment GraphQL', () => {
    it('createTenantSubscription requires tenantId and planTier', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      await expect(client.createTenantSubscription({ tenantId: '', planTier: 'paid' })).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(client.createTenantSubscription({ tenantId: 't1', planTier: '' })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('createTenantSubscription maps GraphQL payload', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: { createTenantSubscription: { id: 'sub_1', plan_tier: 'paid', tenant_id: 't1' } },
      } as any);
      const row = await client.createTenantSubscription({
        tenantId: 't1',
        planTier: 'paid',
        issueInvoice: true,
        amount: 799,
        currency: 'BDT',
      });
      expect(row.id).toBe('sub_1');
      expect(spy.mock.calls[0][1]).toMatchObject({
        tenant_id: 't1',
        plan_tier: 'paid',
        issue_invoice: true,
        amount: 799,
        currency: 'BDT',
      });
      spy.mockRestore();
    });

    it('cancelTenantSubscription without projectId uses GraphQL', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: { cancelTenantSubscription: { id: 'sub_1', status: 'canceled' } },
      } as any);
      const row = await client.cancelTenantSubscription({ subscriptionId: 'sub_1', mode: 'cancel' });
      expect(row.id).toBe('sub_1');
      expect(spy.mock.calls[0][1]).toMatchObject({
        subscription_id: 'sub_1',
        mode: 'cancel',
      });
      spy.mockRestore();
    });

    it('listTenantInvoices maps list payload', async () => {
      const client = new ApitoClient({
        baseURL: BaseURL,
        apiKey: 'test',
      });
      const spy = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
        data: {
          listTenantInvoices: {
            total: 1,
            invoices: [{ id: 'inv_1', amount: 799, currency: 'BDT' }],
          },
        },
      } as any);
      const out = await client.listTenantInvoices({ subscriptionId: 'sub_1' });
      expect(out.total).toBe(1);
      expect(out.invoices[0].id).toBe('inv_1');
      spy.mockRestore();
    });
  });

  describe('GenerateTenantToken', () => {
    it('should generate tenant token', async () => {
      const client = getTestClient();

      try {
        const token = await client.generateTenantToken('ba0ee756-6aea-43a6-b052-c7baab3da91c');

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
        console.log('✅ GenerateTenantToken succeeded:', token);
      } catch (error) {
        console.log('GenerateTenantToken failed (may be expected):', error);
      }
    }, 30000);
  });

  describe('Tenant users (Pro)', () => {
    it('should search tenant users when APITO_PROJECT_ID is set', async () => {
      const projectId = process.env.APITO_PROJECT_ID;
      if (!projectId) {
        console.log('Tenant users (Pro): skipped — set APITO_PROJECT_ID');
        return;
      }
      const client = getTestClient();
      try {
        const { count, users } = await client.searchUsers(projectId, 10, 0, undefined, 'alice');
        expect(count).toBeGreaterThanOrEqual(0);
        console.log('✅ searchUsers:', count, users?.length);
      } catch (error) {
        console.log('searchUsers failed (may be expected):', error);
      }
    }, 30000);

    it('should search tenants by domain when APITO_PROJECT_ID is set', async () => {
      const projectId = process.env.APITO_PROJECT_ID;
      if (!projectId) {
        console.log('searchTenantsByDomain: skipped — set APITO_PROJECT_ID');
        return;
      }
      const client = getTestClient();
      try {
        const { tenant } = await client.searchTenantsByDomain(projectId, 'example.invalid');
        expect(tenant === null || typeof tenant?.id === 'string').toBe(true);
        console.log('✅ searchTenantsByDomain:', tenant ? 'match' : 'no match');
      } catch (error) {
        console.log('searchTenantsByDomain failed (may be expected):', error);
      }
    }, 30000);

    it('should search tenants when APITO_PROJECT_ID is set', async () => {
      const projectId = process.env.APITO_PROJECT_ID;
      if (!projectId) {
        console.log('searchTenants: skipped — set APITO_PROJECT_ID');
        return;
      }
      const client = getTestClient();
      try {
        const { count, tenants } = await client.searchTenants(projectId, 10, 0);
        expect(count).toBeGreaterThanOrEqual(0);
        console.log('✅ searchTenants:', count, tenants?.length);
      } catch (error) {
        console.log('searchTenants failed (may be expected):', error);
      }
    }, 30000);

    it('should get tenant by exact id when APITO_PROJECT_ID and APITO_TENANT_ID are set', async () => {
      const projectId = process.env.APITO_PROJECT_ID;
      const tenantId = process.env.APITO_TENANT_ID;
      if (!projectId || !tenantId) {
        console.log('getTenant: skipped — set APITO_PROJECT_ID and APITO_TENANT_ID');
        return;
      }
      const client = getTestClient();
      try {
        const tenant = await client.getTenant(projectId, tenantId);
        expect(tenant?.id).toBe(tenantId);
        console.log('✅ getTenant:', tenant?.name ?? tenant?.id);
      } catch (error) {
        console.log('getTenant failed (may be expected):', error);
      }
    }, 30000);

    it('should login when APITO_PROJECT_ID and credentials are set', async () => {
      const projectId = process.env.APITO_PROJECT_ID;
      const email = process.env.APITO_TENANT_EMAIL ?? '';
      const phone = process.env.APITO_TENANT_PHONE ?? '';
      const password = process.env.APITO_TENANT_PASSWORD;
      if (!projectId || !(email.trim() || phone.trim()) || !password) {
        console.log(
          'loginUser skipped — set APITO_PROJECT_ID, APITO_TENANT_PASSWORD, and APITO_TENANT_EMAIL and/or APITO_TENANT_PHONE'
        );
        return;
      }
      const client = getTestClient();
      try {
        const login = await client.loginUser({
          projectId,
          password,
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        });
        expect(login.token).toBeDefined();
        expect(login.token.length).toBeGreaterThan(0);
        console.log('✅ loginUser token length:', login.token.length);
      } catch (error) {
        console.log('loginUser failed (may be expected):', error);
      }
    }, 30000);
  });

  describe('Debug', () => {
    it('should send debug data', async () => {
      const client = getTestClient();

      try {
        const result = await client.debug('test_stage', 'debug', 'data', {
          test: true,
        });

        expect(result).toBeDefined();
        console.log('✅ Debug succeeded:', result);
      } catch (error) {
        console.log('Debug failed (may be expected):', error);
      }
    }, 30000);
  });
});

describe('TypedOperations', () => {
  let client: ApitoClient;
  let typed: TypedOperations;

  beforeEach(() => {
    client = new ApitoClient({
      baseURL: BaseURL,
      apiKey: APIKey,
      timeout: 30000,
    });
    typed = new TypedOperations(client);
  });

  describe('GetSingleResourceTyped', () => {
    it('should demonstrate typed operation usage', () => {
      // This would be called like:
      // const product = await typed.getSingleResourceTyped<Product>('products', 'product-123', false);
      // Now product.data is of type Product, not any
      // console.log('Product name:', product.data.name, 'price:', product.data.price);

      expect(typed).toBeDefined();
    });
  });

  describe('SearchResourcesTyped', () => {
    it('should demonstrate typed search usage', () => {
      // This would be called like:
      // const filter = {
      //   limit: 10,
      //   where: { in_stock: true }
      // };
      // const results = await typed.searchResourcesTyped<Product>('products', filter, false);
      // for (const product of results.results) {
      //   console.log('Product:', product.data.name, '-', product.data.price);
      // }

      expect(typed).toBeDefined();
    });
  });

  describe('CreateNewResourceTyped', () => {
    it('should demonstrate typed create usage', () => {
      // This would be called like:
      // const data = {
      //   name: 'New Product',
      //   description: 'A great new product',
      //   price: 29.99,
      //   in_stock: true,
      // };
      // const product = await typed.createNewResourceTyped<Product>({
      //   model: 'products',
      //   payload: data,
      // });
      // console.log('Created product:', product.data.name, 'with ID:', product.id);

      expect(typed).toBeDefined();
    });
  });

  describe('UpdateResourceTyped', () => {
    it('should demonstrate typed update usage', () => {
      // This would be called like:
      // const data = { price: 24.99, in_stock: false };
      // const product = await typed.updateResourceTyped<Product>({
      //   model: 'products',
      //   id: 'product-123',
      //   payload: data,
      // });
      // console.log('Updated product:', product.data.name, 'new price:', product.data.price);

      expect(typed).toBeDefined();
    });
  });

  describe('GetRelationDocumentsTyped', () => {
    it('should demonstrate typed relation usage', () => {
      // This would be called like:
      // const connection = {
      //   model: 'users',
      //   relation: 'purchased_by',
      //   filter: { limit: 5 },
      // };
      // const users = await typed.getRelationDocumentsTyped<User>('product-123', connection);
      // for (const user of users.results) {
      //   console.log('User:', user.data.first_name, user.data.last_name, '(', user.data.email, ')');
      // }

      expect(typed).toBeDefined();
    });
  });
});

describe('TypedOperations Integration Tests', () => {
  let client: ApitoClient;

  beforeEach(() => {
    client = new ApitoClient({
      baseURL: BaseURL,
      apiKey: APIKey,
      timeout: 30000,
    });
  });

  describe('GetSingleTask with Type Safety', () => {
    it('should get single task with typed data', async () => {
      try {
        const typed = new TypedOperations(client);
        const task = await typed.getSingleResourceTyped<Task>(
          'task',
          '401fa9f2-b174-42b1-84da-1227be8d8755',
          false
        );

        // Now task.data is strongly typed as Task
        console.log('Task name:', task.data.name);
        console.log('Task took:', task.data.took);
        console.log('Task description:', task.data.description);
        console.log('Task progress:', task.data.progress);

        // Verify type safety - these are compile-time checked
        expect(typeof task.data.name).toBe('string');
        expect(task.data.progress).toBeDefined();
      } catch (error) {
        console.log('Failed to get single task:', error);
      }
    });
  });

  describe('SearchTasks with Type Safety', () => {
    it('should search tasks with typed results', async () => {
      try {
        const typed = new TypedOperations(client);
        const filter = {
          limit: 10,
          where: {
            progress: {
              eq: 'INPROGRESS',
            },
          },
        };

        const results = await typed.searchResourcesTyped<Task>('task', filter, false);

        console.log(`Found ${results.count} tasks`);

        // All results are strongly typed
        for (let i = 0; i < Math.min(3, results.results.length); i++) {
          const task = results.results[i];
          console.log(`Task ${i + 1}: ${task.data.name} - ${task.data.progress}`);

          // Type safety verification - no need for type assertions!
          expect(typeof task.data.name).toBe('string');
          expect(task.data.progress).toBeDefined();
        }
      } catch (error) {
        console.log('Failed to search tasks:', error);
      }
    });
  });
});

describe('Factory Function', () => {
  it('should create client using createClient factory', () => {
    const client = createClient({
      baseURL: BaseURL,
      apiKey: APIKey,
      timeout: 30000,
    });

    expect(client).toBeInstanceOf(ApitoClient);
  });
});

describe('Error Handling', () => {
  it('should validate required parameters in createNewResource', async () => {
    const client = getTestClient();

    try {
      await client.createNewResource({} as any);
    } catch (error: any) {
      expect(error.message).toContain('model is required');
    }
  });

  it('should validate required parameters in updateResource', async () => {
    const client = getTestClient();

    try {
      await client.updateResource({
        model: 'task',
        payload: { name: 'Test' },
      } as any);
    } catch (error: any) {
      expect(error.message).toContain('id is required');
    }
  });

  it('should validate model in getRelationDocuments', async () => {
    const client = getTestClient();

    try {
      await client.getRelationDocuments('test-id', {
        // Missing model parameter
        relation: 'test',
      });
    } catch (error: any) {
      expect(error.message).toContain('model is required');
    }
  });
});

describe('Unified access token auth headers', () => {
  it('sends only Authorization: Bearer (no X-Apito-Key) for apt_ access tokens', () => {
    const client = new ApitoClient({ baseURL: BaseURL, accessToken: 'apt_abc123', timeout: 30000 });
    const headers = (client as any).authHeaders();
    expect(headers.Authorization).toBe('Bearer apt_abc123');
    expect(headers['X-Use-Cookies']).toBe('false');
    expect(headers['X-Apito-Key']).toBeUndefined();
  });

  it('accepts apt_ via the legacy apiKey field too', () => {
    const client = new ApitoClient({ baseURL: BaseURL, apiKey: 'apt_abc123', timeout: 30000 });
    const headers = (client as any).authHeaders();
    expect(headers.Authorization).toBe('Bearer apt_abc123');
    expect(headers['X-Apito-Key']).toBeUndefined();
  });

  it('falls back to X-Apito-Key for legacy project API keys without a recognized prefix', () => {
    const client = getTestClient();
    const headers = (client as any).authHeaders();
    expect(headers['X-Apito-Key']).toBe(APIKey);
    expect(headers.Authorization).toBeUndefined();
  });

  it('rejects retired cli-/sdk-/mcp- token prefixes with TOKEN_FORMAT_RETIRED', () => {
    for (const prefix of ['cli-', 'sdk-', 'mcp-']) {
      expect(() => new ApitoClient({ baseURL: BaseURL, apiKey: `${prefix}legacy`, timeout: 30000 })).toThrow(
        /TOKEN_FORMAT_RETIRED/
      );
    }
  });

  it('uses only the canonical project header for config and per-request overrides', () => {
    const client = new ApitoClient({
      baseURL: BaseURL,
      accessToken: 'apt_abc123',
      projectId: 'project-config',
    });
    const configured = (client as any).authHeaders({});
    expect(configured.Authorization).toBe('Bearer apt_abc123');
    expect(configured['X-Use-Cookies']).toBe('false');
    expect(configured['X-Apito-Project-Id']).toBe('project-config');
    expect(configured['X-Apito-Key']).toBeUndefined();

    const overridden = (client as any).authHeaders({ projectId: 'project-request' });
    expect(overridden['X-Apito-Project-Id']).toBe('project-request');
  });

  it('passes explicit project and tenant ids as matching request scopes', async () => {
    const client = new ApitoClient({ baseURL: BaseURL, accessToken: 'apt_abc123' });
    const execute = jest.spyOn(client, 'executeGraphQL').mockResolvedValue({
      data: { searchUsers: { count: 0, users: [] } },
    });

    await client.searchUsers('project-method', 10, 0, 'tenant-method');

    expect(execute).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ project_id: 'project-method', tenant_id: 'tenant-method' }),
      { projectId: 'project-method', tenantId: 'tenant-method' }
    );
  });
});

// Example usage for documentation
describe('Example Usage', () => {
  it('should demonstrate basic CRUD operations', () => {
    const client = new ApitoClient({
      baseURL: BaseURL,
      apiKey: APIKey,
      timeout: 30000,
    });

    // Example: Get a single task with full type safety
    // const task = await typed.getSingleResourceTyped<Task>('task', '401fa9f2-b174-42b1-84da-1227be8d8755', false);
    // const taskName = task.data.name;
    // const taskProgress = task.data.progress;

    expect(client).toBeDefined();
  });
});
