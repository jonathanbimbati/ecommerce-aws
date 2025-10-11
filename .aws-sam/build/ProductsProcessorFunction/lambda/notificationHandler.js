export async function handler(event) {
  console.log('NotificationHandler received event:', JSON.stringify(event, null, 2));

  // SNS messages are in event.Records[].Sns
  for (const record of event.Records || []) {
    const sns = record.Sns || {};
    console.log('SNS MessageId:', sns.MessageId);
    console.log('SNS Subject:', sns.Subject);
    console.log('SNS Message:', sns.Message);
  }

  return { status: 'ok' };
}
