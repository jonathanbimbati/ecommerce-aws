const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');
const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

async function resolveStackOutputs(stackName, region) {
  if (!stackName) return {};
  try {
    const client = new CloudFormationClient({ region });
    const cmd = new DescribeStacksCommand({ StackName: stackName });
    const res = await client.send(cmd);
    const outputs = (res.Stacks && res.Stacks[0] && res.Stacks[0].Outputs) || [];
    const map = {};
    for (const o of outputs) map[o.OutputKey] = o.OutputValue;
    return map;
  } catch (err) {
    console.warn('Could not resolve CloudFormation stack outputs:', err.message || err);
    return {};
  }
}

async function ensureUsersTableByConvention(stackName, region) {
  const guess = `${stackName}-Users`;
  try {
    const ddb = new DynamoDBClient({ region });
    const cmd = new DescribeTableCommand({ TableName: guess });
    const res = await ddb.send(cmd);
    if (res && res.Table && res.Table.TableName) {
      return { UsersTableName: res.Table.TableName };
    }
  } catch (err) {
    // ignore — table might not exist or no permissions
  }
  return {};
}

module.exports = { resolveStackOutputs, ensureUsersTableByConvention };
