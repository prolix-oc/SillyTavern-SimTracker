/**
 * Async Utilities Example
 * Demonstrates modern async/await helpers and utilities
 */

const AsyncUtils = require('../asyncUtils');

console.log('=== Async Utilities Examples ===\n');

(async () => {
  // ============================================================================
  // SLEEP / DELAY
  // ============================================================================
  console.log('--- Sleep / Delay ---');
  console.log('Starting sleep for 500ms...');
  await AsyncUtils.sleep(500);
  console.log('Sleep complete!');
  console.log('');

  // ============================================================================
  // RETRY WITH EXPONENTIAL BACKOFF
  // ============================================================================
  console.log('--- Retry with Exponential Backoff ---');
  
  let attemptCount = 0;
  const unstableOperation = async () => {
    attemptCount++;
    console.log(`  Attempt ${attemptCount}`);
    if (attemptCount < 3) {
      throw new Error('Temporary failure');
    }
    return 'Success!';
  };

  const retryResult = await AsyncUtils.retry(unstableOperation, {
    maxAttempts: 5,
    delay: 100,
    backoffFactor: 2,
    onRetry: (attempt, error) => {
      console.log(`  Retrying after failure: ${error.message}`);
    }
  });
  
  console.log('Result:', retryResult);
  console.log('');

  // ============================================================================
  // TIMEOUT
  // ============================================================================
  console.log('--- Timeout Wrapper ---');
  
  const slowOperation = async () => {
    await AsyncUtils.sleep(2000);
    return 'Completed';
  };

  try {
    console.log('Trying slow operation with 500ms timeout...');
    await AsyncUtils.timeout(slowOperation(), 500, 'Operation timed out!');
  } catch (error) {
    console.log('Caught timeout:', error.message);
  }

  // Success case
  const fastOperation = async () => {
    await AsyncUtils.sleep(100);
    return 'Quick result';
  };

  const quickResult = await AsyncUtils.timeout(fastOperation(), 500);
  console.log('Quick operation result:', quickResult);
  console.log('');

  // ============================================================================
  // SEQUENTIAL EXECUTION
  // ============================================================================
  console.log('--- Sequential Execution ---');
  
  const sequential = await AsyncUtils.sequential([
    async (n) => { console.log(`  Step 1: ${n} + 1`); return n + 1; },
    async (n) => { console.log(`  Step 2: ${n} * 2`); return n * 2; },
    async (n) => { console.log(`  Step 3: ${n} - 3`); return n - 3; }
  ], 5);
  
  console.log('Sequential result:', sequential, '(5 + 1) * 2 - 3 = 9');
  console.log('');

  // ============================================================================
  // BATCH PROCESSING
  // ============================================================================
  console.log('--- Batch Processing ---');
  
  const items = Array.from({ length: 10 }, (_, i) => i + 1);
  console.log('Processing items:', items);
  
  const batchResults = await AsyncUtils.batch(
    items,
    async (batch) => {
      console.log(`  Processing batch: [${batch.join(', ')}]`);
      await AsyncUtils.sleep(100);
      return batch.map(x => x * 2);
    },
    {
      batchSize: 3,
      delay: 50,
      onProgress: (processed, total) => {
        console.log(`  Progress: ${processed}/${total}`);
      }
    }
  );
  
  console.log('Batch results:', batchResults);
  console.log('');

  // ============================================================================
  // RATE LIMITING
  // ============================================================================
  console.log('--- Rate Limiting ---');
  
  const limiter = AsyncUtils.rateLimiter(2, 1000); // 2 calls per second
  console.log('Making 5 API calls with rate limit (2 per second)...');
  
  const startTime = Date.now();
  const rateLimitedCalls = [];
  
  for (let i = 1; i <= 5; i++) {
    rateLimitedCalls.push(
      limiter.execute(async () => {
        const elapsed = Date.now() - startTime;
        console.log(`  Call ${i} executed at ${elapsed}ms`);
        return `Result ${i}`;
      })
    );
  }
  
  await Promise.all(rateLimitedCalls);
  console.log('All rate-limited calls complete');
  console.log('');

  // ============================================================================
  // CANCELABLE PROMISE
  // ============================================================================
  console.log('--- Cancelable Promise ---');
  
  const { promise, cancel } = AsyncUtils.cancelable((resolve, reject, onCancel) => {
    console.log('  Starting cancelable operation...');
    const timeout = setTimeout(() => {
      console.log('  Operation completed');
      resolve('Done!');
    }, 2000);
    
    onCancel(() => {
      console.log('  Operation canceled, cleaning up...');
      clearTimeout(timeout);
    });
  });

  // Cancel after 500ms
  setTimeout(() => {
    console.log('  Canceling operation...');
    cancel();
  }, 500);

  await AsyncUtils.sleep(1000);
  console.log('');

  // ============================================================================
  // ASYNC MAP WITH CONCURRENCY
  // ============================================================================
  console.log('--- Async Map with Concurrency ---');
  
  const numbers = [1, 2, 3, 4, 5, 6];
  console.log('Mapping numbers with max 2 concurrent operations:', numbers);
  
  const mapped = await AsyncUtils.map(
    numbers,
    async (n) => {
      console.log(`  Processing ${n}...`);
      await AsyncUtils.sleep(200);
      return n * 2;
    },
    2 // Max 2 concurrent
  );
  
  console.log('Mapped results:', mapped);
  console.log('');

  // ============================================================================
  // ASYNC FILTER
  // ============================================================================
  console.log('--- Async Filter ---');
  
  const numbersToFilter = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const filtered = await AsyncUtils.filter(
    numbersToFilter,
    async (n) => {
      await AsyncUtils.sleep(10);
      return n % 2 === 0; // Keep even numbers
    }
  );
  
  console.log('Original:', numbersToFilter);
  console.log('Filtered (even only):', filtered);
  console.log('');

  // ============================================================================
  // ASYNC REDUCE
  // ============================================================================
  console.log('--- Async Reduce ---');
  
  const numbersToReduce = [1, 2, 3, 4, 5];
  const sum = await AsyncUtils.reduce(
    numbersToReduce,
    async (acc, n) => {
      await AsyncUtils.sleep(10);
      return acc + n;
    },
    0
  );
  
  console.log('Numbers:', numbersToReduce);
  console.log('Sum:', sum);
  console.log('');

  // ============================================================================
  // MEMOIZATION WITH TTL
  // ============================================================================
  console.log('--- Memoization with TTL ---');
  
  let expensiveCallCount = 0;
  const expensiveOperation = AsyncUtils.memoize(
    async (n) => {
      expensiveCallCount++;
      console.log(`  Expensive operation called (count: ${expensiveCallCount})`);
      await AsyncUtils.sleep(100);
      return n * 2;
    },
    { ttl: 2000 } // Cache for 2 seconds
  );

  console.log('Calling memoized function with same argument...');
  await expensiveOperation(5);
  await expensiveOperation(5); // Cached
  await expensiveOperation(5); // Cached
  console.log('Total expensive calls:', expensiveCallCount, '(should be 1)');
  
  await expensiveOperation(10); // Different argument
  console.log('After different argument:', expensiveCallCount, '(should be 2)');
  console.log('');

  // ============================================================================
  // POLLING
  // ============================================================================
  console.log('--- Polling ---');
  
  let pollCount = 0;
  const pollResult = await AsyncUtils.poll(
    async () => {
      pollCount++;
      console.log(`  Poll attempt ${pollCount}`);
      return { complete: pollCount >= 3, value: pollCount * 10 };
    },
    (result) => result.complete === true,
    {
      interval: 300,
      maxAttempts: 10,
      onAttempt: (attempt, result) => {
        console.log(`  Attempt ${attempt}: complete=${result.complete}`);
      }
    }
  );
  
  console.log('Poll result:', pollResult);
  console.log('');

  // ============================================================================
  // DEBOUNCE ASYNC
  // ============================================================================
  console.log('--- Debounce Async ---');
  
  const debouncedFn = AsyncUtils.debounceAsync(async (query) => {
    console.log(`  Searching for: ${query}`);
    await AsyncUtils.sleep(100);
    return `Results for ${query}`;
  }, 300);

  console.log('Calling debounced function rapidly...');
  debouncedFn('hello');
  debouncedFn('hello w');
  const finalResult = await debouncedFn('hello world');
  console.log('Final result:', finalResult);
  console.log('(Only the last call should execute)');
  console.log('');

  // ============================================================================
  // THROTTLE ASYNC
  // ============================================================================
  console.log('--- Throttle Async ---');
  
  let throttleCallCount = 0;
  const throttledFn = AsyncUtils.throttleAsync(async () => {
    throttleCallCount++;
    console.log(`  Throttled function executed (count: ${throttleCallCount})`);
    await AsyncUtils.sleep(50);
    return Date.now();
  }, 500);

  console.log('Calling throttled function rapidly...');
  await throttledFn();
  await AsyncUtils.sleep(100);
  await throttledFn(); // Should not execute (throttled)
  await AsyncUtils.sleep(100);
  await throttledFn(); // Should not execute (throttled)
  console.log('Throttle call count:', throttleCallCount, '(should be 1)');
  console.log('');

  // ============================================================================
  // ASYNC QUEUE
  // ============================================================================
  console.log('--- Async Queue (Ordered Execution) ---');
  
  const queue = AsyncUtils.queue();
  
  console.log('Adding tasks to queue...');
  queue.add(async () => {
    console.log('  Task 1 started');
    await AsyncUtils.sleep(200);
    console.log('  Task 1 finished');
  });
  
  queue.add(async () => {
    console.log('  Task 2 started');
    await AsyncUtils.sleep(100);
    console.log('  Task 2 finished');
  });
  
  queue.add(async () => {
    console.log('  Task 3 started');
    await AsyncUtils.sleep(150);
    console.log('  Task 3 finished');
  });

  await AsyncUtils.sleep(600);
  console.log('Queue execution complete');
  console.log('');

  // ============================================================================
  // ALL SETTLED
  // ============================================================================
  console.log('--- All Settled ---');
  
  const promises = [
    Promise.resolve(1),
    Promise.reject('Error 1'),
    Promise.resolve(3),
    Promise.reject('Error 2'),
    Promise.resolve(5)
  ];

  const { results, errors } = await AsyncUtils.allSettled(promises);
  console.log('Successful results:', results);
  console.log('Errors:', errors);
  console.log('');

  // ============================================================================
  // PARALLEL EXECUTION
  // ============================================================================
  console.log('--- Parallel Execution with Concurrency ---');
  
  const tasks = Array.from({ length: 6 }, (_, i) => 
    async () => {
      console.log(`  Task ${i + 1} started`);
      await AsyncUtils.sleep(200);
      console.log(`  Task ${i + 1} finished`);
      return i + 1;
    }
  );

  console.log('Executing 6 tasks with max 3 concurrent...');
  const parallelResults = await AsyncUtils.parallel(tasks, 3);
  console.log('Results:', parallelResults);
  console.log('');

  console.log('=== Examples Complete ===');
})();
