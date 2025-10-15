export async function sendRawCompletionRequest({
    model,
    prompt,
    temperature = 0.7,
    api = 'openai',
    endpoint = null,
    apiKey = null,
    extra = {},
}) {
    let url = getCurrentCompletionEndpoint();
    let headers = getRequestHeaders();

    let body = {
        messages: [
            { role: 'user', content: prompt }
        ],
        model,
        temperature,
        chat_completion_source: api,
        ...extra,
    };

    // Handle full-manual configuration with direct endpoint calls
    if (api === 'full-manual' && endpoint && apiKey) {
        url = endpoint;
        headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };
        // For direct endpoint calls, use standard OpenAI-compatible format
        body = {
            model,
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature,
            ...extra,
        };
    } else if (api === 'custom' && model) {
        body.custom_model_id = model;
        body.custom_url = oai_settings.custom_url || '';
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        throw new Error(`LLM request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    let text = '';

    // Handle different response formats
    if (data.choices?.[0]?.message?.content) {
        text = data.choices[0].message.content;
    } else if (data.completion) {
        text = data.completion;
    } else if (data.choices?.[0]?.text) {
        text = data.choices[0].text;
    } else if (data.content && Array.isArray(data.content)) {
        // Handle Claude's new structured format directly in raw response
        const textBlock = data.content.find(block =>
            block && typeof block === 'object' && block.type === 'text' && block.text
        );
        text = textBlock?.text || '';
    } else if (typeof data.content === 'string') {
        text = data.content;
    }

    return { text, full: data };
}