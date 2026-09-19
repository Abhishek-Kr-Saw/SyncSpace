/**
 * Parse Server-Sent Events from a ReadableStream.
 * Yields { event: string, data: string } for each complete SSE frame.
 *
 * SSE frames follow the format:
 *   event: <type>\n
 *   data: <json>\n
 *   \n
 *
 * This handles partial chunks correctly by buffering incomplete lines.
 */
export async function* parseSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on double newlines to find complete SSE frames
      const frames = buffer.split('\n\n');
      // Last element is either empty or an incomplete frame — keep it in buffer
      buffer = frames.pop() || '';

      for (const frame of frames) {
        if (!frame.trim()) continue;

        let event = 'message';
        let data = '';

        for (const line of frame.split('\n')) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            data = line.slice(6);
          }
        }

        if (data) {
          try {
            yield { event, data: JSON.parse(data) };
          } catch {
            yield { event, data: data };
          }
        }
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* already closed */ }
    reader.releaseLock();
  }
}
