/**
 * Storage Manager Example
 * Demonstrates persistent storage with advanced features
 */

const { StorageManager } = require('../storageManager');

console.log('=== Storage Manager Examples ===\n');

// ============================================================================
// BASIC STORAGE OPERATIONS
// ============================================================================
console.log('--- Basic Storage Operations ---');
const storage = new StorageManager({ namespace: 'myApp' });

// Set and get values
storage.set('username', 'john_doe');
storage.set('email', 'john@example.com');
storage.set('age', 25);

console.log('Username:', storage.get('username'));
console.log('Email:', storage.get('email'));
console.log('Age:', storage.get('age'));
console.log('Non-existent key:', storage.get('nonexistent', 'default_value'));
console.log('');

// ============================================================================
// COMPLEX DATA TYPES
// ============================================================================
console.log('--- Complex Data Types ---');
storage.set('user', {
  name: 'John Doe',
  email: 'john@example.com',
  preferences: {
    theme: 'dark',
    language: 'en',
    notifications: true
  }
});

storage.set('tags', ['javascript', 'nodejs', 'web']);

console.log('User object:', storage.get('user'));
console.log('Tags array:', storage.get('tags'));
console.log('');

// ============================================================================
// TTL (TIME TO LIVE)
// ============================================================================
console.log('--- TTL (Time To Live) ---');

// Set item with 2-second TTL
storage.set('temporaryData', 'This will expire', { ttl: 2000 });
console.log('Temporary data (immediately):', storage.get('temporaryData'));

// Wait and check again
setTimeout(() => {
  console.log('Temporary data (after 2.5 seconds):', storage.get('temporaryData', 'EXPIRED'));
}, 2500);

// ============================================================================
// BULK OPERATIONS
// ============================================================================
console.log('--- Bulk Operations ---');

storage.setMany({
  setting1: 'value1',
  setting2: 'value2',
  setting3: 'value3',
  setting4: 'value4'
});

console.log('All keys:', storage.keys());
console.log('All data:', storage.getAll());
console.log('');

// ============================================================================
// KEY MANAGEMENT
// ============================================================================
console.log('--- Key Management ---');

console.log('Has "username":', storage.has('username'));
console.log('Has "missing":', storage.has('missing'));

// Remove keys
storage.remove('setting4');
console.log('Keys after removing setting4:', storage.keys());

// Remove multiple
storage.removeMany(['setting2', 'setting3']);
console.log('Keys after bulk remove:', storage.keys());
console.log('');

// ============================================================================
// SCOPED STORAGE
// ============================================================================
console.log('--- Scoped Storage ---');

// Create scoped storage instances
const userStorage = storage.scope('user');
const sessionStorage = storage.scope('session');

userStorage.set('profile', { name: 'John', avatar: 'avatar.jpg' });
userStorage.set('settings', { darkMode: true });

sessionStorage.set('token', 'abc123');
sessionStorage.set('expires', Date.now() + 3600000);

console.log('User profile:', userStorage.get('profile'));
console.log('Session token:', sessionStorage.get('token'));

console.log('All user scope keys:', userStorage.keys());
console.log('All session scope keys:', sessionStorage.keys());
console.log('');

// ============================================================================
// IMPORT / EXPORT
// ============================================================================
console.log('--- Import / Export ---');

const testStorage = new StorageManager({ namespace: 'testApp' });
testStorage.setMany({
  key1: 'value1',
  key2: 'value2',
  key3: { nested: 'object' }
});

// Export to JSON
const exported = testStorage.export();
console.log('Exported JSON (first 100 chars):', exported.substring(0, 100) + '...');

// Import to new storage
const newStorage = new StorageManager({ namespace: 'newApp' });
newStorage.import(exported);
console.log('Imported data:', newStorage.getAll());
console.log('');

// ============================================================================
// MIGRATION
// ============================================================================
console.log('--- Data Migration ---');

const oldAppStorage = new StorageManager({ namespace: 'oldApp' });
oldAppStorage.setMany({
  version: '1.0',
  user: 'john',
  count: 5
});

console.log('Old app data:', oldAppStorage.getAll());

// Migrate with transformation
storage.migrate('oldApp', 'newApp', (key, value) => {
  // Transform data during migration
  if (key === 'version') {
    return '2.0'; // Upgrade version
  }
  if (key === 'count') {
    return value * 2; // Double the count
  }
  return value;
});

const newAppStorage = new StorageManager({ namespace: 'newApp' });
console.log('Migrated data:', newAppStorage.getAll());
console.log('');

// ============================================================================
// STORAGE SIZE
// ============================================================================
console.log('--- Storage Size ---');
const sizeInfo = storage.getSize();
console.log('Storage size info:', sizeInfo);
console.log('Is nearly full (90%):', storage.isNearlyFull(0.9));
console.log('');

// ============================================================================
// WATCHING FOR CHANGES (Browser only - simulated here)
// ============================================================================
console.log('--- Watch for Changes ---');
console.log('Note: Watch functionality works in browser environments');
console.log('Example usage:');
console.log(`
const stopWatching = storage.watch('theme', (newValue) => {
  console.log('Theme changed to:', newValue);
});

// Later, to stop watching:
// stopWatching();
`);

// ============================================================================
// CLEARING STORAGE
// ============================================================================
setTimeout(() => {
  console.log('--- Clearing Storage ---');
  const clearStorage = new StorageManager({ namespace: 'clearTest' });
  clearStorage.setMany({ a: 1, b: 2, c: 3 });
  console.log('Before clear:', clearStorage.keys());
  clearStorage.clear();
  console.log('After clear:', clearStorage.keys());
  
  console.log('\n=== Examples Complete ===');
}, 3000);
