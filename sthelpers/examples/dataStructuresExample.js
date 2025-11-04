/**
 * Data Structures Example
 * Demonstrates efficient data structures for common patterns
 */

const { 
  LRUCache, 
  Queue, 
  PriorityQueue, 
  CircularBuffer, 
  Trie, 
  BloomFilter, 
  BiMap, 
  SetOps 
} = require('../dataStructures');

console.log('=== Data Structures Examples ===\n');

// ============================================================================
// LRU CACHE
// ============================================================================
console.log('--- LRU Cache (Least Recently Used) ---');
const cache = new LRUCache(3); // Capacity of 3

cache.set('page1', 'Content 1');
cache.set('page2', 'Content 2');
cache.set('page3', 'Content 3');
console.log('Cache size:', cache.size);
console.log('Keys:', cache.keys());

// Access page1 (makes it most recently used)
console.log('Get page1:', cache.get('page1'));

// Add new item - this will evict page2 (least recently used)
cache.set('page4', 'Content 4');
console.log('After adding page4:');
console.log('Keys:', cache.keys());
console.log('Has page2 (should be false):', cache.has('page2'));
console.log('');

// ============================================================================
// QUEUE (FIFO)
// ============================================================================
console.log('--- Queue (FIFO - First In First Out) ---');
const queue = new Queue();

queue.enqueue('Task 1')
     .enqueue('Task 2')
     .enqueue('Task 3');

console.log('Queue size:', queue.size);
console.log('Peek (first item):', queue.peek());
console.log('Dequeue:', queue.dequeue());
console.log('Dequeue:', queue.dequeue());
console.log('Remaining size:', queue.size);
console.log('Queue as array:', queue.toArray());
console.log('');

// ============================================================================
// PRIORITY QUEUE
// ============================================================================
console.log('--- Priority Queue ---');
// Higher priority number = higher priority
const pq = new PriorityQueue((a, b) => b.priority - a.priority);

pq.enqueue({ task: 'Low priority task', priority: 1 });
pq.enqueue({ task: 'High priority task', priority: 10 });
pq.enqueue({ task: 'Medium priority task', priority: 5 });

console.log('Queue size:', pq.size);
console.log('Dequeue (highest priority):', pq.dequeue());
console.log('Dequeue (next highest):', pq.dequeue());
console.log('Dequeue (lowest):', pq.dequeue());
console.log('');

// ============================================================================
// CIRCULAR BUFFER
// ============================================================================
console.log('--- Circular Buffer (Ring Buffer) ---');
const buffer = new CircularBuffer(5); // Max 5 items

// Add items
for (let i = 1; i <= 7; i++) {
  const overwritten = buffer.push(`Message ${i}`);
  if (overwritten) {
    console.log(`Added Message ${i}, overwritten: ${overwritten}`);
  }
}

console.log('Buffer size:', buffer.size);
console.log('Buffer contents:', buffer.toArray());
console.log('Most recent:', buffer.peek());
console.log('Oldest:', buffer.get(0));
console.log('Is full:', buffer.isFull());
console.log('');

// ============================================================================
// TRIE (PREFIX TREE)
// ============================================================================
console.log('--- Trie (for Autocomplete) ---');
const trie = new Trie();

// Build dictionary
const words = ['hello', 'help', 'helper', 'world', 'word', 'work', 'worker'];
words.forEach(word => trie.insert(word));

console.log('Dictionary:', words);
console.log('');

// Search operations
console.log('Search "hello":', trie.search('hello'));
console.log('Search "hel" (not a complete word):', trie.search('hel'));
console.log('Starts with "hel":', trie.startsWith('hel'));
console.log('Starts with "wor":', trie.startsWith('wor'));
console.log('');

// Autocomplete
console.log('Autocomplete "hel":', trie.getAllWithPrefix('hel'));
console.log('Autocomplete "wor":', trie.getAllWithPrefix('wor'));
console.log('Autocomplete "xyz":', trie.getAllWithPrefix('xyz'));
console.log('');

// Delete
trie.delete('helper');
console.log('After deleting "helper":', trie.getAllWithPrefix('hel'));
console.log('');

// ============================================================================
// BLOOM FILTER
// ============================================================================
console.log('--- Bloom Filter (Probabilistic Set) ---');
const filter = new BloomFilter(1000, 3);

