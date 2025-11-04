/**
 * Storage Manager Module for SillyTavern UI Extensions
 * Provides type-safe persistent storage with advanced features
 * Pure JavaScript implementation - no external dependencies
 * 
 * @module storageManager
 */

/**
 * Storage Manager Class
 */
class StorageManager {
  /**
   * Create a new StorageManager instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.namespace - Namespace prefix for all keys (default: 'app')
   * @param {Storage} options.storage - Storage backend (default: localStorage)
   * @param {boolean} options.autoSerialize - Auto serialize/deserialize (default: true)
   * @param {boolean} options.useCompression - Enable compression for large values (default: false)
   * 
   * @example
   * const storage = new StorageManager({ namespace: 'myApp' });
   */
  constructor(options = {}) {
    this.namespace = options.namespace || 'app';
    this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.autoSerialize = options.autoSerialize !== false;
    this.useCompression = options.useCompression || false;
    
    // Check if storage is available
    this._checkStorage();
    
    // In-memory fallback for environments without storage
    this._memoryStorage = new Map();
    this._isMemoryMode = !this.storage;
  }

  /**
   * Check if storage is available and working
   * 
   * @private
   * @returns {boolean} True if storage is available
   */
  _checkStorage() {
    if (!this.storage) {
      console.warn('StorageManager: Storage not available, using in-memory fallback');
      return false;
    }
    
    try {
      const testKey = '__storage_test__';
      this.storage.setItem(testKey, 'test');
      this.storage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('StorageManager: Storage not accessible, using in-memory fallback');
      this.storage = null;
      return false;
    }
  }

  /**
   * Create namespaced key
   * 
   * @private
   * @param {string} key - Original key
   * @returns {string} Namespaced key
   */
  _key(key) {
    return `${this.namespace}:${key}`;
  }

  /**
   * Serialize value for storage
   * 
   * @private
   * @param {*} value - Value to serialize
   * @returns {string} Serialized value
   */
  _serialize(value) {
    if (!this.autoSerialize) {
      return String(value);
    }
    
    try {
      return JSON.stringify({
        value,
        type: typeof value,
        timestamp: Date.now()
      });
    } catch (e) {
      throw new Error(`Failed to serialize value: ${e.message}`);
    }
  }

  /**
   * Deserialize value from storage
   * 
   * @private
   * @param {string} data - Serialized data
   * @returns {*} Deserialized value
   */
  _deserialize(data) {
    if (!this.autoSerialize) {
      return data;
    }
    
    try {
      const parsed = JSON.parse(data);
      return parsed.value;
    } catch (e) {
      // Return raw data if not valid JSON
      return data;
    }
  }

  /**
   * Set value in storage
   * 
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @param {Object} options - Storage options
   * @param {number} options.ttl - Time to live in milliseconds
   * @returns {boolean} True if successful
   * 
   * @example
   * storage.set('username', 'john_doe');
   * storage.set('session', { id: 123 }, { ttl: 3600000 }); // 1 hour TTL
   */
  set(key, value, options = {}) {
    const namespacedKey = this._key(key);
    
    try {
      let data = {
        value,
        timestamp: Date.now()
      };
      
      // Add TTL if specified
      if (options.ttl) {
        data.expiresAt = Date.now() + options.ttl;
      }
      
      const serialized = JSON.stringify(data);
      
      if (this._isMemoryMode) {
        this._memoryStorage.set(namespacedKey, serialized);
      } else {
        this.storage.setItem(namespacedKey, serialized);
      }
      
      return true;
    } catch (e) {
      console.error(`StorageManager: Failed to set ${key}:`, e);
      return false;
    }
  }

  /**
   * Get value from storage
   * 
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Stored value or default
   * 
   * @example
   * const username = storage.get('username', 'guest');
   */
  get(key, defaultValue = null) {
    const namespacedKey = this._key(key);
    
    try {
      const raw = this._isMemoryMode 
        ? this._memoryStorage.get(namespacedKey)
        : this.storage.getItem(namespacedKey);
      
      if (!raw) {
        return defaultValue;
      }
      
      const data = JSON.parse(raw);
      
      // Check if expired
      if (data.expiresAt && Date.now() > data.expiresAt) {
        this.remove(key);
        return defaultValue;
      }
      
      return data.value;
    } catch (e) {
      console.error(`StorageManager: Failed to get ${key}:`, e);
      return defaultValue;
    }
  }

