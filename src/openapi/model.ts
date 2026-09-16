import type {
  MediaTypeObject,
  OpenApiDocument,
  OperationObject,
  ParameterObject,
  SchemaObject,
  SecuritySchemeObject,
} from './spec';

export const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;

export type Method = (typeof METHODS)[number];

export interface Content {
  type: string;
  schema?: SchemaObject;
  example?: unknown;
}

export interface Operation {
  /** Stable anchor, the `operationId` when the spec has one. */
  id: string;
  method: Uppercase<Method>;
  path: string;
  summary?: string;
  description?: string;
  deprecated: boolean;
  tags: string[];
  /** Base URLs, the operation ones when it overrides the document. */
  servers: string[];
  parameters: ParameterObject[];
  body?: { required: boolean; description?: string; contents: Content[] };
  responses: { status: string; description?: string; contents: Content[] }[];
  security: { name: string; scheme: SecuritySchemeObject; scopes: string[] }[];
}

export interface OperationFilter {
  path?: string;
  method?: string;
  tag?: string;
}

/** Operations of a document, in spec order, narrowed by an optional filter. */
export function getOperations(document: OpenApiDocument, filter: OperationFilter = {}): Operation[] {
  const operations: Operation[] = [];
  const wanted = filter.method?.toLowerCase();

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (filter.path && filter.path !== path) continue;
    for (const method of METHODS) {
      const operation = item[method];
      if (!operation || (wanted && wanted !== method)) continue;
      if (filter.tag && !(operation.tags ?? []).includes(filter.tag)) continue;
      operations.push(toOperation(document, path, method, operation, item.parameters ?? []));
    }
  }

  return operations;
}

function toOperation(
  document: OpenApiDocument,
  path: string,
  method: Method,
  operation: OperationObject,
  shared: ParameterObject[],
): Operation {
  // Operation parameters override the ones declared for the whole path.
  const parameters = [...shared];
  for (const parameter of operation.parameters ?? []) {
    const index = parameters.findIndex((p) => p.name === parameter.name && p.in === parameter.in);
    if (index === -1) parameters.push(parameter);
    else parameters[index] = parameter;
  }

  const servers = (operation.servers ?? document.servers ?? []).map((server) => server.url);
  const requirements = operation.security ?? document.security ?? [];
  const schemes = document.components?.securitySchemes ?? {};

  return {
    id: operation.operationId ?? `${method}-${path}`,
    method: method.toUpperCase() as Uppercase<Method>,
    path,
    summary: operation.summary,
    description: operation.description,
    deprecated: operation.deprecated ?? false,
    tags: operation.tags ?? [],
    servers,
    parameters,
    body: operation.requestBody && {
      required: operation.requestBody.required ?? false,
      description: operation.requestBody.description,
      contents: toContents(operation.requestBody.content),
    },
    responses: Object.entries(operation.responses ?? {}).map(([status, response]) => ({
      status,
      description: response.description,
      contents: toContents(response.content),
    })),
    security: requirements.flatMap((requirement) =>
      Object.entries(requirement).flatMap(([name, scopes]) => {
        const scheme = schemes[name];
        return scheme ? [{ name, scheme, scopes }] : [];
      }),
    ),
  };
}

function toContents(content: Record<string, MediaTypeObject> | undefined): Content[] {
  return Object.entries(content ?? {}).map(([type, media]) => ({
    type,
    schema: media.schema,
    example: media.example ?? Object.values(media.examples ?? {})[0]?.value,
  }));
}

/** The content a reader cares about first: JSON when the operation speaks it. */
export function preferredContent(contents: Content[]): Content | undefined {
  return contents.find((content) => content.type.includes('json')) ?? contents[0];
}

/** Human-readable type of a schema, such as `string`, `integer<int64>` or `Pet[]`. */
export function typeName(schema: SchemaObject | undefined, depth = 0): string {
  if (!schema || depth > 4) return 'any';

  if (schema.enum) {
    const values = schema.enum.map((value) => JSON.stringify(value));
    return values.length > 4 ? `${values.slice(0, 4).join(' | ')} | …` : values.join(' | ');
  }

  const union = schema.oneOf ?? schema.anyOf;
  if (union) return union.map((entry) => typeName(entry, depth + 1)).join(' | ');
  if (schema.allOf) return schema.allOf.map((entry) => typeName(entry, depth + 1)).join(' & ');

  const types = (Array.isArray(schema.type) ? schema.type : [schema.type]).filter(
    (type): type is string => typeof type === 'string' && type !== 'null',
  );
  const nullable = schema.nullable || (Array.isArray(schema.type) && schema.type.includes('null'));

  let name = types[0] ?? (schema.properties ? 'object' : 'any');
  if (name === 'array') name = `${typeName(schema.items, depth + 1)}[]`;
  else if (name === 'object' && schema.title) name = schema.title;
  else if (schema.format) name = `${name}<${schema.format}>`;

  return nullable ? `${name} | null` : name;
}

