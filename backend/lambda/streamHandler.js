import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

export async function handler(event) {
  const isStream = Array.isArray(event.Records);
  console.log('Lambda invoked - event type:', isStream ? 'DynamoDBStream' : 'HttpApi');

  const snsClient = new SNSClient({});
  const topicArn = process.env.NOTIFICATION_TOPIC_ARN || null;

  if (isStream) {
    for (const record of event.Records) {
      console.log('Stream record eventID:', record.eventID, 'eventName:', record.eventName);
      try {
        const newImage = record.dynamodb && record.dynamodb.NewImage ? record.dynamodb.NewImage : null;
        const oldImage = record.dynamodb && record.dynamodb.OldImage ? record.dynamodb.OldImage : null;
        console.log('NewImage:', JSON.stringify(newImage));
        console.log('OldImage:', JSON.stringify(oldImage));

        if (record.eventName === 'INSERT' && newImage) {
          // Convert DynamoDB JSON to plain object (shallow)
          const item = {};
          for (const key of Object.keys(newImage)) {
            const valObj = newImage[key];
            if (valObj.S !== undefined) item[key] = valObj.S;
            else if (valObj.N !== undefined) item[key] = Number(valObj.N);
            else if (valObj.BOOL !== undefined) item[key] = valObj.BOOL;
            else item[key] = valObj;
          }

          const subject = `Novo produto adicionado: ${item.title || item.name || item.id || ''}`;
          const message = JSON.stringify({ event: 'PRODUCT_INSERT', item, awsEvent: record }, null, 2);

          if (topicArn) {
            try {
              const cmd = new PublishCommand({ TopicArn: topicArn, Subject: subject, Message: message });
              const res = await snsClient.send(cmd);
              console.log('SNS publish response:', res);
            } catch (err) {
              console.error('Failed to publish SNS message', err);
            }
          } else {
            console.warn('Notification topic ARN not configured; skipping SNS publish');
          }
        }
      } catch (err) {
        console.error('Erro ao processar record:', err);
      }
    }

    return { statusCode: 200, body: 'Stream processed' };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'ProductsProcessorFunction alive', received: event })
  };
}
