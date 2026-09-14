import { Router } from 'express';
import { runAgent } from '../agents/code.agent.js';

const agentRouter = Router();

agentRouter.post('/invoke', async(req,res) => {
    try{
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: "Request body must include a 'message' string" });
        }

        const result = await runAgent(message);

        const finalMessage = result.messages?.[result.messages.length - 1];

        res.json({ response: finalMessage?.content ?? result });
        
    }catch(error){
        console.log("Error invoking agent : ", error)
        res.status(500).json({ error: "Failed to invoke agent"})
    }
})

export default agentRouter;