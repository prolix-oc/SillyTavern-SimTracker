# ST-Helpers

A collection of high-performance JavaScript utility modules for SillyTavern UI extensions. All modules use pure JavaScript with no external dependencies, designed to be platform-agnostic and easy to integrate.

## Modules

1. **[vectorDistance.js](#vector-distance-module)** - Vector similarity and distance calculations (Cosine, Jaccard, Hamming)
2. **[stringUtils.js](#string-utilities-module)** - Text processing, manipulation, and fuzzy matching
3. **[domUtils.js](#dom-utilities-module)** - Browser-safe DOM manipulation without jQuery
4. **[storageManager.js](#storage-manager-module)** - Type-safe persistent storage with TTL and namespacing
5. **[dataStructures.js](#data-structures-module)** - Efficient data structures (LRU Cache, Trie, Queue, etc.)
6. **[asyncUtils.js](#async-utilities-module)** - Modern async/await helpers and utilities

---

# Vector Distance Module

A high-performance JavaScript module for calculating vector distances using pure mathematical implementations.

## Features

- **Three Core Distance Algorithms:**
  - **Jaccard Distance** - Set-based similarity for binary/sparse vectors
  - **Hamming Distance** - Element-wise difference counting
  - **Cosine Similarity/Distance** - Direction-based similarity for continuous vectors

- **Pure JavaScript** - No external packages required
- **Efficient Matrix Operations** - Batch processing and pairwise calculations
- **K-Nearest Neighbors** - Built-in search functionality
- **Utility Functions** - Vector validation, normalization, and more

## Installation

Simply copy `vectorDistance.js` into your project directory.

```javascript
// ES6 import
import { Jaccard, Hamming, Cosine, DocumentSearch, Utils } from './vectorDistance.js';
```

## Quick Start

### High-Level Document Search API (Recommended)

The simplest way to perform semantic search with automatic scoring and ranking:

```javascript
import { DocumentSearch } from './vectorDistance.js';

const docSearch = DocumentSearch.search({
  message: [0.88, 0.74, 0.11, 0.44, 0.15, 0.92, 0.30],  // Query embedding
  documents: [
    {
      documentText: "Machine learning focuses on data-driven algorithms.",
      embeddingArray: [0.85, 0.72, 0.15, 0.42, 0.18, 0.91, 0.33]
    },
    {
      documentText: "The best chocolate chip cookie recipe.",
      embeddingArray: [0.12, 0.08, 0.89, 0.15, 0.76, 0.11, 0.82]
    }
  ],
  algorithm: 'cosine',  // 'cosine', 'jaccard', or 'hamming'
  top_k: 5              // Optional: return only top 5 results
});

// Results are automatically sorted by score (higher = better match)
docSearch.results.forEach(result => {
  console.log(`Score: ${result.score}, Text: ${result.resultText}`);
});
```

### Low-Level APIs

For direct algorithm access:

### Cosine Similarity (Most Common)

```javascript
const vec1 = [1, 2, 3, 4, 5];
const vec2 = [2, 4, 6, 8, 10];

const similarity = Cosine.similarity(vec1, vec2);
// Returns: 1.0 (perfectly aligned, same direction)

const distance = Cosine.distance(vec1, vec2);
// Returns: 0.0 (very similar)
```

### Jaccard Distance (Binary/Sparse Data)

```javascript
const vec1 = [1, 1, 0, 0, 1, 0];
const vec2 = [1, 0, 0, 1, 1, 0];

const similarity = Jaccard.similarity(vec1, vec2);
// Returns: 0.5 (50% overlap)

const distance = Jaccard.distance(vec1, vec2);
// Returns: 0.5
```

### Hamming Distance (Exact Matching)

```javascript
const vec1 = [1, 0, 1, 1, 0, 1, 0, 0];
const vec2 = [1, 0, 0, 1, 1, 1, 0, 1];

const distance = Hamming.distance(vec1, vec2);
// Returns: 3 (three positions differ)

const normalized = Hamming.normalizedDistance(vec1, vec2);
// Returns: 0.375 (3/8 = 37.5%)
```

## API Reference

### DocumentSearch (High-Level API)

#### `DocumentSearch.search(params)`

Performs semantic search with automatic scoring, sorting, and optional top-k filtering.

**Parameters:**
- `params.message` (Array<number>, required): Query embedding vector
- `params.documents` (Array<Object>, required): Array of documents to search
  - `documents[].documentText` (string): The text content of the document
  - `documents[].embeddingArray` (Array<number>): The embedding vector
- `params.algorithm` (string, required): Algorithm to use: `'cosine'`, `'jaccard'`, or `'hamming'`
- `params.top_k` (number, optional): Return only top k results (omit for all results)
- `params.threshold` (number, optional): Threshold for Jaccard binarization (default: 0)
- `params.normalized` (boolean, optional): Use normalized Hamming distance (default: true)
- `params.suppressWarnings` (boolean, optional): Suppress compatibility warnings (default: false)

**Returns:**
```javascript
{
  results: [
    { resultText: string, score: number },
    // ... sorted by score (descending)
  ],
  algorithm: string,
  warning: string | null,
  totalDocuments: number,
  returnedDocuments: number
}
```

**Algorithm Selection Guide:**
- **Cosine**: Use for CONTINUOUS embeddings (neural networks, transformers, word2vec)
  - ✓ Most common for modern semantic search
  - ✓ Best for dense embeddings from ML models
- **Jaccard**: Use for BINARY vectors (0s and 1s only)
  - ✓ Best for set-based comparisons, tags, categories
  - ⚠️ Thresholds continuous values, losing precision
- **Hamming**: Use for BINARY or QUANTIZED discrete vectors
  - ✓ Best for hash codes, binary fingerprints
  - ⚠️ Not suitable for continuous embeddings

**Example:**
```javascript
const results = DocumentSearch.search({
  message: queryEmbedding,
  documents: [
    { documentText: "AI research", embeddingArray: [0.8, 0.6, ...] },
    { documentText: "Cooking tips", embeddingArray: [0.1, 0.2, ...] }
  ],
  algorithm: 'cosine',
  top_k: 10
});

if (results.warning) {
  console.warn(results.warning);
}

results.results.forEach(({ resultText, score }) => {
  console.log(`${score.toFixed(4)}: ${resultText}`);
});
```

### Jaccard Distance

#### `Jaccard.similarity(vecA, vecB, threshold = 0)`
Calculate Jaccard similarity between two vectors.
- **Formula:** |A ∩ B| / |A ∪ B|
- **Returns:** Number between 0 and 1 (higher = more similar)
- **threshold:** Values above threshold are treated as 1, below as 0

#### `Jaccard.distance(vecA, vecB, threshold = 0)`
Calculate Jaccard distance (1 - similarity).
- **Returns:** Number between 0 and 1 (lower = more similar)

#### `Jaccard.pairwiseDistance(matrixA, matrixB, threshold = 0)`
Calculate pairwise distances between two matrices.
- **Returns:** 2D array of distances

#### `Jaccard.kNearest(query, vectors, k, threshold = 0)`
Find k nearest neighbors using Jaccard distance.
- **Returns:** Array of `{index, distance}` objects

### Hamming Distance

#### `Hamming.distance(vecA, vecB, tolerance = 1e-10)`
Count positions where elements differ.
- **Returns:** Integer count of differences
- **tolerance:** Floating-point comparison tolerance

#### `Hamming.normalizedDistance(vecA, vecB, tolerance = 1e-10)`
Hamming distance divided by vector length.
- **Returns:** Number between 0 and 1

#### `Hamming.pairwiseDistance(matrixA, matrixB, normalized = false, tolerance = 1e-10)`
Calculate pairwise Hamming distances.
- **Returns:** 2D array of distances

#### `Hamming.kNearest(query, vectors, k, normalized = false, tolerance = 1e-10)`
Find k nearest neighbors using Hamming distance.
- **Returns:** Array of `{index, distance}` objects

### Cosine Similarity/Distance

#### `Cosine.similarity(vecA, vecB)`
Calculate cosine of angle between vectors.
- **Formula:** (A · B) / (||A|| × ||B||)
- **Returns:** Number between -1 and 1 (1 = same direction, -1 = opposite, 0 = orthogonal)

#### `Cosine.distance(vecA, vecB)`
Calculate cosine distance (1 - similarity).
- **Returns:** Number between 0 and 2 (lower = more similar)

#### `Cosine.angularDistance(vecA, vecB)`
Calculate angle between vectors in radians.
- **Returns:** Number between 0 and π

#### `Cosine.pairwiseDistance(matrixA, matrixB)`
Calculate pairwise cosine distances.
- **Returns:** 2D array of distances

#### `Cosine.pairwiseSimilarity(matrixA, matrixB)`
Calculate pairwise cosine similarities.
- **Returns:** 2D array of similarities

#### `Cosine.kNearest(query, vectors, k)`
Find k nearest neighbors using cosine distance.
- **Returns:** Array of `{index, distance, similarity}` objects

#### `Cosine.batchSimilarity(query, vectors)`
Optimized batch similarity calculation.
- **Returns:** Array of similarity scores

### Utility Functions

#### `Utils.isValidVector(vec)`
Validate that input is a valid 1D array of numbers.
- **Returns:** Boolean

#### `Utils.isValidMatrix(matrix)`
Validate that input is a valid 2D array of numbers.
- **Returns:** Boolean

#### `Utils.normalize(vec)`
Normalize vector to unit length (L2 normalization).
- **Returns:** Normalized vector array

#### `Utils.topK(arr, k, descending = true)`
Find indices of top k values.
- **Returns:** Array of `{index, value}` objects

## Use Cases

### Semantic Search

```javascript
// Find similar documents based on embeddings
const query = [0.85, 0.7, 0.1, 0.4, 0.1];
const documents = [
  [0.8, 0.6, 0.1, 0.3, 0.2],   // Similar
  [0.1, 0.1, 0.9, 0.2, 0.8],   // Different
  [0.75, 0.65, 0.15, 0.35, 0.15]  // Very similar
];

const results = Cosine.kNearest(query, documents, 2);
// Returns top 2 most similar documents
```

### Duplicate Detection

```javascript
// Find near-duplicate items using Hamming distance
const item = [1, 0, 1, 1, 0, 1, 0, 0];
const database = [
  [1, 0, 1, 1, 0, 1, 0, 0],  // Exact match
  [1, 0, 1, 1, 0, 1, 0, 1],  // 1 bit different
  [0, 1, 0, 0, 1, 0, 1, 1]   // Very different
];

const duplicates = Hamming.kNearest(item, database, 2);
// Find 2 nearest matches
```

### Clustering & Similarity Analysis

```javascript
// Compare all vectors to each other
const vectors = [
  [1, 2, 3],
  [2, 4, 6],
  [1, 1, 1]
];

const similarityMatrix = Cosine.pairwiseSimilarity(vectors, vectors);
// Create full similarity matrix for clustering
```

### Binary Feature Matching

```javascript
// Match binary feature vectors (e.g., tags, categories)
const userPrefs = [1, 0, 1, 1, 0];  // Likes: action, sci-fi, not romance
const item1 = [1, 1, 1, 0, 0];      // Action, adventure, sci-fi
const item2 = [0, 1, 0, 0, 1];      // Adventure, romance

const match1 = Jaccard.similarity(userPrefs, item1);  // Higher match
const match2 = Jaccard.similarity(userPrefs, item2);  // Lower match
```

## Algorithm Details

### Jaccard Distance
- **Best for:** Binary/sparse vectors, set comparisons
- **Time Complexity:** O(n) where n is vector length
- **Space Complexity:** O(1)
- **Use when:** Comparing presence/absence of features (tags, categories, binary attributes)

### Hamming Distance
- **Best for:** Binary vectors, exact position matching
- **Time Complexity:** O(n) where n is vector length
- **Space Complexity:** O(1)
- **Use when:** Comparing exact matches at each position (checksums, error detection)

### Cosine Similarity
- **Best for:** Continuous vectors, embeddings, direction comparison
- **Time Complexity:** O(n) where n is vector length
- **Space Complexity:** O(1)
- **Use when:** Comparing semantic meaning, embeddings, or when magnitude doesn't matter
- **Note:** Robust to vector magnitude differences

## Performance Tips

1. **Use batch operations** for multiple comparisons:
   ```javascript
   // Good: Single call for multiple comparisons
   const distances = Cosine.pairwiseDistance(matrixA, matrixB);
   
   // Avoid: Multiple individual calls
   // for (let i = 0; i < matrixA.length; i++) {
   //   for (let j = 0; j < matrixB.length; j++) {
   //     Cosine.distance(matrixA[i], matrixB[j]);
   //   }
   // }
   ```

2. **Pre-normalize vectors** when doing many cosine comparisons:
   ```javascript
   const normalized = Utils.normalize(vector);
   // Use normalized vectors for multiple comparisons
   ```

3. **Choose the right algorithm:**
   - Cosine: Semantic similarity, embeddings
   - Jaccard: Set overlap, sparse binary data
   - Hamming: Exact position matching, checksums

## Mathematical Formulas

### Jaccard Similarity
```
J(A, B) = |A ∩ B| / |A ∪ B|
```

### Hamming Distance
```
H(A, B) = Σ(aᵢ ≠ bᵢ)
```

### Cosine Similarity
```
cos(θ) = (A · B) / (||A|| × ||B||)
where:
  A · B = Σ(aᵢ × bᵢ)
  ||A|| = √Σ(aᵢ²)
```

## Examples

Run the included examples files:

### Low-Level Algorithm Examples
```bash
node examples.js
```

Demonstrates:
- Basic usage of all three algorithms
- K-nearest neighbors search
- Pairwise distance calculations
- Batch operations
- Utility functions
- Practical semantic search example

### High-Level Document Search Examples
```bash
node documentSearchExample.js
```

Demonstrates:
- DocumentSearch API usage with all three algorithms
- Automatic scoring and ranking
- Top-k filtering
- Compatibility warnings
- Error handling
- Binary vs continuous vector handling

## Error Handling

All functions validate input and throw descriptive errors:

```javascript
// Vectors must have equal length
Cosine.similarity([1, 2], [1, 2, 3]);
// Error: Vectors must have equal length

// Validates number types
Utils.isValidVector([1, 2, "three"]);
// Returns: false
```

## Browser Compatibility

Works in all modern JavaScript environments:
- Node.js (all versions)
- Modern browsers (ES6+)
- SillyTavern UI extensions
- Browser extensions

No polyfills or transpilation required for ES6+ environments.

## License

ISC

---

# String Utilities Module

Text processing and manipulation utilities for chat interfaces.

## Features

- Text truncation with word boundaries
- HTML/Markdown stripping
- Levenshtein distance for fuzzy matching
- Case conversions (camelCase, snake_case, kebab-case, Title Case)
- Template string interpolation with XSS protection
- URL and email extraction
- String validation and generation

## Installation

```javascript
// ES6 import
import StringUtils from './stringUtils.js';
```

## Quick Examples

```javascript
// Smart truncation
StringUtils.truncate('Hello world', 8); // 'Hello...'

// Strip HTML/Markdown
StringUtils.stripHtml('<p>Hello <b>world</b></p>'); // 'Hello world'
StringUtils.stripMarkdown('**Bold** and *italic*'); // 'Bold and italic'

// Fuzzy string matching
StringUtils.similarity('hello', 'hallo'); // 0.8

// Case conversions
StringUtils.toCamelCase('hello-world'); // 'helloWorld'
StringUtils.toSnakeCase('helloWorld'); // 'hello_world'
StringUtils.toKebabCase('helloWorld'); // 'hello-world'

// Safe template interpolation
StringUtils.template('Hello {name}!', { name: 'World' }); // 'Hello World!'

// URL slug generation
StringUtils.slugify('Hello World!'); // 'hello-world'

// Extract URLs and emails
StringUtils.extractUrls('Visit https://example.com'); // ['https://example.com']
StringUtils.extractEmails('Contact: user@example.com'); // ['user@example.com']
```

See `stringUtils.js` for full API documentation.

---

# DOM Utilities Module

Browser-safe DOM manipulation without jQuery.

## Features

- Safe element creation with XSS protection
- Event delegation support
- Debounce and throttle functions
- CSS class manipulation
- Smooth scrolling
- Intersection Observer wrapper for visibility detection
- Query caching for performance

## Installation

```javascript
// ES6 import
import DOMUtils from './domUtils.js';
```

## Quick Examples

```javascript
// Create element safely
const button = DOMUtils.createElement('button', {
  attrs: { id: 'myButton', class: 'btn' },
  text: 'Click Me',
  style: { padding: '10px' },
  data: { action: 'submit' }
});

// Query elements
const element = DOMUtils.query('.my-class');
const elements = DOMUtils.queryAll('.item');

// Event delegation
DOMUtils.on(document, 'click', '.button', (e) => {
  console.log('Button clicked');
});

// Debounce and throttle
const debouncedSearch = DOMUtils.debounce((query) => {
  console.log('Searching:', query);
}, 300);

// Smooth scroll
DOMUtils.scrollTo({ target: '#section2', offset: -50 });

// Class manipulation
DOMUtils.addClass(element, 'active');
DOMUtils.toggleClass(element, 'expanded');

// Visibility detection
const isVisible = await DOMUtils.isVisible(element);
```

See `domUtils.js` for full API documentation.

---

# Storage Manager Module

Type-safe persistent storage with advanced features.

## Features

- localStorage/sessionStorage wrapper with type safety
- Automatic JSON serialization/deserialization
- Namespace isolation to prevent key collisions
- TTL (Time To Live) support for automatic expiration
- Storage quota detection and management
- Import/export functionality
- In-memory fallback when storage unavailable
- Bulk operations

## Installation

```javascript
// ES6 import
import { StorageManager, createStorage, createSessionStorage } from './storageManager.js';
// Or use default export
import StorageManager from './storageManager.js';
```

## Quick Examples

```javascript
// Create storage instance
const storage = new StorageManager({ namespace: 'myApp' });

// Store and retrieve data
storage.set('username', 'john_doe');
storage.set('preferences', { theme: 'dark', language: 'en' });

console.log(storage.get('username')); // 'john_doe'
console.log(storage.get('preferences')); // { theme: 'dark', language: 'en' }

// Store with TTL (expires after 1 hour)
storage.set('session', { id: '12345' }, { ttl: 3600000 });

// Bulk operations
storage.setMany({
  setting1: 'value1',
  setting2: 'value2'
});

// Check existence
if (storage.has('username')) {
  // Do something
}

// Get all keys
const keys = storage.keys();

// Scoped storage
const userStorage = storage.scope('user');
userStorage.set('profile', { name: 'John' });

// Export and import
const backup = storage.export();
storage.import(backup, true); // merge with existing

// Watch for changes (browser only)
const stopWatching = storage.watch('theme', (newTheme) => {
  console.log('Theme changed:', newTheme);
});
```

See `storageManager.js` for full API documentation.

---

# Data Structures Module

Efficient data structures for common patterns.

## Features

- **LRU Cache** - Perfect for caching chat messages or API responses
- **Queue & Priority Queue** - FIFO and priority-based processing
- **Circular Buffer** - Fixed-size history with automatic overflow handling
- **Trie** - Efficient autocomplete and prefix matching
- **Bloom Filter** - Space-efficient probabilistic membership testing
- **Bidirectional Map** - Two-way key-value lookups
- **Set Operations** - Union, intersection, difference, etc.

## Installation

```javascript
// ES6 import
import { LRUCache, Queue, PriorityQueue, CircularBuffer, Trie, BloomFilter, BiMap, SetOps } from './dataStructures.js';
```

## Quick Examples

```javascript
// LRU Cache
const cache = new LRUCache(100);
cache.set('key1', 'value1');
const value = cache.get('key1');

// Queue
const queue = new Queue();
queue.enqueue('task1');
const task = queue.dequeue();

// Circular Buffer (for chat history)
const buffer = new CircularBuffer(50);
buffer.push('message1');
const recent = buffer.peek();

// Trie (for autocomplete)
const trie = new Trie();
trie.insert('hello');
trie.insert('help');
const suggestions = trie.getAllWithPrefix('hel'); // ['hello', 'help']

// Priority Queue
const pq = new PriorityQueue((a, b) => b.priority - a.priority);
pq.enqueue({ task: 'urgent', priority: 10 });
pq.enqueue({ task: 'normal', priority: 5 });

// Bloom Filter
const filter = new BloomFilter(1000, 3);
filter.add('item1');
if (filter.has('item1')) {
  // Probably exists
}

// Bidirectional Map
const bimap = new BiMap();
bimap.set('key', 'value');
bimap.getKey('value'); // 'key'

// Set Operations
const set1 = new Set([1, 2, 3]);
const set2 = new Set([2, 3, 4]);
SetOps.union(set1, set2); // Set([1, 2, 3, 4])
SetOps.intersection(set1, set2); // Set([2, 3])
```

See `dataStructures.js` for full API documentation.

---

# Async Utilities Module

Modern async/await helpers for API calls and async operations.

## Features

- Promise retry with exponential backoff
- Timeout wrapper for promises
- Sequential and parallel execution with concurrency control
- Rate limiting
- Batch processing with progress tracking
- Cancelable promises
- Debounce and throttle for async functions
- Async queue for ordered execution
- Memoization with TTL
- Polling with conditions
- Async array operations (map, filter, reduce)

## Installation

```javascript
// ES6 import
import AsyncUtils from './asyncUtils.js';
```

## Quick Examples

```javascript
// Sleep/delay
await AsyncUtils.sleep(1000);

// Retry with exponential backoff
const result = await AsyncUtils.retry(
  () => fetch('/api/data'),
  { maxAttempts: 5, delay: 500, backoffFactor: 2 }
);

// Add timeout to promise
const data = await AsyncUtils.timeout(
  fetch('/api/slow-endpoint'),
  5000 // 5 second timeout
);

// Sequential execution
const result = await AsyncUtils.sequential([
  async (data) => data + 1,
  async (data) => data * 2
], 5); // Returns 12

// Batch processing with progress
const results = await AsyncUtils.batch(
  items,
  async (batch) => processBatch(batch),
  {
    batchSize: 10,
    delay: 100,
    onProgress: (processed, total) => {
      console.log(`Progress: ${processed}/${total}`);
    }
  }
);

// Rate limiting
const limiter = AsyncUtils.rateLimiter(5, 1000); // 5 calls per second
await limiter.execute(() => fetch('/api/data'));

// Cancelable promise
const { promise, cancel } = AsyncUtils.cancelable((resolve, reject, onCancel) => {
  const timeout = setTimeout(resolve, 5000);
  onCancel(() => clearTimeout(timeout));
});
// Later: cancel();

// Memoization with TTL
const memoizedFetch = AsyncUtils.memoize(
  async (url) => fetch(url).then(r => r.json()),
  { ttl: 60000 }
);

// Polling until condition met
const result = await AsyncUtils.poll(
  () => fetch('/api/status'),
  (status) => status.complete === true,
  { interval: 500, maxAttempts: 20 }
);

// Async map with concurrency limit
const results = await AsyncUtils.map(
  [1, 2, 3, 4, 5],
  async (n) => processItem(n),
  2 // Max 2 concurrent operations
);
```

See `asyncUtils.js` for full API documentation.

---

## Running Examples

Each module has its own example file demonstrating its features:

```bash
# String Utilities examples
node examples/stringUtilsExample.js

# Storage Manager examples
node examples/storageManagerExample.js

# Data Structures examples
node examples/dataStructuresExample.js

# Async Utilities examples
node examples/asyncUtilsExample.js

# Vector Distance examples
node examples/rawVectorDistance.js
node examples/documentSearchExample.js

# All modules combined (comprehensive overview)
node examples/allModulesExample.js
```

## Contributing

All modules are designed to be dependency-free and self-contained. They use pure JavaScript and native APIs only.
