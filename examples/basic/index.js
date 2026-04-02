import { ApitoClient } from '@apito-io/js-admin-sdk';

// Example configuration - replace with your actual values
const client = new ApitoClient({
  baseURL: 'https://api.apito.io/graphql',
  apiKey: 'your-api-key-here',
  timeout: 30000,
});

// Example usage
async function main() {
  try {
    console.log('🚀 Starting Apito SDK example...\n');

    // Example 1: Create a new todo
    console.log('📋 Creating a new todo...');
    const todoData = {
      title: 'Learn Apito JavaScript SDK',
      description: 'Complete the SDK tutorial and examples',
      status: 'todo',
      priority: 'high',
    };

    const newTodo = await client.createNewResource({
      model: 'todos',
      payload: todoData,
    });

    console.log('✅ Created todo:', {
      id: newTodo.id,
      title: newTodo.data.title,
      status: newTodo.data.status,
    });

    // Example 2: Get the created todo
    console.log('\n🔍 Fetching the created todo...');
    const fetchedTodo = await client.getSingleResource('todos', newTodo.id);
    console.log('📄 Fetched todo:', {
      id: fetchedTodo.id,
      title: fetchedTodo.data.title,
      createdAt: fetchedTodo.meta?.created_at,
    });

    // Example 3: Search todos
    console.log('\n🔎 Searching todos...');
    const searchResults = await client.searchResources('todos', {
      where: { status: 'todo' },
      limit: 10,
    });

    console.log(`📊 Found ${searchResults.count} todos:`);
    searchResults.results.forEach((todo, index) => {
      console.log(`  ${index + 1}. ${todo.data.title} (${todo.data.status})`);
    });

    // Example 4: Update the todo
    console.log('\n✏️  Updating the todo...');
    const updatedTodo = await client.updateResource({
      model: 'todos',
      id: newTodo.id,
      payload: {
        ...newTodo.data,
        status: 'in_progress',
        progress: 50,
      },
    });

    console.log('🔄 Updated todo status to:', updatedTodo.data.status);

    // Example 5: Get related documents (if applicable)
    console.log('\n🔗 Getting related documents...');
    try {
      const relatedDocs = await client.getRelationDocuments(newTodo.id, {
        model: 'users',
        field: 'assigned_to',
      });
      console.log(`📎 Found ${relatedDocs.count} related documents`);
    } catch (error) {
      console.log('ℹ️  No related documents found or relation not configured');
    }

    // Example 6: Send audit log
    console.log('\n📝 Sending audit log...');
    await client.sendAuditLog({
      action: 'example_usage',
      model: 'todos',
      record_id: newTodo.id,
      user_id: 'example-user',
      changes: { status: 'in_progress' },
    });
    console.log('✅ Audit log sent successfully');

    console.log('\n🎉 Example completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('📄 Response:', error.response.data);
    }
  }
}

// Run the example
main();
