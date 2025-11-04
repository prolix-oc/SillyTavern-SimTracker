/**
 * Example Usage of All ST-Helpers Modules
 * Demonstrates the capabilities of each utility module
 */

// Import all modules
const StringUtils = require('../stringUtils');
const DOMUtils = require('../domUtils');
const { StorageManager } = require('../storageManager');
const { LRUCache, Queue, Trie, CircularBuffer } = require('../dataStructures');
const AsyncUtils = require('../asyncUtils');
const { Cosine } = require('../vectorDistance');

console.log('=== ST-Helpers Module Examples ===\n');

// ============================================================================
// STRING UTILITIES
// ============================================================================
console.log('--- String Utilities ---');

// Text truncation
const longText = 'This is a very long text that needs to be truncated for display';
console.log('Truncated:', StringUtils.truncate(longText, 30));

// HTML/Markdown stripping
const htmlText = '<p>Hello <b>world</b></p>';
console.log('Stripped HTML:', StringUtils.stripHtml(htmlText));

const markdown = '**Bold** and *italic* text';
console.log('Stripped Markdown:', StringUtils.stripMarkdown(markdown));

// Levenshtein distance for fuzzy matching
const similarity = StringUtils.similarity('hello', 'hallo');
console.log('Similarity (hello vs hallo):', similarity);

// Case conversions
console.log('camelCase:', StringUtils.toCamelCase('hello-world-example'));
console.log('snake_case:', StringUtils.toSnakeCase('helloWorldExample'));
console.log('kebab-case:', StringUtils.toKebabCase('helloWorldExample'));
console.log('Title Case:', StringUtils.toTitleCase('the quick brown fox'));

// Template interpolation with auto-escaping
const template = 'Hello {name}, you have {count} messages';
const result = StringUtils.template(template, { name: 'John', count: 5 });
console.log('Template:', result);

// URL slug generation
console.log('Slug:', StringUtils.slugify('Hello World! This is a Test'));

// Extract URLs and emails
const textWithUrls = 'Visit https://example.com or email user@example.com';
console.log('URLs:', StringUtils.extractUrls(textWithUrls));
console.log('Emails:', StringUtils.extractEmails(textWithUrls));

// Random string generation
console.log('Random string:', StringUtils.random(10, { symbols: true }));

console.log('');

// ============================================================================
// DOM UTILITIES (Browser only - showing API)
// ============================================================================
console.log('--- DOM Utilities (Browser APIs) ---');

// These would work in a browser environment:
/*
// Create element safely
const button = DOMUtils.createElement('button', {
  attrs: { id: 'myButton', class: 'btn btn-primary' },
  text: 'Click Me',
  style: { padding: '10px', backgroundColor: 'blue' },
  data: { action: 'submit' }
});

// Query elements
const element = DOMUtils.query('.my-class');
const elements = DOMUtils.queryAll('.item');

// Event handling with delegation
const cleanup = DOMUtils.on(document, 'click', '.button', (e) => {
  console.log('Button clicked');
});

// Debounce and throttle
const debouncedSearch = DOMUtils.debounce((query) => {
  console.log('Searching:', query);
}, 300);

const throttledScroll = DOMUtils.throttle(() => {
  console.log('Scroll event');
}, 100);

// Smooth scroll
DOMUtils.scrollTo({ target: '#section2', offset: -50 });

// Visibility detection
const isVisible = await DOMUtils.isVisible(element);

// Class manipulation
DOMUtils.addClass(element, 'active', 'highlight');
DOMUtils.removeClass(element, 'inactive');
DOMUtils.toggleClass(element, 'expanded');
*/

console.log('DOM utilities provide browser-safe manipulation methods');
console.log('See domUtils.js for full API documentation\n');

// ============================================================================
// STORAGE MANAGER
// ============================================================================
console.log('--- Storage Manager ---');

// Create storage instance (uses in-memory fallback in Node.js)
const storage = new StorageManager({ namespace: 'myApp' });

// Store and retrieve data
storage.set('username', 'john_doe');
storage.set('preferences', { theme: 'dark', language: 'en' });

console.log('Username:', storage.get('username'));
console.log('Preferences:', storage.get('preferences'));

// Store with TTL (time to live)
storage.set('session', { id: '12345' }, { ttl: 3600000 }); // 1 hour

// Bulk operations
storage.setMany({
  setting1: 'value1',
  setting2: 'value2',
  setting3: 'value3'
});

console.log('All keys:', storage.keys());
console.log('Has username:', storage.has('username'));

// Scoped storage
const userStorage = storage.scope('user');
userStorage.set('profile', { name: 'John', age: 30 });

// Export and import
const backup = storage.export();
console.log('Exported data (first 100 chars):', backup.substring(0, 100) + '...');

