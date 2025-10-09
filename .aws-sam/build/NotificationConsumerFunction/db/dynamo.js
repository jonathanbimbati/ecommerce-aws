const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const TABLE_NAME = process.env.DYNAMODB_TABLE || null; // if null, caller should fallback to in-memory

let ddbDocClient = null;
if (TABLE_NAME) {
  const client = new DynamoDBClient({ region: REGION });
  ddbDocClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true, convertEmptyValues: true }
  });
}

async function getProduct(id) {
  if (!ddbDocClient) throw new Error('DynamoDB client not configured');
  const cmd = new GetCommand({ TableName: TABLE_NAME, Key: { id } });
  const res = await ddbDocClient.send(cmd);
  return res.Item || null;
}

async function listProducts() {
  if (!ddbDocClient) throw new Error('DynamoDB client not configured');
  const cmd = new ScanCommand({ TableName: TABLE_NAME });
  const res = await ddbDocClient.send(cmd);
  return res.Items || [];
}

async function createProduct(item) {
  if (!ddbDocClient) throw new Error('DynamoDB client not configured');
  const cmd = new PutCommand({ TableName: TABLE_NAME, Item: item });
  await ddbDocClient.send(cmd);
  return item;
}

async function updateProduct(id, updates) {
  if (!ddbDocClient) throw new Error('DynamoDB client not configured');
  const expressions = [];
  const exprAttrNames = {};
  const exprAttrValues = {};
  let idx = 0;
  for (const [k, v] of Object.entries(updates)) {
    idx++;
    const nameKey = `#f${idx}`;
    const valKey = `:v${idx}`;
    expressions.push(`${nameKey} = ${valKey}`);
    exprAttrNames[nameKey] = k;
    exprAttrValues[valKey] = v;
  }
  if (expressions.length === 0) return await getProduct(id);

  const updateExpression = 'SET ' + expressions.join(', ');
  const cmd = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: exprAttrNames,
    ExpressionAttributeValues: exprAttrValues,
    ReturnValues: 'ALL_NEW'
  });
  const res = await ddbDocClient.send(cmd);
  return res.Attributes;
}

async function deleteProduct(id) {
  if (!ddbDocClient) throw new Error('DynamoDB client not configured');
  const cmd = new DeleteCommand({ TableName: TABLE_NAME, Key: { id } });
  await ddbDocClient.send(cmd);
}

module.exports = {
  getProduct,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  TABLE_NAME,
  REGION
};
