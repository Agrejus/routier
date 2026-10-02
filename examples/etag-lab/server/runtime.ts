import { SqliteDbPlugin } from '@routier/sqlite-plugin';
import express, { type Express } from 'express';
import { createAdminRouter } from './adminRoutes';
import { answerErrors } from './errors';
import { NotesRepository } from './notesRepository';
import { Replica } from './replica';
import { createRestRouter, type LabServices } from './restRoutes';
import { createTransportRouter } from './transportRoute';
import { WireLog } from './wireLog';

export type LabRuntime = { app: Express; services: LabServices };

export const createRuntime = async (databaseFile: string): Promise<LabRuntime> => {
  const plugin = new SqliteDbPlugin(databaseFile);
  const services: LabServices = { repository: new NotesRepository(plugin), replica: new Replica(), log: new WireLog() };
  await services.repository.seed();

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/routier', createTransportRouter(plugin, services.log));
  app.use('/rest', createRestRouter(services));
  app.use('/admin', createAdminRouter(services));
  app.use(answerErrors);

  return { app, services };
};
