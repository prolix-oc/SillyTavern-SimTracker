/**
 * Document Search Example
 * Demonstrates the high-level DocumentSearch API
 */

const { DocumentSearch } = require('../vectorDistance.js');

console.log('='.repeat(70));
console.log('DOCUMENT SEARCH API - DEMONSTRATION');
console.log('='.repeat(70));

// Sample documents with embeddings (simulating a real semantic search scenario)
const documents = [
  {
    documentText: "Machine learning is a subset of artificial intelligence that focuses on data-driven algorithms.",
    embeddingArray: [0.85, 0.72, 0.15, 0.42, 0.18, 0.91, 0.33]
  },
  {
    documentText: "Deep learning uses neural networks with multiple layers to process complex patterns.",
    embeddingArray: [0.82, 0.78, 0.22, 0.48, 0.14, 0.88, 0.29]
  },
  {
    documentText: "The best chocolate chip cookie recipe includes butter, sugar, eggs, and vanilla.",
    embeddingArray: [0.12, 0.08, 0.89, 0.15, 0.76, 0.11, 0.82]
  },
  {
    documentText: "Neural networks are inspired by biological neurons and process information through layers.",
    embeddingArray: [0.79, 0.75, 0.19, 0.45, 0.16, 0.86, 0.31]
  },
  {
    documentText: "Growing tomatoes requires full sunlight, regular watering, and nutrient-rich soil.",
    embeddingArray: [0.18, 0.11, 0.82, 0.21, 0.88, 0.14, 0.79]
  },
  {
    documentText: "Convolutional neural networks excel at image recognition and computer vision tasks.",
    embeddingArray: [0.76, 0.81, 0.25, 0.51, 0.12, 0.84, 0.27]
  },
  {
    documentText: "Mediterranean pasta with olive oil, garlic, tomatoes, and fresh basil is delicious.",
    embeddingArray: [0.09, 0.13, 0.91, 0.18, 0.73, 0.08, 0.85]
  }
];

// Query about AI/ML topics
const aiQuery = {
  text: "Tell me about artificial intelligence and deep neural networks",
  embeddingArray: [0.88, 0.74, 0.11, 0.44, 0.15, 0.92, 0.30]
};

console.log('\n' + '='.repeat(70));
console.log('EXAMPLE 1: Cosine Similarity Search (Recommended for Embeddings)');
console.log('='.repeat(70));
console.log(`\nQuery: "${aiQuery.text}"\n`);

const cosineResults = DocumentSearch.search({
  message: aiQuery.embeddingArray,
  documents: documents,
  algorithm: 'cosine',
  top_k: 3
});

console.log(`Algorithm: ${cosineResults.algorithm}`);
console.log(`Total Documents: ${cosineResults.totalDocuments}`);
console.log(`Returned: ${cosineResults.returnedDocuments}`);
if (cosineResults.warning) {
  console.log(`Warning: ${cosineResults.warning}`);
}

console.log('\nTop 3 Results:');
cosineResults.results.forEach((result, i) => {
  console.log(`\n${i + 1}. Score: ${result.score.toFixed(4)}`);
  console.log(`   Text: "${result.resultText}"`);
});

// Binary vector example (for demonstrating Jaccard)
console.log('\n' + '='.repeat(70));
console.log('EXAMPLE 2: Jaccard Similarity (Binary Features)');
console.log('='.repeat(70));

const binaryDocuments = [
  {
    documentText: "Has features: action, sci-fi, adventure",
    embeddingArray: [1, 0, 1, 1, 0, 0, 1, 0]  // Binary feature vector
  },
  {
    documentText: "Has features: romance, drama",
    embeddingArray: [0, 1, 0, 0, 1, 1, 0, 0]
  },
  {
    documentText: "Has features: action, sci-fi",
    embeddingArray: [1, 0, 1, 0, 0, 0, 1, 0]
  },
  {
    documentText: "Has features: comedy, romance",
    embeddingArray: [0, 1, 0, 0, 1, 0, 0, 1]
  },
  {
    documentText: "Has features: action, adventure, thriller",
    embeddingArray: [1, 0, 0, 1, 0, 1, 1, 0]
  }
];

const binaryQuery = {
  text: "Looking for: action, sci-fi, thriller",
  embeddingArray: [1, 0, 1, 0, 0, 1, 1, 0]
};

console.log(`\nQuery: "${binaryQuery.text}"\n`);

const jaccardResults = DocumentSearch.search({
  message: binaryQuery.embeddingArray,
  documents: binaryDocuments,
  algorithm: 'jaccard',
  top_k: 3
});

console.log(`Algorithm: ${jaccardResults.algorithm}`);
if (jaccardResults.warning) {
  console.log(`Warning: ${jaccardResults.warning}`);
}

console.log('\nTop 3 Results:');
jaccardResults.results.forEach((result, i) => {
  console.log(`\n${i + 1}. Score: ${result.score.toFixed(4)}`);
  console.log(`   Text: "${result.resultText}"`);
});

// Hamming distance example
console.log('\n' + '='.repeat(70));
console.log('EXAMPLE 3: Hamming Distance (Discrete/Binary Data)');
console.log('='.repeat(70));

const hammingQuery = {
  text: "Binary hash code",
  embeddingArray: [1, 1, 0, 0, 1, 1, 0, 0, 1, 0]
};

