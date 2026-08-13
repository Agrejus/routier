import { describeJoinContract } from '@routier/test-utils';
import { MongoDbPlugin } from '../MongoDbPlugin';
import { FakeMongoDriver } from './FakeMongoDriver';

/**
 * Against the fake driver, like the rest of this plugin's suite: the question here is whether
 * the plugin loads the inner side and pairs it correctly, which is answered without a server.
 * Whether the emitted MQL means what the plugin thinks belongs to `e2e/src/mongoContainer.test.ts`.
 */
describeJoinContract('mongodb', () => new MongoDbPlugin(new FakeMongoDriver()));
