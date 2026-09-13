import "dotenv/config";
import { ChatGroq } from "@langchain/groq";
import { listFiles, readFiles, updateFiles } from "./tool.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";

const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0,
})

// In-memory checkpointer — saves agent state after each successful step.
// On 429 retry, the agent resumes from the last checkpoint instead of
// restarting the entire conversation from scratch.
const checkpointer = new MemorySaver();

const agent = createReactAgent({
    llm: model,
    tools: [listFiles, readFiles, updateFiles],
    checkpointer,
})

// Retry-with-backoff that RESUMES via checkpointer, not restarts.
//
// How it works:
//   1st call:  agent.invoke({ messages: [user prompt] })  → starts fresh
//   On 429:    waits for Groq's requested cooldown + buffer
//   Retry:     agent.invoke({ messages: [] })              → resumes from last checkpoint
//
// The checkpointer saved all prior model responses and tool results,
// so the retry picks up at the exact model call that failed — no re-listing
// or re-reading files, no duplicate tokens.
async function invokeWithRetry(agent, input, config, maxRetries = 3) {
    let currentInput = input;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await agent.invoke(currentInput, config);
        } catch (err) {
            const errMsg = err?.message || String(err);
            const isRateLimit = err?.status === 429
                || errMsg.includes("429")
                || errMsg.includes("rate_limit")
                || errMsg.includes("RateLimitError");

            if (!isRateLimit || attempt === maxRetries) {
                console.error(`\n❌ Agent failed permanently after ${attempt} attempt(s).`);
                console.error(`   Error: ${errMsg.slice(0, 300)}`);
                console.error(`   The task could not be completed within the rate limit. Try again later.`);
                process.exit(1);
            }

            // Parse wait time from Groq error — match all known formats:
            //   "try again in 42.5s", "retry after 30s", "Please retry after 15.2s"
            const match = errMsg.match(/(?:try again in|retry after|Please retry after)\s*(\d+(?:\.\d+)?)\s*s/i);
            const rawWait = match ? parseFloat(match[1]) : null;
            const waitSec = rawWait !== null ? rawWait + 2 : 30; // +2s buffer; 30s default if unparseable

            console.log(`\n⏳ Rate limited (attempt ${attempt}/${maxRetries}).`);
            console.log(`   Raw error: "${errMsg.slice(0, 200)}"`);
            console.log(`   Parsed wait: ${rawWait !== null ? rawWait + "s (from error) + 2s buffer" : "not found in error, using default 30s"} → sleeping ${waitSec}s`);
            console.log(`   Will RESUME from last checkpoint (not restart).`);

            await new Promise(r => setTimeout(r, waitSec * 1000));

            // On retry, send empty messages — the checkpointer already has the
            // full conversation state, so the graph picks up from where it stopped.
            currentInput = { messages: [] };
        }
    }
}

const threadId = `task-${Date.now()}`;

await invokeWithRetry(
    agent,
    {
        messages: [
            {
                role: "user",
                content: "Create a simple tic tac toe using react and css"
            }
        ]
    },
    { configurable: { thread_id: threadId } }
);
