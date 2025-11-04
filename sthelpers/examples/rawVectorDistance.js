/**
 * Usage Examples for vectorDistance.js
 * Demonstrates the three distance algorithms: Jaccard, Hamming, and Cosine
 */

const { Jaccard, Hamming, Cosine, Utils } = require('../vectorDistance.js');

console.log('='.repeat(60));
console.log('VECTOR DISTANCE MODULE - USAGE EXAMPLES');
console.log('='.repeat(60));

// ============================================================================
// JACCARD DISTANCE EXAMPLES
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('JACCARD DISTANCE');
console.log('='.repeat(60));

// Example 1: Basic Jaccard similarity
const binaryVec1 = [1, 1, 0, 0, 1, 0, 1, 0];
const binaryVec2 = [1, 0, 0, 1, 1, 0, 0, 1];

console.log('\n--- Example 1: Binary Vector Similarity ---');
console.log('Vector A:', binaryVec1);
console.log('Vector B:', binaryVec2);
console.log('Jaccard Similarity:', Jaccard.similarity(binaryVec1, binaryVec2));
console.log('Jaccard Distance:', Jaccard.distance(binaryVec1, binaryVec2));

// Example 2: Continuous values with threshold
const continuousVec1 = [0.8, 0.3, 0.1, 0.9, 0.2];
const continuousVec2 = [0.7, 0.4, 0.05, 0.1, 0.85];

console.log('\n--- Example 2: Continuous Vectors with Threshold ---');
console.log('Vector A:', continuousVec1);
console.log('Vector B:', continuousVec2);
console.log('Jaccard Distance (threshold=0.5):', Jaccard.distance(continuousVec1, continuousVec2, 0.5));

// Example 3: K-Nearest Neighbors
const jaccardQuery = [1, 1, 0, 1, 0];
const jaccardDatabase = [
  [1, 1, 0, 1, 0],  // Identical
  [1, 0, 0, 1, 1],  // Similar
  [0, 0, 1, 0, 1],  // Different
  [1, 1, 1, 1, 0],  // Somewhat similar
  [0, 0, 0, 0, 0]   // All zeros
];

console.log('\n--- Example 3: K-Nearest Neighbors ---');
console.log('Query:', jaccardQuery);
console.log('Database:', jaccardDatabase);
const jaccardNearest = Jaccard.kNearest(jaccardQuery, jaccardDatabase, 3);
console.log('Top 3 Nearest Neighbors:');
jaccardNearest.forEach((result, i) => {
  console.log(`  ${i + 1}. Index ${result.index}, Distance: ${result.distance.toFixed(4)}`);
});

// Example 4: Pairwise Distance Matrix
const matrixA = [
  [1, 0, 1, 0],
  [0, 1, 0, 1]
];
const matrixB = [
  [1, 0, 0, 1],
  [1, 1, 0, 0],
  [0, 0, 1, 1]
];

console.log('\n--- Example 4: Pairwise Distance Matrix ---');
console.log('Matrix A:', matrixA);
console.log('Matrix B:', matrixB);
const jaccardMatrix = Jaccard.pairwiseDistance(matrixA, matrixB);
console.log('Distance Matrix:');
jaccardMatrix.forEach((row, i) => {
  console.log(`  Row ${i}:`, row.map(d => d.toFixed(4)));
});

// ============================================================================
// HAMMING DISTANCE EXAMPLES
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('HAMMING DISTANCE');
console.log('='.repeat(60));

// Example 1: Basic Hamming distance
const hammingVec1 = [1, 0, 1, 1, 0, 1, 0, 0];
const hammingVec2 = [1, 0, 0, 1, 1, 1, 0, 1];

console.log('\n--- Example 1: Binary Hamming Distance ---');
console.log('Vector A:', hammingVec1);
console.log('Vector B:', hammingVec2);
console.log('Hamming Distance:', Hamming.distance(hammingVec1, hammingVec2));
console.log('Normalized Distance:', Hamming.normalizedDistance(hammingVec1, hammingVec2));

// Example 2: Continuous values
const floatVec1 = [1.5, 2.3, 3.7, 4.2, 5.9];
const floatVec2 = [1.5, 2.4, 3.7, 4.2, 6.0];

console.log('\n--- Example 2: Floating Point Hamming Distance ---');
console.log('Vector A:', floatVec1);
console.log('Vector B:', floatVec2);
console.log('Hamming Distance:', Hamming.distance(floatVec1, floatVec2));
console.log('Normalized Distance:', Hamming.normalizedDistance(floatVec1, floatVec2).toFixed(4));

// Example 3: K-Nearest Neighbors
const hammingQuery = [1, 1, 0, 0, 1, 1, 0, 0];
const hammingDatabase = [
  [1, 1, 0, 0, 1, 1, 0, 0],  // Identical
  [1, 1, 0, 0, 1, 1, 0, 1],  // 1 difference
  [1, 0, 0, 1, 1, 0, 0, 1],  // 3 differences
  [0, 0, 1, 1, 0, 0, 1, 1],  // Completely opposite
  [1, 1, 1, 0, 1, 1, 0, 0]   // 1 difference
];

