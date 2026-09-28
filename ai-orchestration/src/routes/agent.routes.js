import { Router } from 'express';
import { runAgent, listAvailableModels, DEFAULT_MODEL } from '../agents/code.agent.js';

const agentRouter = Router();

// Short, key-safe description of a provider error, e.g. "429: Too Many Requests"
function describeError(err) {
    const status = err?.status ?? err?.response?.status;
    const msg = String(err?.message || err)
        .replace(/key=[^&\s"']+/gi, 'key=***')   // never echo API keys
        .replace(/\s+/g, ' ')
        .slice(0, 300);
    return status ? `${status}: ${msg}` : msg;
}

// Models the frontend can offer (only those whose API key is configured)
agentRouter.get('/models', (req, res) => {
    res.json({ models: listAvailableModels(), default: DEFAULT_MODEL });
});


agentRouter.post('/invoke', async(req,res) => {
    try{
        const { message, projectId, model } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: "Request body must include a 'message' string" });
        }

        if (!projectId || typeof projectId !== 'string') {
            return res.status(400).json({ error: "Request body must include a 'projectId' string" });
        }


        // Validate against the server-side allowlist. The client only sends an id.
        const modelId = model ?? DEFAULT_MODEL;
        const available = listAvailableModels();
        if (typeof modelId !== 'string' || !available.some((m) => m.id === modelId)) {
            return res.status(400).json({ error: `Model not available: ${modelId}` });
        }


        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Abort streaming when client disconnects to save API tokens
        let clientDisconnected = false;
        req.on('close', () => { clientDisconnected = true; });

        const stream = await runAgent(message, projectId,modelId); // now returns the agent's stream iterator

        for await (const [mode, payload] of stream) {
            
            if (clientDisconnected) break;

            if (mode === "custom") {
                res.write(`event: tool\ndata: ${JSON.stringify(payload)}\n\n`);
            } else if (mode === "messages") {
                const [messageChunk] = payload;
                if (messageChunk?.content) {
                    res.write(`event: message\ndata: ${JSON.stringify({ content: messageChunk.content })}\n\n`);
                }
            }
        }

        if (!clientDisconnected) {
            res.write('event: done\ndata: {}\n\n');
            res.end();
        }
            
    }catch(error){
        console.log("Error invoking agent : ", error);
        const reason = describeError(error);
        const text = `Failed to invoke agent (${reason})`;
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to invoke agent" });
        } else {
            res.write(`event: error\ndata: ${JSON.stringify({ error: text })}\n\n`);
            res.end();
        }
    }
})

export default agentRouter;