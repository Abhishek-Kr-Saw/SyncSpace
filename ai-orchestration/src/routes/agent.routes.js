import { Router } from 'express';
import { runAgent, listAvailableModels, DEFAULT_MODEL } from '../agents/code.agent.js';
import { HistoryEvent, mongoClient } from '../db.js';

const agentRouter = Router();

import mongoose from 'mongoose';

agentRouter.get('/history/:projectId', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ history: [] });
        }
        const history = await HistoryEvent.find({ projectId: req.params.projectId }).sort({ createdAt: 1 });
        res.json({ history });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

agentRouter.delete('/history/:projectId', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ success: true });
        }
        const projectId = req.params.projectId;
        await HistoryEvent.deleteMany({ projectId });
        
        if (mongoClient) {
           const db = mongoClient.db();
           await db.collection("checkpoints").deleteMany({ thread_id: `project-${projectId}` }).catch(e => console.error(e));
           await db.collection("checkpoint_blobs").deleteMany({ thread_id: `project-${projectId}` }).catch(e => console.error(e));
           await db.collection("checkpoint_writes").deleteMany({ thread_id: `project-${projectId}` }).catch(e => console.error(e));
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to clear history" });
    }
});

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
        res.write(': connected\n\n');

        // Abort streaming when client disconnects to save API tokens
        let clientDisconnected = false;
        req.on('aborted', () => { 
            console.log(`[DEBUG] req.on('aborted') fired for project ${projectId}`);
            clientDisconnected = true; 
        });
        req.on('close', () => {
            // Check if it's genuinely disconnected or just the request stream ending
            if (res.socket && res.socket.destroyed) {
                console.log(`[DEBUG] req.on('close') fired and socket is destroyed for project ${projectId}`);
                clientDisconnected = true;
            }
        });

        const saveAssistantMessage = (content) => {
            const eventId = Date.now().toString() + Math.random().toString(36).substring(2);
            HistoryEvent.create({ projectId, eventId, type: 'assistant', content }).catch(e => console.error("Failed to save AI msg", e));
        };

        const userEventId = Date.now().toString() + Math.random().toString(36).substring(2);
        HistoryEvent.create({ projectId, eventId: userEventId, type: 'user', content: message }).catch(e => console.error(e));

        let stream = await runAgent(message, projectId,modelId);

        let currentMessageId = null;
        let currentMessageBuffer = "";
        let currentMessageHasToolCalls = false;
        
        let hasSentFinalMessage = false;
        const updatedFiles = new Set();

        for await (const [mode, payload] of stream) {
            
            if (clientDisconnected) break;

            if (mode === "custom") {
                console.log("CUSTOM EVENT PAYLOAD:", JSON.stringify(payload));
                
                let eventData = payload;
                // dispatchCustomEvent in JS wraps the data
                if (payload && payload.name && payload.data) {
                    eventData = payload.data;
                }
                
                if (eventData && eventData.tool) {
                    if (eventData.tool === 'update_files' && eventData.paths) {
                        eventData.paths.forEach(p => updatedFiles.add(p));
                    }
                    res.write(`event: tool\ndata: ${JSON.stringify(eventData)}\n\n`);
                    
                    const type = eventData.tool === 'rate_limit_wait' ? 'rate_limit' : 'tool';
                    HistoryEvent.findOneAndUpdate(
                        { projectId, eventId: eventData.id },
                        {
                            type,
                            tool: eventData.tool,
                            status: eventData.status,
                            message: eventData.message,
                            paths: eventData.paths || []
                        },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    ).catch(e => console.error("Failed to save tool event to history", e));
                }
            } else if (mode === "messages") {
                const [messageChunk, metadata] = payload;
                
                // Accept only AI messages (skip tool, human, system messages)
                const isAiMessage = (messageChunk?.constructor?.name === "AIMessageChunk") || (messageChunk?._getType?.() === 'ai') || (messageChunk?.type === 'ai');
                if (!isAiMessage) {
                    continue;
                }
                
                if (currentMessageId !== messageChunk.id) {
                    if (currentMessageId !== null && !currentMessageHasToolCalls && currentMessageBuffer.trim()) {
                        res.write(`event: message\ndata: ${JSON.stringify({ content: currentMessageBuffer })}\n\n`);
                        saveAssistantMessage(currentMessageBuffer);
                        hasSentFinalMessage = true;
                    }
                    currentMessageId = messageChunk.id;
                    currentMessageBuffer = "";
                    currentMessageHasToolCalls = false;
                }

                if (messageChunk?.tool_call_chunks && messageChunk.tool_call_chunks.length > 0) {
                    currentMessageHasToolCalls = true;
                }

                if (messageChunk?.content && typeof messageChunk.content === 'string') {
                    currentMessageBuffer += messageChunk.content;
                }
            }
        }

        if (!clientDisconnected) {
            if (currentMessageId !== null && !currentMessageHasToolCalls && currentMessageBuffer.trim()) {
                res.write(`event: message\ndata: ${JSON.stringify({ content: currentMessageBuffer })}\n\n`);
                saveAssistantMessage(currentMessageBuffer);
                hasSentFinalMessage = true;
            }
            
            // Fallback summary if model finishes without text after updating files
            if (!hasSentFinalMessage && updatedFiles.size > 0) {
                const fileList = Array.from(updatedFiles).map((f, i) => `${i + 1}. **${f.split('/').pop()}**`).join('\n');
                const fallbackText = `I have successfully applied your changes.\n\n### Changes\n${fileList}\n\nLet me know if you need anything else!`;
                res.write(`event: message\ndata: ${JSON.stringify({ content: fallbackText })}\n\n`);
                saveAssistantMessage(fallbackText);
            }
            
            console.log(`[DEBUG] Stream finished normally for project ${projectId}. Sending event: done.`);
            res.write('event: done\ndata: {}\n\n');
            res.end();
        } else {
            console.log(`[DEBUG] Client disconnected for project ${projectId}. Stream aborted.`);
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