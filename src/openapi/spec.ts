import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';

/** The subset of JSON Schema that documentation actually renders. */
export interface SchemaObject {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  example?: unknown;
  examples?: unknown[];
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  additionalProperties?: boolean | SchemaObject;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  /** OpenAPI 3.0 spelling of `type: [..., 'null']`. */
  nullable?: boolean;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, { summary?: string; description?: string; value?: unknown }>;
}

export interface ParameterObject {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, MediaTypeObject>;
  };
  responses?: Record<string, { description?: string; content?: Record<string, MediaTypeObject> }>;
  security?: Record<string, string[]>[];
  servers?: { url: string; description?: string }[];
}

export interface SecuritySchemeObject {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'mutualTLS';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
}

export interface OpenApiDocument {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths?: Record<string, Record<string, OperationObject> & { parameters?: ParameterObject[] }>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecuritySchemeObject>;
  };
  security?: Record<string, string[]>[];
  tags?: { name: string; description?: string }[];
}

const specs = new Map<string, Promise<OpenApiDocument>>();

/** Reads and dereferences a spec, once per file for the whole build. */
export function loadSpec(file: string): Promise<OpenApiDocument> {
  let spec = specs.get(file);
  if (!spec) {
    spec = readSpec(file);
    specs.set(file, spec);
  }
  return spec;
}

async function readSpec(file: string): Promise<OpenApiDocument> {
  const source = await readFile(file, 'utf8');
  const document = file.endsWith('.json')
    ? (JSON.parse(source) as unknown)
    : (parseYaml(source) as unknown);
  if (!isObject(document)) throw new Error(`${file} is not an OpenAPI document.`);
  return dereference(document) as OpenApiDocument;
}

/**
 * Replaces internal `$ref` with the object they point at. References are shared rather
 * than copied, so a schema that contains itself becomes a cycle instead of looping forever.
 */
export function dereference(document: Record<string, unknown>): Record<string, unknown> {
  const walked = new Map<object, unknown>();

  const pointerTo = (ref: string): unknown => {
    const parts = ref
      .slice(2)
      .split('/')
      .map((part) => decodeURIComponent(part).replaceAll('~1', '/').replaceAll('~0', '~'));
    let target: unknown = document;
    for (const part of parts) {
      if (!isObject(target)) return undefined;
      target = target[part];
    }
    return target;
  };

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isObject(node)) return node;

    const cached = walked.get(node);
    if (cached !== undefined) return cached;

    const ref = node.$ref;
    if (typeof ref === 'string') {
      if (!ref.startsWith('#/')) {
        throw new Error(
          `ZenithDocs only resolves references inside a single file, but found "${ref}". ` +
            'Bundle the spec into one file before pointing ZenithDocs at it.',
        );
      }
      const target = pointerTo(ref);
      if (target === undefined) throw new Error(`Unresolved reference "${ref}".`);
      const resolved = walk(target);
      // Dereferencing drops the name of the schema, which is worth showing.
      const name = ref.startsWith(SCHEMAS) ? ref.slice(SCHEMAS.length) : undefined;
      if (name && isObject(resolved) && resolved.title === undefined) resolved.title = name;
      return resolved;
    }

    const output: Record<string, unknown> = {};
    walked.set(node, output);
    for (const [key, value] of Object.entries(node)) output[key] = walk(value);
    return output;
  };

  return walk(document) as Record<string, unknown>;
}

const SCHEMAS = '#/components/schemas/';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
