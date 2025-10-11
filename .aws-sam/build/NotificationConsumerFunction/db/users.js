import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const TABLE_NAME = process.env.USERS_TABLE || process.env.DYNAMODB_TABLE || null; // prefer dedicated Users table if available

let ddbDocClient = null;
if (TABLE_NAME) {
  const client = new DynamoDBClient({ region: REGION });
  ddbDocClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true, convertEmptyValues: true }
  });
}

async function getUserByUsername(username) {
  if (!ddbDocClient) throw new Error('DynamoDB client not configured');
  // we store users with id = `user::${username}`
  const key = { id: `user::${username}` };
  const cmd = new GetCommand({ TableName: TABLE_NAME, Key: key });
  const res = await ddbDocClient.send(cmd);
  return res.Item || null;
}

async function createUser(user) {
  if (!ddbDocClient) throw new Error('DynamoDB client not configured');
  const item = Object.assign({}, user, { id: `user::${user.username}` });
  const cmd = new PutCommand({ TableName: TABLE_NAME, Item: item, ConditionExpression: 'attribute_not_exists(id)' });
  await ddbDocClient.send(cmd);
  return item;
}

async function listUsers() {
  if (!ddbDocClient) throw new Error('DynamoDB client not configured');
  const cmd = new ScanCommand({ TableName: TABLE_NAME, ProjectionExpression: 'id, username, name' });
  const res = await ddbDocClient.send(cmd);
  return res.Items || [];
}

export default { getUserByUsername, createUser, listUsers, TABLE_NAME };