/** Properties of an object schema, merging `allOf` branches. */
export function propertiesOf(schema: SchemaObject | undefined): {
  name: string;
  schema: SchemaObject;
  required: boolean;
}[] {
  if (!schema) return [];
  const properties = new Map<string, { schema: SchemaObject; required: boolean }>();

  const collect = (current: SchemaObject) => {
    for (const branch of current.allOf ?? []) collect(branch);
    const required = new Set(current.required ?? []);
    for (const [name, property] of Object.entries(current.properties ?? {})) {
      properties.set(name, { schema: property, required: required.has(name) });
    }
  };
  collect(schema);

  return [...properties].map(([name, entry]) => ({ name, ...entry }));
}

/** A representative value for a schema, used for request and response samples. */
export function exampleOf(schema: SchemaObject | undefined, seen = new Set<SchemaObject>()): unknown {
  if (!schema || seen.has(schema)) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];

  const union = schema.oneOf ?? schema.anyOf;
  if (union?.[0]) return exampleOf(union[0], seen);

  const nested = new Set(seen).add(schema);
  const merged = schema.allOf ? { ...schema, properties: undefined } : schema;
  const properties = propertiesOf(schema.allOf ? schema : merged);
  if (properties.length > 0) {
    return Object.fromEntries(
      properties.map(({ name, schema: property }) => [name, exampleOf(property, nested)]),
    );
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes('array')) return [exampleOf(schema.items, nested)];
  if (types.includes('object')) return {};
  if (types.includes('integer') || types.includes('number')) return 0;
  if (types.includes('boolean')) return true;
  if (types.includes('null')) return null;
  if (types.includes('string')) return stringExample(schema);
  return null;
}

function stringExample(schema: SchemaObject): string {
  switch (schema.format) {
    case 'date-time':
      return '2026-01-01T00:00:00Z';
    case 'date':
      return '2026-01-01';
    case 'email':
      return 'user@example.com';
    case 'uri':
    case 'url':
      return 'https://example.com';
    case 'uuid':
      return '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    default:
      return 'string';
  }
}

/** A `curl` call for an operation, with its path parameters filled in. */
export function curlSample(operation: Operation, server = ''): string {
  const parameters = operation.parameters;
  let path = operation.path;
  for (const parameter of parameters.filter((p) => p.in === 'path')) {
    const value = parameter.example ?? exampleOf(parameter.schema) ?? parameter.name;
    path = path.replaceAll(`{${parameter.name}}`, encodeURIComponent(String(value)));
  }

  const query = parameters
    .filter((parameter) => parameter.in === 'query' && parameter.required)
    .map((parameter) => {
      const value = parameter.example ?? exampleOf(parameter.schema) ?? '';
      return `${encodeURIComponent(parameter.name)}=${encodeURIComponent(String(value))}`;
    });

  const url = `${server}${path}${query.length > 0 ? `?${query.join('&')}` : ''}`;
  const lines = [`curl -X ${operation.method} '${url}'`];

  for (const { scheme } of operation.security) {
    if (scheme.type === 'http' && scheme.scheme === 'bearer') {
      lines.push(`-H 'Authorization: Bearer $TOKEN'`);
    } else if (scheme.type === 'http') {
      lines.push(`-H 'Authorization: Basic $CREDENTIALS'`);
    } else if (scheme.type === 'apiKey' && scheme.in === 'header' && scheme.name) {
      lines.push(`-H '${scheme.name}: $API_KEY'`);
    }
  }

  for (const parameter of parameters.filter((p) => p.in === 'header' && p.required)) {
    const value = parameter.example ?? exampleOf(parameter.schema) ?? '';
    lines.push(`-H '${parameter.name}: ${value}'`);
  }

  const content = preferredContent(operation.body?.contents ?? []);
  if (content) {
    lines.push(`-H 'Content-Type: ${content.type}'`);
    const example = content.example ?? exampleOf(content.schema);
    if (example !== null && example !== undefined) {
      lines.push(`-d '${JSON.stringify(example, null, 2)}'`);
    }
  }

  return lines.join(' \\\n  ');
}
