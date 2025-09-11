import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';

export interface TestDbContext {
  mem: MongoMemoryServer;
  client: MongoClient;
  db: Db;
  close: () => Promise<void>;
}

export async function setupTestDb(): Promise<TestDbContext> {
  const mem = await MongoMemoryServer.create();
  const uri = mem.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = 'testdb';
  const client = await MongoClient.connect(uri);
  const db = client.db('testdb');
  return {
    mem,
    client,
    db,
    close: async () => {
      await client.close();
      await mem.stop();
    },
  };
}
