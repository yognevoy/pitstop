/**
 * Structure schema validator for JSON files.
 */
export function validate(schema, data) {
  const errors = [];

  validateNode(schema, data, '$', errors);

  return errors;
}

function validateNode(schema, data, path, errors) {
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matches = types.some((type) => matchesType(type, data));

    if (!matches) {
      errors.push(`${path}: expected type ${types.join('|')}, got ${describeType(data)}`);
      return;
    }
  }

  if (schema.enum !== undefined) {
    if (!schema.enum.includes(data)) {
      errors.push(`${path}: value ${JSON.stringify(data)} is not one of [${schema.enum.join(', ')}]`);
    }
  }

  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push(`${path}: ${data} is below minimum ${schema.minimum}`);
    }

    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push(`${path}: ${data} is above maximum ${schema.maximum}`);
    }
  }

  if (data !== null && typeof data === 'object' && !Array.isArray(data) && schema.properties !== undefined) {
    validateObject(schema, data, path, errors);
  }

  if (Array.isArray(data)) {
    validateArray(schema, data, path, errors);
  }
}

function validateObject(schema, data, path, errors) {
  for (const key of schema.required ?? []) {
    if (!(key in data)) {
      errors.push(`${path}.${key}: missing required property`);
    }
  }

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (key in data) {
      validateNode(propSchema, data[key], `${path}.${key}`, errors);
    }
  }
}

function validateArray(schema, data, path, errors) {
  if (schema.minItems !== undefined && data.length < schema.minItems) {
    errors.push(`${path}: has ${data.length} items, fewer than minItems ${schema.minItems}`);
  }

  if (schema.items !== undefined) {
    data.forEach((item, index) => {
      validateNode(schema.items, item, `${path}[${index}]`, errors);
    });
  }
}

function matchesType(type, value) {
  if (type === 'string') {
    return typeof value === 'string';
  }

  if (type === 'number') {
    return typeof value === 'number';
  }

  if (type === 'boolean') {
    return typeof value === 'boolean';
  }

  if (type === 'null') {
    return value === null;
  }

  if (type === 'array') {
    return Array.isArray(value);
  }

  if (type === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  return false;
}

function describeType(value) {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}
