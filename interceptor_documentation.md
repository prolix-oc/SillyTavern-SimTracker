Prompt Interceptors

Prompt Interceptors provide a way for extensions to perform any activity such as modifying the chat data, adding injections, or aborting the generation before a text generation request is made.

Interceptors from different extensions are run sequentially. The order is determined by the `loading_order` field in their respective `manifest.json` files. Extensions with lower `loading_order` values run earlier. If `loading_order` is not specified, `display_name` is used as a fallback. If neither is specified, the order is undefined.

#Registering an Interceptor

To define a prompt interceptor, add a generate_interceptor field to your extension's manifest.json file. The value should be the name of a global function that will be called by SillyTavern.

```
{
    "display_name": "My Interceptor Extension",
    "loading_order": 10, // Affects execution order
    "generate_interceptor": "myCustomInterceptorFunction",
    // ... other manifest properties
}
```

#Interceptor Function

The `generate_interceptor` function is a global function that will be called upon generation requests that are not dry runs. It must be defined in the global scope (e.g., `globalThis.myCustomInterceptorFunction = async function(...) { ... })` and can return a Promise if it needs to perform any asynchronous operations.

The interceptor function receives the following arguments:

- `chat`: An array of message objects representing the chat history that will be used for prompt building. You can modify this array directly (e.g., add, remove, or alter messages). Please note that messages are mutable, so any changes you make to the array will be reflected in the actual chat history. If you want the changes to be ephemeral, use `structuredClone` to create a deep copy of the message object.
- `contextSize`: A number indicating the current context size (in tokens) calculated for the upcoming generation.
abort: A function that, when called, will signal to prevent the text generation from proceeding. It accepts a boolean parameter that prevents any subsequent interceptors from running if true.
type: A string indicating the type or trigger of the generation (e.g., `'quiet'`, `'regenerate'`, `'impersonate'`, `'swipe'`, etc.). This helps the interceptor apply logic conditionally based on how the generation was initiated.

Example Implementation:

```
globalThis.myCustomInterceptorFunction = async function(chat, contextSize, abort, type) {
    // Example: Add a system note before the last user message
    const systemNote = {
        is_user: false,
        name: "System Note",
        send_date: Date.now(),
        mes: "This was added by my extension!"
    };
    // Insert before the last message
    chat.splice(chat.length - 1, 0, systemNote);
}
```