import { fromMongoDoc, toMongoDoc } from './mongo-docs';

describe('mongo docs adapter', () => {
  it('maps a user domain entity to a mongo document and back', () => {
    const domain = {
      id: 'user-1',
      email: 'ana@test.com',
      passwordHash: 'hash',
      fullName: 'Ana Pérez',
      role: 'USER' as const,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    const doc = toMongoDoc(domain);

    expect(doc).toMatchObject({
      _id: 'user-1',
      email: 'ana@test.com',
      passwordHash: 'hash',
      fullName: 'Ana Pérez',
      role: 'USER',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    expect(fromMongoDoc(doc)).toEqual(domain);
  });
});
