import { describe, expect, it } from 'vitest';
import {
  curlSample,
  exampleOf,
  getOperations,
  propertiesOf,
  typeName,
} from '../src/openapi/model';
import { dereference } from '../src/openapi/spec';
import type { OpenApiDocument, SchemaObject } from '../src/openapi/spec';

const document = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  dereference({ openapi: '3.1.0', paths, ...extra }) as OpenApiDocument;

describe('dereference', () => {
  it('replaces internal references', () => {
    const resolved = dereference({
      paths: { '/pets': { get: { responses: { '200': { $ref: '#/components/responses/Ok' } } } } },
      components: { responses: { Ok: { description: 'Fine' } } },
    }) as Record<string, any>;

    expect(resolved.paths['/pets'].get.responses['200'].description).toBe('Fine');
  });

  it('names schemas after the component they come from', () => {
    const resolved = dereference({
      paths: { '/pets': { get: { parameters: [{ schema: { $ref: '#/components/schemas/Pet' } }] } } },
      components: { schemas: { Pet: { type: 'object' } } },
    }) as Record<string, any>;

    expect(resolved.paths['/pets'].get.parameters[0].schema.title).toBe('Pet');
  });

  it('keeps a self-referencing schema finite', () => {
    const resolved = dereference({
      components: {
        schemas: {
          Node: {
            type: 'object',
            properties: { child: { $ref: '#/components/schemas/Node' } },
          },
        },
      },
    }) as Record<string, any>;

    const node = resolved.components.schemas.Node;
    expect(node.properties.child).toBe(node);
  });

  it('refuses references to another file', () => {
    expect(() => dereference({ a: { $ref: './other.yaml#/Pet' } })).toThrow(/single file/);
  });

  it('reports a reference that points nowhere', () => {
    expect(() => dereference({ a: { $ref: '#/components/schemas/Missing' } })).toThrow(/Unresolved/);
  });
});

describe('getOperations', () => {
  const spec = document({
    '/rockets': {
      parameters: [{ name: 'trace', in: 'header' }],
      get: { operationId: 'list', tags: ['Rockets'] },
      post: { operationId: 'create' },
    },
    '/launches': { get: { operationId: 'launches', tags: ['Launches'] } },
  });

  it('lists every operation', () => {
    expect(getOperations(spec).map((operation) => operation.id)).toEqual([
      'list',
      'create',
      'launches',
    ]);
  });

  it('filters by path, method and tag', () => {
    expect(getOperations(spec, { path: '/rockets', method: 'post' })[0]?.id).toBe('create');
    expect(getOperations(spec, { tag: 'Launches' })[0]?.id).toBe('launches');
  });

  it('gives path parameters to every operation of the path', () => {
    expect(getOperations(spec, { path: '/rockets' })[0]?.parameters[0]?.name).toBe('trace');
  });

  it('lets an operation override a path parameter', () => {
    const overridden = document({
      '/rockets': {
        parameters: [{ name: 'limit', in: 'query', description: 'shared' }],
        get: { parameters: [{ name: 'limit', in: 'query', description: 'own' }] },
      },
    });
    const { parameters } = getOperations(overridden)[0]!;
    expect(parameters).toHaveLength(1);
    expect(parameters[0]?.description).toBe('own');
  });

  it('falls back to an id built from the method and path', () => {
    expect(getOperations(document({ '/rockets': { get: {} } }))[0]?.id).toBe('get-/rockets');
  });

  it('resolves security schemes of the document', () => {
    const secured = document(
      { '/rockets': { get: {} } },
      {
        security: [{ bearerAuth: [] }],
        components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
      },
    );
    expect(getOperations(secured)[0]?.security[0]?.scheme.scheme).toBe('bearer');
  });
});

describe('propertiesOf', () => {
  it('merges allOf branches and keeps required flags', () => {
    const schema: SchemaObject = {
      allOf: [
        { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
        { type: 'object', properties: { detail: { type: 'string' } } },
      ],
    };
    expect(propertiesOf(schema)).toEqual([
      { name: 'code', schema: { type: 'string' }, required: true },
      { name: 'detail', schema: { type: 'string' }, required: false },
    ]);
  });
});

describe('typeName', () => {
  it('names arrays after their items', () => {
    expect(typeName({ type: 'array', items: { type: 'string' } })).toBe('string[]');
  });

  it('uses the schema title for objects', () => {
    expect(typeName({ type: 'object', title: 'Rocket' })).toBe('Rocket');
  });

  it('shows the format and nullability', () => {
    expect(typeName({ type: 'integer', format: 'int64' })).toBe('integer<int64>');
    expect(typeName({ type: ['string', 'null'] })).toBe('string | null');
  });

  it('lists enum values, capped', () => {
    expect(typeName({ enum: ['a', 'b'] })).toBe('"a" | "b"');
    expect(typeName({ enum: [1, 2, 3, 4, 5] })).toBe('1 | 2 | 3 | 4 | …');
  });
});

describe('exampleOf', () => {
  it('prefers the declared example, then the default, then the first enum value', () => {
    expect(exampleOf({ type: 'string', example: 'given' })).toBe('given');
    expect(exampleOf({ type: 'integer', default: 7 })).toBe(7);
    expect(exampleOf({ type: 'string', enum: ['design', 'flying'] })).toBe('design');
  });

  it('builds an object from its properties', () => {
    expect(
      exampleOf({
        type: 'object',
        properties: { name: { type: 'string' }, count: { type: 'integer' } },
      }),
    ).toEqual({ name: 'string', count: 0 });
  });

  it('terminates on a cyclic schema', () => {
    const node: SchemaObject = { type: 'object', properties: {} };
    node.properties!.child = node;
    expect(exampleOf(node)).toEqual({ child: null });
  });
});

describe('curlSample', () => {
  const spec = document(
    {
      '/rockets/{rocketId}': {
        get: {
          parameters: [
            { name: 'rocketId', in: 'path', required: true, schema: { type: 'string' }, example: 'r1' },
            { name: 'expand', in: 'query', required: true, schema: { type: 'string', example: 'stages' } },
          ],
        },
      },
    },
    {
      servers: [{ url: 'https://api.example/v1' }],
      security: [{ bearerAuth: [] }],
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    },
  );

  it('fills path parameters and required query parameters', () => {
    const sample = curlSample(getOperations(spec)[0]!, 'https://api.example/v1');
    expect(sample).toContain("curl -X GET 'https://api.example/v1/rockets/r1?expand=stages'");
  });

  it('adds the authorization header', () => {
    expect(curlSample(getOperations(spec)[0]!)).toContain("-H 'Authorization: Bearer $TOKEN'");
  });
});