console.log('\n--- Example 3: K-Nearest Neighbors ---');
console.log('Query:', hammingQuery);
const hammingNearest = Hamming.kNearest(hammingQuery, hammingDatabase, 3, true);
console.log('Top 3 Nearest Neighbors:');
hammingNearest.forEach((result, i) => {
  console.log(`  ${i + 1}. Index ${result.index}, Distance: ${result.distance.toFixed(4)}`);
});

// Example 4: Pairwise Distance
const hammingMatrixA = [
  [1, 0, 1, 0, 1],
  [0, 1, 0, 1, 0]
];
const hammingMatrixB = [
  [1, 0, 1, 0, 0],
  [0, 0, 1, 1, 0],
  [1, 1, 1, 1, 1]
];

console.log('\n--- Example 4: Pairwise Distance Matrix ---');
console.log('Matrix A:', hammingMatrixA);
console.log('Matrix B:', hammingMatrixB);
const hammingMatrix = Hamming.pairwiseDistance(hammingMatrixA, hammingMatrixB, true);
console.log('Normalized Distance Matrix:');
hammingMatrix.forEach((row, i) => {
  console.log(`  Row ${i}:`, row.map(d => d.toFixed(4)));
});

// ============================================================================
// COSINE SIMILARITY/DISTANCE EXAMPLES
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('COSINE SIMILARITY/DISTANCE');
console.log('='.repeat(60));

// Example 1: Basic Cosine similarity
const cosineVec1 = [1, 2, 3, 4, 5];
const cosineVec2 = [2, 4, 6, 8, 10];  // Scaled version (same direction)

console.log('\n--- Example 1: Basic Cosine Similarity ---');
console.log('Vector A:', cosineVec1);
console.log('Vector B:', cosineVec2);
console.log('Cosine Similarity:', Cosine.similarity(cosineVec1, cosineVec2).toFixed(6));
console.log('Cosine Distance:', Cosine.distance(cosineVec1, cosineVec2).toFixed(6));
console.log('Angular Distance (radians):', Cosine.angularDistance(cosineVec1, cosineVec2).toFixed(6));

// Example 2: Orthogonal vectors
const orthVec1 = [1, 0, 0, 0];
const orthVec2 = [0, 1, 0, 0];

console.log('\n--- Example 2: Orthogonal Vectors ---');
console.log('Vector A:', orthVec1);
console.log('Vector B:', orthVec2);
console.log('Cosine Similarity:', Cosine.similarity(orthVec1, orthVec2).toFixed(6));
console.log('Cosine Distance:', Cosine.distance(orthVec1, orthVec2).toFixed(6));
console.log('Angular Distance (radians):', Cosine.angularDistance(orthVec1, orthVec2).toFixed(6), '(π/2)');

// Example 3: Opposite vectors
const oppositeVec1 = [1, 2, 3];
const oppositeVec2 = [-1, -2, -3];

console.log('\n--- Example 3: Opposite Direction Vectors ---');
console.log('Vector A:', oppositeVec1);
console.log('Vector B:', oppositeVec2);
console.log('Cosine Similarity:', Cosine.similarity(oppositeVec1, oppositeVec2).toFixed(6));
console.log('Cosine Distance:', Cosine.distance(oppositeVec1, oppositeVec2).toFixed(6));

// Example 4: Text/Document similarity (word frequency vectors)
const doc1 = [3, 2, 0, 5, 0, 0, 1];  // Document 1 word frequencies
const doc2 = [2, 1, 0, 4, 0, 1, 0];  // Document 2 word frequencies
const doc3 = [0, 0, 4, 0, 2, 3, 0];  // Document 3 word frequencies (different topic)

console.log('\n--- Example 4: Document Similarity ---');
console.log('Document 1:', doc1);
console.log('Document 2:', doc2);
console.log('Document 3:', doc3);
console.log('Similarity(Doc1, Doc2):', Cosine.similarity(doc1, doc2).toFixed(4));
console.log('Similarity(Doc1, Doc3):', Cosine.similarity(doc1, doc3).toFixed(4));
console.log('Similarity(Doc2, Doc3):', Cosine.similarity(doc2, doc3).toFixed(4));

// Example 5: K-Nearest Neighbors
const cosineQuery = [1.5, 2.0, 3.5, 1.0];
const cosineDatabase = [
  [1.5, 2.0, 3.5, 1.0],  // Identical
  [1.6, 2.1, 3.4, 1.1],  // Very similar
  [3.0, 4.0, 7.0, 2.0],  // Same direction, different magnitude
  [0.5, 1.0, 0.5, 2.0],  // Different direction
  [-1.5, -2.0, -3.5, -1.0]  // Opposite direction
];

console.log('\n--- Example 5: K-Nearest Neighbors ---');
console.log('Query:', cosineQuery);
const cosineNearest = Cosine.kNearest(cosineQuery, cosineDatabase, 3);
console.log('Top 3 Nearest Neighbors:');
cosineNearest.forEach((result, i) => {
  console.log(`  ${i + 1}. Index ${result.index}, Distance: ${result.distance.toFixed(4)}, Similarity: ${result.similarity.toFixed(4)}`);
});

