/** Normalize Apito introspection JSON for graphql-codegen (adds missing `interfaces`). */
export function normalizeIntrospection(intro: Record<string, unknown>): Record<string, unknown> {
  const data = intro.data as Record<string, unknown> | undefined;
  const schema = data?.__schema as Record<string, unknown> | undefined;
  if (!schema?.types) return intro;

  const placeholderField = {
    name: '_codegenPlaceholder',
    args: [],
    type: { kind: 'SCALAR', name: 'String', ofType: null },
  };

  const types = (schema.types as Array<Record<string, unknown>>).map((t) => {
    const kind = t.kind as string;
    const base: Record<string, unknown> = {
      ...t,
      interfaces: t.interfaces ?? [],
      possibleTypes: t.possibleTypes ?? [],
      enumValues: t.enumValues ?? null,
      inputFields: t.inputFields ?? null,
    };
    if (kind === 'OBJECT') {
      let fields = Array.isArray(t.fields) ? [...t.fields] : [];
      if (fields.length === 0) {
        fields = [placeholderField];
      }
      base.fields = (fields as Array<Record<string, unknown>>).map((f) => ({
        args: [],
        ...f,
      }));
    }
    return base;
  });

  return {
    ...intro,
    data: {
      ...data,
      __schema: {
        ...schema,
        types,
      },
    },
  };
}
