export function toMongoDoc<T extends object>(entity: T): Record<string, unknown> {
  const { id, ...rest } = entity as Record<string, unknown> & { id?: unknown };

  return {
    ...(id !== undefined ? { _id: id } : {}),
    ...rest,
  };
}

export function fromMongoDoc<T>(doc: Record<string, unknown>): T {
  const { _id, ...rest } = doc;

  return {
    ...(idFromMongo(_id) !== undefined ? { id: idFromMongo(_id) } : {}),
    ...rest,
  } as T;
}

function idFromMongo(id: unknown): string | undefined {
  if (typeof id === 'string') {
    return id;
  }

  return undefined;
}
