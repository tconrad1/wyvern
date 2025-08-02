import weaviate from 'weaviate-client';

async function testWeaviate() {
  try {
    console.log('Testing Weaviate connection...');
    
    const client = await weaviate.connectToLocal({
      host: 'localhost',
      port: 8080
    });
    
    console.log('✅ Connected to Weaviate');
    
    // Check if collection exists
    try {
      const collection = await client.collections.get('GeneralRules');
      console.log('✅ Found GeneralRules collection');
      
      // Try to get object count
      try {
        const count = await collection.aggregate.overAll().withFields('total').do();
        console.log('📊 Total objects in collection:', count.total);
      } catch (error) {
        console.log('❌ Could not get object count:', error.message);
      }
      
    } catch (error) {
      console.log('❌ GeneralRules collection not found:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Failed to connect to Weaviate:', error.message);
  }
}

testWeaviate(); 