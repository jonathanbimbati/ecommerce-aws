const serverlessExpress = require('@vendia/serverless-express');
const app = require('../index');

const server = serverlessExpress({ app });

exports.handler = (event, context) => server(event, context);
