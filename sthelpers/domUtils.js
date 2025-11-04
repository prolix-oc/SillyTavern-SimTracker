/**
 * DOM Utilities Module for SillyTavern UI Extensions
 * Provides browser-safe DOM manipulation without jQuery
 * Pure JavaScript implementation - no external dependencies
 * 
 * @module domUtils
 */

/**
 * DOM Manipulation Utilities
 */
const DOMUtils = {
  /**
   * Safely create an element with attributes and content
   * Prevents XSS by escaping text content
   * 
   * @param {string} tag - HTML tag name
   * @param {Object} options - Element options
   * @param {Object} options.attrs - Attributes to set
   * @param {string} options.text - Text content (will be escaped)
   * @param {string} options.html - HTML content (use with caution)
   * @param {Array<HTMLElement>} options.children - Child elements
   * @param {Object} options.style - CSS styles
   * @param {Object} options.data - Data attributes
   * @returns {HTMLElement} Created element
   * 
   * @example
   * const div = DOMUtils.createElement('div', {
   *   attrs: { id: 'myDiv', class: 'container' },
   *   text: 'Hello World',
   *   style: { color: 'red', fontSize: '16px' }
   * });
   */
  createElement(tag, options = {}) {
    const element = document.createElement(tag);
    const { attrs = {}, text, html, children = [], style = {}, data = {} } = options;
    
    // Set attributes
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });
    
    // Set styles
    Object.entries(style).forEach(([key, value]) => {
      element.style[key] = value;
    });
    
    // Set data attributes
    Object.entries(data).forEach(([key, value]) => {
      element.dataset[key] = value;
    });
    
    // Set content (text is safer, html can be dangerous)
    if (text !== undefined) {
      element.textContent = text;
    } else if (html !== undefined) {
      element.innerHTML = html;
    }
    
    // Append children
    children.forEach(child => {
      if (child instanceof HTMLElement) {
        element.appendChild(child);
      }
    });
    
    return element;
  },

  /**
   * Query selector with optional context
   * 
   * @param {string} selector - CSS selector
   * @param {HTMLElement} context - Context element (default: document)
   * @returns {HTMLElement|null} Found element
   * 
   * @example
   * const button = DOMUtils.query('.my-button');
   * const nestedDiv = DOMUtils.query('.child', parentElement);
   */
  query(selector, context = document) {
    return context.querySelector(selector);
  },

  /**
   * Query selector all with optional context, returns array
   * 
   * @param {string} selector - CSS selector
   * @param {HTMLElement} context - Context element (default: document)
   * @returns {Array<HTMLElement>} Array of found elements
   * 
   * @example
   * const buttons = DOMUtils.queryAll('.button');
   */
  queryAll(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
  },

  /**
   * Add event listener with event delegation support
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {string} event - Event name
   * @param {Function|string} handlerOrSelector - Handler function or delegate selector
   * @param {Function} delegateHandler - Handler for delegation
   * @returns {Function} Cleanup function to remove listener
   * 
   * @example
   * // Direct listener
   * const cleanup = DOMUtils.on(button, 'click', () => console.log('clicked'));
   * 
   * // Event delegation
   * DOMUtils.on(document, 'click', '.button', (e) => console.log('delegated click'));
   */
  on(target, event, handlerOrSelector, delegateHandler) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (!element) {
      console.warn('DOMUtils.on: Target element not found');
      return () => {};
    }
    
    // Event delegation
    if (typeof handlerOrSelector === 'string') {
      const selector = handlerOrSelector;
      const handler = delegateHandler;
      
      const delegatedHandler = (e) => {
        const targetElement = e.target.closest(selector);
        if (targetElement && element.contains(targetElement)) {
          handler.call(targetElement, e);
        }
      };
      
      element.addEventListener(event, delegatedHandler);
      return () => element.removeEventListener(event, delegatedHandler);
    }
    
    // Direct event listener
    const handler = handlerOrSelector;
    element.addEventListener(event, handler);
    return () => element.removeEventListener(event, handler);
  },

  /**
   * Add event listener that fires only once
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Cleanup function
   * 
   * @example
   * DOMUtils.once(button, 'click', () => console.log('clicked once'));
   */
  once(target, event, handler) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (!element) {
      console.warn('DOMUtils.once: Target element not found');
      return () => {};
    }
    
    const onceHandler = (e) => {
      handler(e);
      element.removeEventListener(event, onceHandler);
    };
    
    element.addEventListener(event, onceHandler);
    return () => element.removeEventListener(event, onceHandler);
  },

  /**
   * Debounce function execution
   * Delays execution until after wait time has elapsed since last call
   * 
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @param {boolean} immediate - Execute on leading edge (default: false)
   * @returns {Function} Debounced function
   * 
   * @example
   * const debouncedSearch = DOMUtils.debounce((query) => {
   *   console.log('Searching for:', query);
   * }, 300);
   */
  debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
      const context = this;
      
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func.apply(context, args);
    };
  },

  /**
   * Throttle function execution
   * Ensures function is called at most once per specified time period
   * 
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   * 
   * @example
   * const throttledScroll = DOMUtils.throttle(() => {
   *   console.log('Scroll event');
   * }, 100);
   */
  throttle(func, limit) {
    let inThrottle;
    
    return function executedFunction(...args) {
      const context = this;
      
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Add CSS class(es) to element
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {...string} classes - Class names to add
   * @returns {HTMLElement|null} Target element
   * 
   * @example
   * DOMUtils.addClass(element, 'active', 'highlight');
   */
  addClass(target, ...classes) {
    const element = typeof target === 'string' ? this.query(target) : target;
    if (element) {
      element.classList.add(...classes);
    }
    return element;
  },

  /**
   * Remove CSS class(es) from element
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {...string} classes - Class names to remove
   * @returns {HTMLElement|null} Target element
   * 
   * @example
   * DOMUtils.removeClass(element, 'active', 'highlight');
   */
  removeClass(target, ...classes) {
    const element = typeof target === 'string' ? this.query(target) : target;
    if (element) {
      element.classList.remove(...classes);
    }
    return element;
  },

  /**
   * Toggle CSS class(es) on element
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {string} className - Class name to toggle
   * @param {boolean} force - Force add (true) or remove (false)
   * @returns {boolean} True if class is now present
   * 
   * @example
   * DOMUtils.toggleClass(element, 'active');
   */
  toggleClass(target, className, force) {
    const element = typeof target === 'string' ? this.query(target) : target;
    if (element) {
      return element.classList.toggle(className, force);
    }
    return false;
  },

  /**
   * Check if element has CSS class
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {string} className - Class name to check
   * @returns {boolean} True if element has class
   * 
   * @example
   * if (DOMUtils.hasClass(element, 'active')) { }
   */
  hasClass(target, className) {
    const element = typeof target === 'string' ? this.query(target) : target;
    return element ? element.classList.contains(className) : false;
  },

  /**
   * Smooth scroll to element or position
   * 
   * @param {Object} options - Scroll options
   * @param {HTMLElement|string} options.target - Target element or selector
   * @param {number} options.top - Scroll to Y position
   * @param {number} options.left - Scroll to X position
   * @param {string} options.behavior - Scroll behavior: 'smooth' or 'auto' (default: 'smooth')
   * @param {number} options.offset - Offset from target (default: 0)
   * @param {HTMLElement} options.container - Scroll container (default: window)
   * 
   * @example
   * DOMUtils.scrollTo({ target: '#section2', offset: -50 });
   */
  scrollTo(options = {}) {
    const {
      target,
      top,
      left,
      behavior = 'smooth',
      offset = 0,
      container = window
    } = options;
    
    if (target) {
      const element = typeof target === 'string' ? this.query(target) : target;
      if (element) {
        const rect = element.getBoundingClientRect();
        const scrollTop = container === window 
          ? window.pageYOffset 
          : container.scrollTop;
        
        container.scrollTo({
          top: scrollTop + rect.top + offset,
          behavior
        });
      }
    } else {
      container.scrollTo({
        top: top !== undefined ? top : container.scrollY,
        left: left !== undefined ? left : container.scrollX,
        behavior
      });
    }
  },

  /**
   * Check if element is visible in viewport
   * Uses Intersection Observer API when available
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {Object} options - Visibility options
   * @param {number} options.threshold - Visibility threshold 0-1 (default: 0)
   * @param {string} options.rootMargin - Root margin (default: '0px')
   * @returns {Promise<boolean>} Promise resolving to visibility state
   * 
   * @example
   * const isVisible = await DOMUtils.isVisible(element);
   */
  isVisible(target, options = {}) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (!element) {
      return Promise.resolve(false);
    }
    
    const { threshold = 0, rootMargin = '0px' } = options;
    
    // Fallback for browsers without IntersectionObserver
    if (!('IntersectionObserver' in window)) {
      const rect = element.getBoundingClientRect();
      return Promise.resolve(
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      );
    }
    
    return new Promise((resolve) => {
      const observer = new IntersectionObserver(
        (entries) => {
          resolve(entries[0].isIntersecting);
          observer.disconnect();
        },
        { threshold, rootMargin }
      );
      
      observer.observe(element);
    });
  },

  /**
   * Observe element visibility changes
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {Function} callback - Callback function (receives isVisible boolean)
   * @param {Object} options - Observer options
   * @param {number} options.threshold - Visibility threshold 0-1 (default: 0)
   * @param {string} options.rootMargin - Root margin (default: '0px')
   * @returns {Object} Observer object with disconnect method
   * 
   * @example
   * const observer = DOMUtils.observeVisibility(element, (isVisible) => {
   *   console.log('Element visible:', isVisible);
   * });
   * // Later: observer.disconnect();
   */
  observeVisibility(target, callback, options = {}) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (!element || !('IntersectionObserver' in window)) {
      return { disconnect: () => {} };
    }
    
    const { threshold = 0, rootMargin = '0px' } = options;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => callback(entry.isIntersecting));
      },
      { threshold, rootMargin }
    );
    
    observer.observe(element);
    return observer;
  },

  /**
   * Get element's position and dimensions
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @returns {DOMRect|null} Element rectangle
   * 
   * @example
   * const rect = DOMUtils.getRect(element);
   * console.log(rect.top, rect.left, rect.width, rect.height);
   */
  getRect(target) {
    const element = typeof target === 'string' ? this.query(target) : target;
    return element ? element.getBoundingClientRect() : null;
  },

  /**
   * Get element's offset position relative to document
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @returns {Object|null} Object with top and left properties
   * 
   * @example
   * const offset = DOMUtils.getOffset(element);
   * console.log(offset.top, offset.left);
   */
  getOffset(target) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (!element) return null;
    
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.pageYOffset,
      left: rect.left + window.pageXOffset
    };
  },

  /**
   * Set inline styles on element
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {Object} styles - Style properties
   * @returns {HTMLElement|null} Target element
   * 
   * @example
   * DOMUtils.setStyle(element, { color: 'red', fontSize: '16px' });
   */
  setStyle(target, styles) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (element) {
      Object.entries(styles).forEach(([key, value]) => {
        element.style[key] = value;
      });
    }
    
    return element;
  },

  /**
   * Get computed style value
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {string} property - CSS property name
   * @returns {string} Computed style value
   * 
   * @example
   * const color = DOMUtils.getStyle(element, 'color');
   */
  getStyle(target, property) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (!element) return '';
    
    return window.getComputedStyle(element)[property];
  },

  /**
   * Show element (remove display: none)
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {string} display - Display value (default: 'block')
   * @returns {HTMLElement|null} Target element
   * 
   * @example
   * DOMUtils.show(element);
   * DOMUtils.show(element, 'flex');
   */
  show(target, display = 'block') {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (element) {
      element.style.display = display;
    }
    
    return element;
  },

  /**
   * Hide element (set display: none)
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @returns {HTMLElement|null} Target element
   * 
   * @example
   * DOMUtils.hide(element);
   */
  hide(target) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (element) {
      element.style.display = 'none';
    }
    
    return element;
  },

  /**
   * Toggle element visibility
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {string} display - Display value when showing (default: 'block')
   * @returns {boolean} True if now visible
   * 
   * @example
   * DOMUtils.toggle(element);
   */
  toggle(target, display = 'block') {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (!element) return false;
    
    const isHidden = window.getComputedStyle(element).display === 'none';
    element.style.display = isHidden ? display : 'none';
    
    return isHidden;
  },

  /**
   * Remove element from DOM
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @returns {HTMLElement|null} Removed element
   * 
   * @example
   * DOMUtils.remove(element);
   */
  remove(target) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    
    return element;
  },

  /**
   * Empty element (remove all children)
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @returns {HTMLElement|null} Target element
   * 
   * @example
   * DOMUtils.empty(container);
   */
  empty(target) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (element) {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }
    
    return element;
  },

  /**
   * Get or set element attribute
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {string|Object} attr - Attribute name or object of attributes
   * @param {string} value - Attribute value (if attr is string)
   * @returns {string|null|HTMLElement} Attribute value or element
   * 
   * @example
   * DOMUtils.attr(element, 'data-id', '123');
   * const id = DOMUtils.attr(element, 'data-id');
   */
  attr(target, attr, value) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (!element) return null;
    
    // Get attribute
    if (typeof attr === 'string' && value === undefined) {
      return element.getAttribute(attr);
    }
    
    // Set single attribute
    if (typeof attr === 'string') {
      element.setAttribute(attr, value);
      return element;
    }
    
    // Set multiple attributes
    if (typeof attr === 'object') {
      Object.entries(attr).forEach(([key, val]) => {
        element.setAttribute(key, val);
      });
      return element;
    }
    
    return null;
  },

  /**
   * Remove attribute from element
   * 
   * @param {HTMLElement|string} target - Target element or selector
   * @param {string} attr - Attribute name
   * @returns {HTMLElement|null} Target element
   * 
   * @example
   * DOMUtils.removeAttr(element, 'disabled');
   */
  removeAttr(target, attr) {
    const element = typeof target === 'string' ? this.query(target) : target;
    
    if (element) {
      element.removeAttribute(attr);
    }
    
    return element;
  },

  /**
   * Wait for DOM to be ready
   * 
   * @param {Function} callback - Callback function
   * 
   * @example
   * DOMUtils.ready(() => {
   *   console.log('DOM is ready');
   * });
   */
  ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  },

  /**
   * Create a simple cache for query results
   * 
   * @returns {Object} Cache object with get and clear methods
   * 
   * @example
   * const cache = DOMUtils.createQueryCache();
   * const button = cache.get('.my-button');
   */
  createQueryCache() {
    const cache = new Map();
    
    return {
      get(selector, context = document) {
        const key = `${selector}:${context}`;
        
        if (!cache.has(key)) {
          const element = context.querySelector(selector);
          if (element) {
            cache.set(key, element);
          }
        }
        
        return cache.get(key) || null;
      },
      
      clear() {
        cache.clear();
      }
    };
  }
};

// Export module (ES6)
export default DOMUtils;
