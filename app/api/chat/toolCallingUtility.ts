import { ChatCompletionTool } from 'openai/src/resources/chat/completions';
import {
  FunctionDeclaration,
  FunctionDeclarationSchemaProperty,
  SchemaType,
} from '@google/generative-ai';

// Helper to map OpenAI/JSON Schema type to Gemini SchemaType
function getSchemaType(type: string): SchemaType {
  const upper = type.toUpperCase();
  if (upper in SchemaType) return SchemaType[upper as keyof typeof SchemaType];
  throw new Error(`Unknown or unsupported type: '${type}'`);
}

// Recursively convert JSON Schema property to Gemini property
function convertProperty(
  key: string,
  value: any,
  parentName: string
): FunctionDeclarationSchemaProperty {
  if (!value.type) {
    throw new Error(`Property '${key}' in tool '${parentName}' is missing a 'type' field.`);
  }
  const baseType = value.type.toLowerCase();
  const schemaType = getSchemaType(baseType);

  // Start with description and type
  const prop: any = {
    type: schemaType,
    description: value.description,
  };

  // Copy over common JSON Schema keywords
  for (const keyword of [
    'enum', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'default', 'format', 'examples', 'const', 'multipleOf', 'exclusiveMinimum', 'exclusiveMaximum', 'minItems', 'maxItems', 'uniqueItems', 'nullable', 'deprecated', 'readOnly', 'writeOnly', 'title', 'examples',
  ]) {
    if (value[keyword] !== undefined) {
      prop[keyword] = value[keyword];
    }
  }

  if (schemaType === SchemaType.OBJECT) {
    // Recursively handle nested properties
    prop.properties = {};
    prop.required = Array.isArray(value.required) ? value.required : [];
    if (value.properties) {
      for (const [subKey, subVal] of Object.entries(value.properties)) {
        prop.properties[subKey] = convertProperty(subKey, subVal, parentName + '.' + key);
      }
    }
  } else if (schemaType === SchemaType.ARRAY) {
    // Recursively handle array items
    if (!value.items) {
      throw new Error(`Array property '${key}' in tool '${parentName}' is missing 'items' definition.`);
    }
    prop.items = convertProperty(key + '[]', value.items, parentName);
  }
  // For non-object/array types, nothing more to do
  return prop as FunctionDeclarationSchemaProperty;
}

export function convertToolsToGemini(
  tools: ChatCompletionTool[]
): FunctionDeclaration[] {
  return tools.map((tool) => {
    if (tool.type !== 'function') {
      throw new Error(`Unsupported tool type: ${tool.type}`);
    }
    const { name, description, parameters } = tool.function;
    if (!parameters || parameters.type !== 'object') {
      throw new Error(`Top-level parameters for tool '${name}' must be of type 'object'`);
    }
    const convertedProps: Record<string, FunctionDeclarationSchemaProperty> = {};
    for (const [key, value] of Object.entries(parameters.properties || {})) {
      convertedProps[key] = convertProperty(key, value, name);
    }
    return {
      name,
      description,
      parameters: {
        type: SchemaType.OBJECT,
        properties: convertedProps,
        required: Array.isArray(parameters.required) ? parameters.required : [],
      },
    };
  });
}
