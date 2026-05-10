/**
 * Central tool registry.
 *
 * Tools register themselves by name. The agent loop never imports a tool
 * directly — it goes through `get(name)` and `validateInput(name, raw)`.
 * `validateInput` is a small JSON-Schema runtime check tuned to the
 * shapes the LLM produces (objects with primitive / array properties).
 *
 * Validation errors are returned as `Result.err` with code `INVALID_INPUT`
 * — never thrown. The agent loop turns them into a `tool` message that
 * the model can react to (e.g. "I supplied the wrong field, let me try
 * again").
 */

import type {
  JsonSchemaObject,
  JsonSchemaProperty,
  NexusTool,
  ToolDescriptor,
} from '../types/agent';
import { NexusError, type Result, err, ok } from '../types/auth';

const tools = new Map<string, NexusTool<unknown>>();

/** Register a tool. Replaces any prior registration with the same name. */
export const register = <T>(tool: NexusTool<T>): void => {
  tools.set(tool.name, tool as NexusTool<unknown>);
};

/** Look up a tool by name. */
export const get = (name: string): NexusTool<unknown> | null => tools.get(name) ?? null;

/** List every registered tool's descriptor (no `execute`). */
export const listAll = (): readonly ToolDescriptor[] =>
  Array.from(tools.values()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    isDestructive: t.isDestructive,
  }));

/** Reset the registry — used between unit tests. */
export const __resetForTests = (): void => {
  tools.clear();
};

// ── Validation ──────────────────────────────────────────────────────────

/**
 * Validate an input object against the tool's `inputSchema`. The check
 * accepts `Record<string, unknown>` and does NOT mutate it — call sites
 * are free to forward the validated value to `execute()`.
 */
export const validateInput = (
  toolName: string,
  raw: unknown,
): Result<Readonly<Record<string, unknown>>, NexusError> => {
  const tool = get(toolName);
  if (tool === null) {
    return err(new NexusError('NOT_FOUND', `No tool registered with name "${toolName}".`));
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return err(
      new NexusError('INVALID_INPUT', `Tool "${toolName}" expects an object input.`),
    );
  }
  return validateAgainstSchema(toolName, raw as Record<string, unknown>, tool.inputSchema, '');
};

const validateAgainstSchema = (
  toolName: string,
  value: Record<string, unknown>,
  schema: JsonSchemaObject,
  path: string,
): Result<Readonly<Record<string, unknown>>, NexusError> => {
  // Required-field check.
  for (const required of schema.required ?? []) {
    if (!(required in value) || value[required] === undefined || value[required] === null) {
      return err(
        new NexusError(
          'INVALID_INPUT',
          `Tool "${toolName}" missing required field: ${path}${required}`,
        ),
      );
    }
  }

  // Per-property check.
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (!(key in value)) continue; // optional and absent — fine
    const actual = value[key];
    const fieldPath = `${path}${key}`;
    const propResult = validateProperty(toolName, actual, propSchema, fieldPath);
    if (!propResult.ok) return propResult;
  }

  return ok(value as Readonly<Record<string, unknown>>);
};

const validateProperty = (
  toolName: string,
  value: unknown,
  schema: JsonSchemaProperty,
  path: string,
): Result<true, NexusError> => {
  switch (schema.type) {
    case 'string': {
      if (typeof value !== 'string') {
        return err(typeMismatch(toolName, path, 'string', value));
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return err(constraint(toolName, path, `must be at least ${schema.minLength} chars`));
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return err(constraint(toolName, path, `must be at most ${schema.maxLength} chars`));
      }
      if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
        return err(constraint(toolName, path, `must match pattern ${schema.pattern}`));
      }
      if (schema.enum !== undefined && !(schema.enum as readonly unknown[]).includes(value)) {
        return err(constraint(toolName, path, `must be one of ${schema.enum.join(', ')}`));
      }
      return ok(true);
    }
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return err(typeMismatch(toolName, path, schema.type, value));
      }
      if (schema.type === 'integer' && !Number.isInteger(value)) {
        return err(constraint(toolName, path, 'must be an integer'));
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        return err(constraint(toolName, path, `must be ≥ ${schema.minimum}`));
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return err(constraint(toolName, path, `must be ≤ ${schema.maximum}`));
      }
      return ok(true);
    }
    case 'boolean':
      if (typeof value !== 'boolean') {
        return err(typeMismatch(toolName, path, 'boolean', value));
      }
      return ok(true);
    case 'array': {
      if (!Array.isArray(value)) {
        return err(typeMismatch(toolName, path, 'array', value));
      }
      if (schema.items !== undefined) {
        for (let i = 0; i < value.length; i++) {
          const r = validateProperty(toolName, value[i], schema.items, `${path}[${i}]`);
          if (!r.ok) return r;
        }
      }
      return ok(true);
    }
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return err(typeMismatch(toolName, path, 'object', value));
      }
      if (schema.properties !== undefined) {
        const subResult = validateAgainstSchema(
          toolName,
          value as Record<string, unknown>,
          schema as JsonSchemaObject,
          `${path}.`,
        );
        if (!subResult.ok) return err(subResult.error);
      }
      return ok(true);
    }
    /* istanbul ignore next — exhaustive */
    default:
      return ok(true);
  }
};

const typeMismatch = (
  toolName: string,
  path: string,
  expected: string,
  actual: unknown,
): NexusError =>
  new NexusError(
    'INVALID_INPUT',
    `Tool "${toolName}" field "${path}" expected ${expected}, got ${typeof actual}.`,
  );

const constraint = (toolName: string, path: string, message: string): NexusError =>
  new NexusError('INVALID_INPUT', `Tool "${toolName}" field "${path}" ${message}.`);