// Add items
const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
items.forEach(item => filter.add(item));

console.log('Added items:', items);
console.log('');

// Check membership
console.log('Has "apple":', filter.has('apple'));
console.log('Has "banana":', filter.has('banana'));
console.log('Has "grape" (not added):', filter.has('grape'));
console.log('Has "orange" (not added):', filter.has('orange'));
console.log('');
console.log('Note: Bloom filters may have false positives but never false negatives');
console.log('');

// ============================================================================
// BIDIRECTIONAL MAP
// ============================================================================
console.log('--- Bidirectional Map (BiMap) ---');
const bimap = new BiMap();

bimap.set('user1', 'john@example.com');
bimap.set('user2', 'jane@example.com');
bimap.set('user3', 'bob@example.com');

console.log('Get by key "user1":', bimap.get('user1'));
console.log('Get key by value "jane@example.com":', bimap.getKey('jane@example.com'));
console.log('');

console.log('Has key "user2":', bimap.has('user2'));
console.log('Has value "bob@example.com":', bimap.hasValue('bob@example.com'));
console.log('');

console.log('All keys:', bimap.keys());
console.log('All values:', bimap.values());
console.log('Size:', bimap.size);
console.log('');

// ============================================================================
// SET OPERATIONS
// ============================================================================
console.log('--- Set Operations ---');
const setA = new Set([1, 2, 3, 4, 5]);
const setB = new Set([4, 5, 6, 7, 8]);

console.log('Set A:', Array.from(setA));
console.log('Set B:', Array.from(setB));
console.log('');

console.log('Union:', Array.from(SetOps.union(setA, setB)));
console.log('Intersection:', Array.from(SetOps.intersection(setA, setB)));
console.log('Difference (A - B):', Array.from(SetOps.difference(setA, setB)));
console.log('Difference (B - A):', Array.from(SetOps.difference(setB, setA)));
console.log('Symmetric Difference:', Array.from(SetOps.symmetricDifference(setA, setB)));
console.log('');

const setC = new Set([1, 2]);
const setD = new Set([1, 2, 3, 4, 5]);
console.log('Set C:', Array.from(setC));
console.log('Set D:', Array.from(setD));
console.log('Is C subset of D?', SetOps.isSubset(setC, setD));
console.log('Is D superset of C?', SetOps.isSuperset(setD, setC));
console.log('');

const setE = new Set([10, 11, 12]);
console.log('Set E:', Array.from(setE));
console.log('Are A and E disjoint?', SetOps.isDisjoint(setA, setE));
console.log('Are A and B disjoint?', SetOps.isDisjoint(setA, setB));
console.log('');

// ============================================================================
// PRACTICAL USE CASES
// ============================================================================
console.log('--- Practical Use Cases ---');

// Use case 1: Message cache for chat
console.log('Use Case 1: Message Cache');
const messageCache = new LRUCache(100);
messageCache.set('msg1', { text: 'Hello', timestamp: Date.now() });
messageCache.set('msg2', { text: 'World', timestamp: Date.now() });
console.log('Cached messages:', messageCache.size);
console.log('');

// Use case 2: Command history
console.log('Use Case 2: Command History');
const commandHistory = new CircularBuffer(10);
commandHistory.push('/help');
commandHistory.push('/status');
commandHistory.push('/clear');
console.log('Recent commands:', commandHistory.toArray());
console.log('');

// Use case 3: Task queue
console.log('Use Case 3: Task Queue with Priorities');
const taskQueue = new PriorityQueue((a, b) => b.priority - a.priority);
taskQueue.enqueue({ name: 'Process payment', priority: 10 });
taskQueue.enqueue({ name: 'Send email', priority: 5 });
taskQueue.enqueue({ name: 'Update cache', priority: 3 });
console.log('Next task:', taskQueue.dequeue());
console.log('');

// Use case 4: Command autocomplete
console.log('Use Case 4: Command Autocomplete');
const commandTrie = new Trie();
['/help', '/history', '/clear', '/settings', '/status'].forEach(cmd => 
  commandTrie.insert(cmd)
);
console.log('Commands starting with "/h":', commandTrie.getAllWithPrefix('/h'));
console.log('Commands starting with "/s":', commandTrie.getAllWithPrefix('/s'));
console.log('');

console.log('=== Examples Complete ===');