  /**
   * Remove value from storage
   * 
   * @param {string} key - Storage key
   * @returns {boolean} True if successful
   * 
   * @example
   * storage.remove('username');
   */
  remove(key) {
    const namespacedKey = this._key(key);
    
    try {
      if (this._isMemoryMode) {
        this._memoryStorage.delete(namespacedKey);
      } else {
        this.storage.removeItem(namespacedKey);
      }
      return true;
    } catch (e) {
      console.error(`StorageManager: Failed to remove ${key}:`, e);
      return false;
    }
  }

  /**
   * Check if key exists in storage
   * 
   * @param {string} key - Storage key
   * @returns {boolean} True if key exists
   * 
   * @example
   * if (storage.has('username')) { }
   */
  has(key) {
    const namespacedKey = this._key(key);
    
    if (this._isMemoryMode) {
      return this._memoryStorage.has(namespacedKey);
    }
    
    return this.storage.getItem(namespacedKey) !== null;
  }

  /**
   * Clear all keys in current namespace
   * 
   * @returns {boolean} True if successful
   * 
   * @example
   * storage.clear();
   */
  clear() {
    try {
      const keys = this.keys();
      keys.forEach(key => this.remove(key));
      return true;
    } catch (e) {
      console.error('StorageManager: Failed to clear storage:', e);
      return false;
    }
  }

