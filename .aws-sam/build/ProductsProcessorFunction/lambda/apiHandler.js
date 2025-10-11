import serverlessExpress from '@vendia/serverless-express';
import app from '../index';

const server = serverlessExpress({ app });

export function handler(event, context) { return server(event, context); }
