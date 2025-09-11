import { MongoMemoryServer } from 'mongodb-memory-server';

export async function startMemoryMongo() {
	const mongod = await MongoMemoryServer.create();
	const uri = mongod.getUri();
	process.env.MONGODB_URI = uri;
	process.env.MONGODB_DB = 'test_db';
	return mongod;
}

export async function stopMemoryMongo(mongod: MongoMemoryServer) {
	await mongod.stop();
}