const hammingDocuments = [
  {
    documentText: "Hash code A (exact match)",
    embeddingArray: [1, 1, 0, 0, 1, 1, 0, 0, 1, 0]
  },
  {
    documentText: "Hash code B (1 bit different)",
    embeddingArray: [1, 1, 0, 0, 1, 1, 0, 1, 1, 0]
  },
  {
    documentText: "Hash code C (3 bits different)",
    embeddingArray: [1, 0, 0, 1, 1, 1, 0, 1, 1, 0]
  },
  {
    documentText: "Hash code D (completely different)",
    embeddingArray: [0, 0, 1, 1, 0, 0, 1, 1, 0, 1]
  }
];

console.log(`\nQuery: "${hammingQuery.text}"\n`);

const hammingResults = DocumentSearch.search({
  message: hammingQuery.embeddingArray,
  documents: hammingDocuments,
  algorithm: 'hamming',
  normalized: true
});

console.log(`Algorithm: ${hammingResults.algorithm}`);
console.log(`Returned: ${hammingResults.returnedDocuments} (all documents)`);
if (hammingResults.warning) {
  console.log(`Warning: ${hammingResults.warning}`);
}

console.log('\nAll Results (sorted by similarity):');
hammingResults.results.forEach((result, i) => {
  console.log(`\n${i + 1}. Score: ${result.score.toFixed(4)}`);
  console.log(`   Text: "${result.resultText}"`);
});

// Warning demonstration - using wrong algorithm
console.log('\n' + '='.repeat(70));
console.log('EXAMPLE 4: Compatibility Warning (Continuous vectors + Jaccard)');
console.log('='.repeat(70));

console.log('\nAttempting to use Jaccard with continuous embeddings...\n');

const warningResults = DocumentSearch.search({
  message: aiQuery.embeddingArray,
  documents: documents.slice(0, 3),
  algorithm: 'jaccard',
  top_k: 2
});

console.log(`Algorithm: ${warningResults.algorithm}`);
if (warningResults.warning) {
  console.log(`\n⚠️  ${warningResults.warning}\n`);
}

console.log('Results (note: likely inaccurate due to thresholding):');
warningResults.results.forEach((result, i) => {
  console.log(`\n${i + 1}. Score: ${result.score.toFixed(4)}`);
  console.log(`   Text: "${result.resultText.substring(0, 60)}..."`);
});

// Suppressing warnings
console.log('\n' + '='.repeat(70));
console.log('EXAMPLE 5: Suppressing Warnings');
console.log('='.repeat(70));

const suppressedResults = DocumentSearch.search({
  message: aiQuery.embeddingArray,
  documents: documents.slice(0, 2),
  algorithm: 'jaccard',
  suppressWarnings: true
});

console.log(`\nWarning suppressed: ${suppressedResults.warning === null}`);

// Complete search without top_k
console.log('\n' + '='.repeat(70));
console.log('EXAMPLE 6: Full Results (No top_k limit)');
console.log('='.repeat(70));

const fullResults = DocumentSearch.search({
  message: aiQuery.embeddingArray,
  documents: documents,
  algorithm: 'cosine'
  // No top_k specified - returns all results
});

console.log(`\nTotal documents searched: ${fullResults.totalDocuments}`);
console.log(`All ${fullResults.returnedDocuments} results returned (sorted by score):\n`);

fullResults.results.forEach((result, i) => {
  console.log(`${i + 1}. Score: ${result.score.toFixed(4)} - "${result.resultText.substring(0, 50)}..."`);
});

// Error handling demonstration
console.log('\n' + '='.repeat(70));
console.log('EXAMPLE 7: Error Handling');
console.log('='.repeat(70));

console.log('\nDemonstrating input validation...\n');

try {
  DocumentSearch.search({
    message: [1, 2, 3],
    documents: [
      {
        documentText: "Test",
        embeddingArray: [1, 2]  // Wrong length!
      }
    ],
    algorithm: 'cosine'
  });
} catch (error) {
  console.log(`✓ Caught error: ${error.message}`);
}

try {
  DocumentSearch.search({
    message: [1, 2, 3],
    documents: [],  // Empty!
    algorithm: 'cosine'
  });
} catch (error) {
  console.log(`✓ Caught error: ${error.message}`);
}

try {
  DocumentSearch.search({
    message: [1, 2, 3],
    documents: [{ documentText: "Test", embeddingArray: [1, 2, 3] }],
    algorithm: 'invalid_algorithm'  // Invalid!
  });
} catch (error) {
  console.log(`✓ Caught error: ${error.message}`);
}

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

console.log(`
DocumentSearch.search() provides a simple, high-level API for semantic search:

✓ Automatic scoring and sorting (higher scores = better matches)
✓ Optional top_k filtering for retrieving only the best results
✓ Intelligent compatibility warnings for algorithm/data mismatches
✓ Support for three algorithms: Jaccard, Hamming, Cosine
✓ Comprehensive input validation with clear error messages

ALGORITHM SELECTION GUIDE:
- Cosine:  Use for CONTINUOUS embeddings (neural networks, transformers)
- Jaccard: Use for BINARY feature vectors (tags, categories)
- Hamming: Use for DISCRETE/BINARY codes (hashes, quantized data)

For most modern semantic search use cases with neural embeddings,
Cosine similarity is the recommended choice.
`);

console.log('='.repeat(70) + '\n');