  /**
   * Get all keys in current namespace
   * 
   * @returns {Array<string>} Array of keys (without namespace prefix)
   * 
   * @example
   * const keys = storage.keys();
   */
  keys() {
    const prefix = `${this.namespace}:`;
    const keys = [];
    
    if (this._isMemoryMode) {
      for (const key of this._memoryStorage.keys()) {
        if (key.startsWith(prefix)) {
          keys.push(key.substring(prefix.length));
        }
      }
    } else {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key.startsWith(prefix)) {
          keys.push(key.substring(prefix.length));
        }
      }
    }
    
    return keys;
  }

  /**
   * Get all key-value pairs in current namespace
   * 
   * @returns {Object} Object with all key-value pairs
   * 
   * @example
   * const allData = storage.getAll();
   */
  getAll() {
    const keys = this.keys();
    const result = {};
    
    keys.forEach(key => {
      result[key] = this.get(key);
    });
    
    return result;
  }

  /**
   * Set multiple key-value pairs at once
   * 
   * @param {Object} items - Object with key-value pairs
   * @param {Object} options - Storage options (applied to all)
   * @returns {boolean} True if all successful
   * 
   * @example
   * storage.setMany({
   *   username: 'john',
   *   email: 'john@example.com'
   * });
   */
  setMany(items, options = {}) {
    try {
      Object.entries(items).forEach(([key, value]) => {
        this.set(key, value, options);
      });
      return true;
    } catch (e) {
      console.error('StorageManager: Failed to set multiple items:', e);
      return false;
    }
  }

  /**
   * Remove multiple keys at once
   * 
   * @param {Array<string>} keys - Array of keys to remove
   * @returns {boolean} True if all successful
   * 
   * @example
   * storage.removeMany(['username', 'email']);
   */
  removeMany(keys) {
    try {
      keys.forEach(key => this.remove(key));
      return true;
    } catch (e) {
      console.error('StorageManager: Failed to remove multiple items:', e);
      return false;
    }
  }

  /**
   * Get storage size information
   * 
   * @returns {Object} Size information
   * @returns {number} return.used - Bytes used (approximate)
   * @returns {number} return.quota - Total quota (if available)
   * @returns {number} return.remaining - Remaining space (if available)
   * 
   * @example
   * const { used, quota } = storage.getSize();
   */
  getSize() {
    if (this._isMemoryMode) {
      let size = 0;
      for (const [key, value] of this._memoryStorage.entries()) {
        size += key.length + value.length;
      }
      return { used: size, quota: Infinity, remaining: Infinity };
    }
    
    let used = 0;
    
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        const value = this.storage.getItem(key);
        used += key.length + (value ? value.length : 0);
      }
    } catch (e) {
      console.error('StorageManager: Failed to calculate size:', e);
    }
    
    // Try to get quota (may not be available in all browsers)
    return {
      used,
      quota: null,
      remaining: null
    };
  }

  /**
   * Migrate data from one namespace to another
   * 
   * @param {string} fromNamespace - Source namespace
   * @param {string} toNamespace - Destination namespace
   * @param {Function} transformer - Optional function to transform values
   * @returns {boolean} True if successful
   * 
   * @example
   * storage.migrate('oldApp', 'newApp', (key, value) => {
   *   // Transform value if needed
   *   return value;
   * });
   */
  migrate(fromNamespace, toNamespace, transformer = null) {
    try {
      const sourceStorage = new StorageManager({
        namespace: fromNamespace,
        storage: this.storage
      });
      
      const targetStorage = new StorageManager({
        namespace: toNamespace,
        storage: this.storage
      });
      
      const allData = sourceStorage.getAll();
      
      Object.entries(allData).forEach(([key, value]) => {
        const newValue = transformer ? transformer(key, value) : value;
        targetStorage.set(key, newValue);
      });
      
      return true;
    } catch (e) {
      console.error('StorageManager: Failed to migrate:', e);
      return false;
    }
  }

  /**
   * Export all data as JSON
   * 
   * @returns {string} JSON string of all data
   * 
   * @example
   * const backup = storage.export();
   */
  export() {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * Import data from JSON string
   * 
   * @param {string} json - JSON string to import
   * @param {boolean} merge - Merge with existing data (default: false)
   * @returns {boolean} True if successful
   * 
   * @example
   * storage.import(backupData, true);
   */
  import(json, merge = false) {
    try {
      const data = JSON.parse(json);
      
      if (!merge) {
        this.clear();
      }
      
      this.setMany(data);
      return true;
    } catch (e) {
      console.error('StorageManager: Failed to import:', e);
      return false;
    }
  }

  /**
   * Watch for changes to a specific key
   * 
   * @param {string} key - Key to watch
   * @param {Function} callback - Callback function (receives new value)
   * @returns {Function} Cleanup function to stop watching
   * 
   * @example
   * const stopWatching = storage.watch('theme', (newTheme) => {
   *   console.log('Theme changed:', newTheme);
   * });
   */
  watch(key, callback) {
    const namespacedKey = this._key(key);
    
    const handler = (e) => {
      if (e.key === namespacedKey && e.storageArea === this.storage) {
        const newValue = e.newValue ? JSON.parse(e.newValue).value : null;
        callback(newValue);
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }
    
    return () => {};
  }

  /**
   * Check if storage is nearly full
   * 
   * @param {number} threshold - Warning threshold (0-1, default: 0.9)
   * @returns {boolean} True if above threshold
   * 
   * @example
   * if (storage.isNearlyFull(0.8)) {
   *   console.warn('Storage is 80% full');
   * }
   */
  isNearlyFull(threshold = 0.9) {
    if (this._isMemoryMode) {
      return false;
    }
    
    const { used, quota } = this.getSize();
    
    if (!quota) {
      // Can't determine, assume safe
      return false;
    }
    
    return (used / quota) >= threshold;
  }

  /**
   * Create a scoped storage instance with a sub-namespace
   * 
   * @param {string} scope - Scope name
   * @returns {StorageManager} Scoped storage instance
   * 
   * @example
   * const userStorage = storage.scope('user');
   * userStorage.set('name', 'John'); // Stored as 'app:user:name'
   */
  scope(scope) {
    return new StorageManager({
      namespace: `${this.namespace}:${scope}`,
      storage: this.storage,
      autoSerialize: this.autoSerialize
    });
  }
}

/**
 * Create a StorageManager instance with default settings
 * 
 * @param {Object} options - Configuration options
 * @returns {StorageManager} Storage manager instance
 * 
 * @example
 * const storage = createStorage({ namespace: 'myApp' });
 */
function createStorage(options = {}) {
  return new StorageManager(options);
}

/**
 * Create a session storage instance
 * 
 * @param {Object} options - Configuration options
 * @returns {StorageManager} Session storage manager instance
 * 
 * @example
 * const sessionStorage = createSessionStorage({ namespace: 'myApp' });
 */
function createSessionStorage(options = {}) {
  return new StorageManager({
    ...options,
    storage: typeof sessionStorage !== 'undefined' ? sessionStorage : null
  });
}

// Export module (ES6)
export { StorageManager, createStorage, createSessionStorage };
export default StorageManager;
