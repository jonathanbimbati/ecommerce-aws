const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const productsRouter = require('./routes/products');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Try to resolve missing table names from CloudFormation outputs (best-effort)
const { resolveStackOutputs } = require('./aws/stackResolver');
async function ensureEnvFromStack() {
  if (process.env.DYNAMODB_TABLE && process.env.USERS_TABLE) return;
  const stackName = process.env.STACK_NAME || process.env.AWS_STACK_NAME || 'ecommerce-aws';
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  try {
    const outputs = await resolveStackOutputs(stackName, region);
    if (!process.env.DYNAMODB_TABLE && outputs.ProductsTableName) process.env.DYNAMODB_TABLE = outputs.ProductsTableName;
    if (!process.env.USERS_TABLE && outputs.UsersTableName) process.env.USERS_TABLE = outputs.UsersTableName;
    // try a best-effort guess for Users table if CF output wasn't present
    if (!process.env.USERS_TABLE) {
      const { ensureUsersTableByConvention } = require('./aws/stackResolver');
      const guessed = await ensureUsersTableByConvention(stackName, region);
      if (guessed && guessed.UsersTableName) process.env.USERS_TABLE = guessed.UsersTableName;
    }
    if (process.env.DYNAMODB_TABLE || process.env.USERS_TABLE) {
      console.log('Auto-resolved environment from CloudFormation outputs:');
      console.log('  DYNAMODB_TABLE=', process.env.DYNAMODB_TABLE || '(not set)');
      console.log('  USERS_TABLE=', process.env.USERS_TABLE || '(not set)');
    }
  } catch (err) {
    console.warn('Stack resolution failed:', err.message || err);
  }
}

app.use(cors());
app.use(bodyParser.json());

app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);

// Health endpoint used by Kubernetes liveness/readiness probes
app.get('/api/health', (req, res) => {
  const payload = {
    status: 'ok',
    DYNAMODB_TABLE: process.env.DYNAMODB_TABLE || null,
    AWS_REGION: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null
  };
  res.json(payload);
});

app.get('/', (req, res) => {
  res.json({ message: 'E-commerce backend is running' });
});

if (require.main === module) {
  (async () => {
    await ensureEnvFromStack();
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      console.log('Environment:');
      console.log('  DYNAMODB_TABLE=', process.env.DYNAMODB_TABLE || '(not set)');
      console.log('  USERS_TABLE=', process.env.USERS_TABLE || '(not set)');
      console.log('  AWS_REGION=', process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '(not set)');
    });
  })();
}

module.exports = app;
