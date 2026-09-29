import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import * as debug from 'debug';

const log = debug('agenda:mock-mongodb');

export interface IMockMongo {
	disconnect: () => void;
	mongo: MongoClient;
	mongod?: MongoMemoryServer;
	uri: string;
}

export async function mockMongo(): Promise<IMockMongo> {
	const self: IMockMongo = {} as any;
	const externalUri = process.env.MONGO_URI;

	// CI already starts MongoDB. Use it instead of mongodb-memory-server,
	// whose default 5.0.x binary needs OpenSSL 1.1 (not present on Ubuntu 24.04).
	// Use a unique database per helper call so mocha files cannot see each other's jobs.
	if (externalUri) {
		const url = new URL(externalUri);
		const baseName = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'agenda-test';
		url.pathname = `/${baseName}-${process.pid}-${Date.now().toString(36)}-${Math.random()
			.toString(36)
			.slice(2, 8)}`;
		const uri = url.toString();
		log('using external mongo', uri);
		self.mongo = await MongoClient.connect(uri);
		self.uri = uri;
		self.disconnect = function () {
			self.mongo.close();
		};
		return self;
	}

	self.mongod = await MongoMemoryServer.create();
	const uri = self.mongod.getUri();
	log('mongod started', uri);
	self.mongo = await MongoClient.connect(uri);
	self.disconnect = function () {
		self.mongod?.stop();
		log('mongod stopped');
		self.mongo.close();
	};
	self.uri = uri;

	return self;
}