// Example 6: Pairwise Similarity Matrix
const cosineMatrixA = [
  [1, 2, 3],
  [4, 5, 6]
];
const cosineMatrixB = [
  [1, 2, 3],
  [2, 4, 6],
  [7, 8, 9]
];

console.log('\n--- Example 6: Pairwise Similarity Matrix ---');
console.log('Matrix A:', cosineMatrixA);
console.log('Matrix B:', cosineMatrixB);
const cosineSimilarityMatrix = Cosine.pairwiseSimilarity(cosineMatrixA, cosineMatrixB);
console.log('Similarity Matrix:');
cosineSimilarityMatrix.forEach((row, i) => {
  console.log(`  Row ${i}:`, row.map(s => s.toFixed(4)));
});

// Example 7: Batch Similarity (Optimized)
const batchQuery = [1, 2, 3, 4];
const batchVectors = [
  [1, 2, 3, 4],
  [2, 4, 6, 8],
  [1, 1, 1, 1],
  [4, 3, 2, 1],
  [0, 0, 0, 1]
];

console.log('\n--- Example 7: Batch Similarity (Optimized) ---');
console.log('Query:', batchQuery);
console.log('Vectors:', batchVectors);
const batchSimilarities = Cosine.batchSimilarity(batchQuery, batchVectors);
console.log('Similarities:', batchSimilarities.map(s => s.toFixed(4)));

// ============================================================================
// UTILITY FUNCTIONS EXAMPLES
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('UTILITY FUNCTIONS');
console.log('='.repeat(60));

// Example 1: Vector Validation
console.log('\n--- Example 1: Vector Validation ---');
const validVec = [1, 2, 3, 4];
const invalidVec = [1, 2, 'three', 4];
const notVector = "not a vector";

console.log('Valid vector:', validVec, '→', Utils.isValidVector(validVec));
console.log('Invalid vector:', invalidVec, '→', Utils.isValidVector(invalidVec));
console.log('Not a vector:', notVector, '→', Utils.isValidVector(notVector));

// Example 2: Matrix Validation
console.log('\n--- Example 2: Matrix Validation ---');
const validMatrix = [[1, 2, 3], [4, 5, 6]];
const invalidMatrix = [[1, 2], [3, 4, 5]];  // Inconsistent row lengths

console.log('Valid matrix:', validMatrix, '→', Utils.isValidMatrix(validMatrix));
console.log('Invalid matrix:', invalidMatrix, '→', Utils.isValidMatrix(invalidMatrix));

// Example 3: Vector Normalization
console.log('\n--- Example 3: Vector Normalization ---');
const unnormalizedVec = [3, 4, 0];
const normalizedVec = Utils.normalize(unnormalizedVec);

console.log('Original vector:', unnormalizedVec);
console.log('Normalized vector:', normalizedVec.map(v => v.toFixed(4)));
console.log('Magnitude of normalized:', Cosine._magnitude(normalizedVec).toFixed(4), '(should be ~1.0)');

// Example 4: Top K Values
console.log('\n--- Example 4: Top K Values ---');
const scores = [0.23, 0.87, 0.45, 0.92, 0.12, 0.78, 0.56];

console.log('Scores:', scores);
console.log('Top 3 (descending):', Utils.topK(scores, 3, true));
console.log('Top 3 (ascending):', Utils.topK(scores, 3, false));

// ============================================================================
// PRACTICAL USE CASE: SEMANTIC SEARCH
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('PRACTICAL USE CASE: SEMANTIC SEARCH SIMULATION');
console.log('='.repeat(60));

// Simulated embedding vectors for documents
const documents = [
  { id: 0, title: "Machine Learning Basics", embedding: [0.8, 0.6, 0.1, 0.3, 0.2] },
  { id: 1, title: "Deep Learning Tutorial", embedding: [0.7, 0.7, 0.2, 0.4, 0.1] },
  { id: 2, title: "Cooking Recipes", embedding: [0.1, 0.1, 0.9, 0.2, 0.8] },
  { id: 3, title: "Neural Networks Guide", embedding: [0.75, 0.65, 0.15, 0.35, 0.15] },
  { id: 4, title: "Gardening Tips", embedding: [0.2, 0.1, 0.8, 0.3, 0.7] }
];

const query = { text: "AI and Neural Networks", embedding: [0.85, 0.7, 0.1, 0.4, 0.1] };

console.log('\n--- Semantic Search Example ---');
console.log('Query:', query.text);
console.log('\nSearching documents using Cosine Similarity...\n');

const embeddings = documents.map(doc => doc.embedding);
const results = Cosine.kNearest(query.embedding, embeddings, 3);

console.log('Top 3 Most Relevant Documents:');
results.forEach((result, i) => {
  const doc = documents[result.index];
  console.log(`  ${i + 1}. "${doc.title}"`);
  console.log(`     Similarity: ${result.similarity.toFixed(4)}, Distance: ${result.distance.toFixed(4)}`);
});

console.log('\n' + '='.repeat(60));
console.log('END OF EXAMPLES');
console.log('='.repeat(60) + '\n');
