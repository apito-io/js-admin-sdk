import * as fs from 'fs';
import * as path from 'path';
import {
  apitoListGraphQLTypeName,
  apitoModelName,
  apitoMultipleResourceName,
  apitoSingularGraphQLTypeName,
  apitoSingularResourceName,
} from '../naming/apitoGraphqlNames';

interface NamingVector {
  input: string;
  singularResourceName: string;
  multipleResourceName: string;
  graphqlTypeName: string;
  graphqlTypeNamePlural: string;
}

const vectors: NamingVector[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../test/fixtures/naming_vectors.json'), 'utf8')
);

describe('naming_vectors.json parity', () => {
  test.each(vectors)('resource $input', (row) => {
    expect(apitoSingularResourceName(row.input)).toBe(row.singularResourceName);
    expect(apitoMultipleResourceName(row.input)).toBe(row.multipleResourceName);
    expect(apitoModelName(row.input)).toBe(row.singularResourceName);
    expect(apitoSingularGraphQLTypeName(row.input)).toBe(row.graphqlTypeName);
    expect(apitoListGraphQLTypeName(row.input)).toBe(row.graphqlTypeNamePlural);
  });
});
