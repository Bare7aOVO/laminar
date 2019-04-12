import {
  childOptions,
  CombineResults,
  isJsonSchema,
  isObject,
  NoErrors,
  validateSchema,
} from '../helpers';
import { Validator } from '../types';

export const validateProperties: Validator = (schema, value, options) => {
  if (isJsonSchema(schema) && schema.properties && isObject(value)) {
    const { properties } = schema;
    return CombineResults(
      Object.keys(value).map(key =>
        validateSchema(properties[key], value[key], childOptions(key, options)),
      ),
    );
  }
  return NoErrors;
};