console.log('');

// ============================================================================
// DATA STRUCTURES
// ============================================================================
console.log('--- Data Structures ---');

// LRU Cache
console.log('LRU Cache:');
const cache = new LRUCache(3);
cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);
console.log('  Cache size:', cache.size);
cache.set('d', 4); // This will evict 'a'
console.log('  Has "a" (should be false):', cache.has('a'));
console.log('  Keys:', cache.keys());

// Queue
console.log('\nQueue:');
const queue = new Queue();
queue.enqueue('task1').enqueue('task2').enqueue('task3');
console.log('  Queue size:', queue.size);
console.log('  Dequeue:', queue.dequeue());
console.log('  Peek:', queue.peek());

// Circular Buffer
console.log('\nCircular Buffer:');
const buffer = new CircularBuffer(3);
buffer.push('item1');
buffer.push('item2');
buffer.push('item3');
buffer.push('item4'); // Overwrites 'item1'
console.log('  Buffer contents:', buffer.toArray());
console.log('  Most recent:', buffer.peek());

// Trie (for autocomplete)
console.log('\nTrie (autocomplete):');
const trie = new Trie();
trie.insert('hello');
trie.insert('help');
trie.insert('helper');
trie.insert('world');
console.log('  Search "hello":', trie.search('hello'));
console.log('  Search "hel":', trie.search('hel'));
console.log('  Starts with "hel":', trie.startsWith('hel'));
console.log('  Words with prefix "hel":', trie.getAllWithPrefix('hel'));

console.log('');

// ============================================================================
// ASYNC UTILITIES
// ============================================================================
console.log('--- Async Utilities ---');

(async () => {
  // Sleep/delay
  console.log('Sleeping for 100ms...');
  await AsyncUtils.sleep(100);
  console.log('Done sleeping');

  // Retry with exponential backoff
  let attemptCount = 0;
  const unstableOperation = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error('Temporary failure');
    }
    return 'Success!';
  };

  const retryResult = await AsyncUtils.retry(unstableOperation, {
    maxAttempts: 5,
    delay: 50,
    onRetry: (attempt, error) => {
      console.log(`  Retry attempt ${attempt}: ${error.message}`);
    }
  });
  console.log('Retry result:', retryResult);

  // Timeout
  const slowOperation = () => AsyncUtils.sleep(200).then(() => 'Completed');
  try {
    await AsyncUtils.timeout(slowOperation(), 100, 'Too slow!');
  } catch (error) {
    console.log('Timeout error:', error.message);
  }

  // Sequential execution
  const sequential = await AsyncUtils.sequential([
    async (n) => n + 1,
    async (n) => n * 2,
    async (n) => n - 3
  ], 5);
  console.log('Sequential result (5 + 1) * 2 - 3 =', sequential);

  // Batch processing
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const batchResults = await AsyncUtils.batch(
    items,
    async (batch) => batch.map(x => x * 2),
    {
      batchSize: 3,
      onProgress: (processed, total) => {
        console.log(`  Batch progress: ${processed}/${total}`);
      }
    }
  );
  console.log('Batch results:', batchResults);

  // Async map with concurrency
  const mapped = await AsyncUtils.map(
    [1, 2, 3, 4, 5],
    async (n) => {
      await AsyncUtils.sleep(10);
      return n * 2;
    },
    2 // Max 2 concurrent operations
  );
  console.log('Async map result:', mapped);

  // Memoization
  let callCount = 0;
  const expensiveOperation = AsyncUtils.memoize(
    async (n) => {
      callCount++;
      await AsyncUtils.sleep(10);
      return n * 2;
    },
    { ttl: 5000 }
  );

  await expensiveOperation(5);
  await expensiveOperation(5); // Cached
  console.log('Memoized calls (should be 1):', callCount);

  console.log('');

  // ============================================================================
  // VECTOR DISTANCE (from existing module)
  // ============================================================================
  console.log('--- Vector Distance ---');

  const vec1 = [1, 2, 3, 4, 5];
  const vec2 = [2, 4, 6, 8, 10];
  const vec3 = [1, 1, 1, 1, 1];

  console.log('Cosine similarity (vec1 vs vec2):', Cosine.similarity(vec1, vec2).toFixed(4));
  console.log('Cosine similarity (vec1 vs vec3):', Cosine.similarity(vec1, vec3).toFixed(4));

  // K-nearest neighbors
  const query = [1.5, 2.5, 3.5, 4.5, 5.5];
  const vectors = [vec1, vec2, vec3];
  const nearest = Cosine.kNearest(query, vectors, 2);
  console.log('K-nearest neighbors:', nearest);

  console.log('\n=== All Examples Complete ===');
})();
