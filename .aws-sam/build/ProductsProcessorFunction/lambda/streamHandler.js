exports.handler = async (event) => {
  console.log('Lambda invoked - event type:', Array.isArray(event.Records) ? 'DynamoDBStream' : 'HttpApi');
  if (Array.isArray(event.Records)) {
    for (const record of event.Records) {
      console.log('Stream record eventID:', record.eventID, 'eventName:', record.eventName);
      try {
        console.log('NewImage:', JSON.stringify(record.dynamodb.NewImage));
        console.log('OldImage:', JSON.stringify(record.dynamodb.OldImage));
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
};
