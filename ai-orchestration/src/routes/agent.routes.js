import { Router } from 'express';
import { runAgent } from '../agents/code.agent.js';

const agentRouter = Router();

agentRouter.post('/invoke', async(req,res) => {
    try{
        const { message, projectId } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: "Request body must include a 'message' string" });
        }

        if (!projectId || typeof projectId !== 'string') {
            return res.status(400).json({ error: "Request body must include a 'projectId' string" });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Abort streaming when client disconnects to save API tokens
        let clientDisconnected = false;
        req.on('close', () => { clientDisconnected = true; });

        const stream = await runAgent(message, projectId); // now returns the agent's stream iterator

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
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to invoke agent" });
        } else {
            res.write(`event: error\ndata: ${JSON.stringify({ error: "Failed to invoke agent" })}\n\n`);
            res.end();
        }
    }
})

export default agentRouter;