// Quick test to verify Cloud Logging works
const { Logging } = require('@google-cloud/logging');

async function testCloudLogging() {
  try {
    const logging = new Logging({ projectId: 'phanesugc' });
    const log = logging.log('test-direct-log');
    
    const metadata = {
      severity: 'INFO',
      labels: {
        test: 'direct-test',
      },
    };
    
    const entry = log.entry(metadata, {
      message: 'Direct test from Node.js',
      timestamp: new Date().toISOString(),
    });
    
    await log.write(entry);
    console.log('✅ Successfully wrote to Cloud Logging!');
    console.log('Check: https://console.cloud.google.com/logs/query?project=phanesugc');
  } catch (error) {
    console.error('❌ Failed to write to Cloud Logging:', error.message);
    console.error('Full error:', error);
  }
}

testCloudLogging();
