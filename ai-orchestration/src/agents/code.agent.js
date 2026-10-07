import "dotenv/config";

import { ChatGroq } from "@langchain/groq";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatGoogle } from "@langchain/google/node"; 

import { listFiles, readFiles, updateFiles } from "./tool.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";


// ─── Model registry ─────────────────────────────────────────────────────────
// Each entry is one selectable model. Adding a provider = adding one entry.
// The client only ever sends the entry's id (the key); it never sends a raw
// model name or an API key.
const MODELS = {
    "groq/gpt-oss-120b": {
        label: "GPT-OSS 120B (Groq)",
        provider: "groq",
        envKey: "GROQ_API_KEY",
        create: () => new ChatGroq({ model: "openai/gpt-oss-120b", apiKey: process.env.GROQ_API_KEY, temperature: 0, maxRetries: 0 }),
    },
    "mistral/small": {
        label: "Mistral Small",
        provider: "mistral",
        envKey: "MISTRAL_API_KEY",
        create: () => new ChatMistralAI({ model: "mistral-small-latest", apiKey: process.env.MISTRAL_API_KEY, temperature: 0, maxRetries: 0 }),
    },
    "google/gemini-flash": {
        label: "Gemini Flash (Google)",
        provider: "google",
        envKey: "GEMINI_API_KEY",
        create: () => new ChatGoogle({ model: "gemini-3.7-flash", apiKey: process.env.GEMINI_API_KEY, maxRetries: 0 }),
    },
};


export const DEFAULT_MODEL = "groq/gpt-oss-120b";

// Only models whose API key is present in the environment are offered.
export function listAvailableModels() {
    return Object.entries(MODELS)
        .filter(([, m]) => process.env[m.envKey])
        .map(([id, m]) => ({ id, label: m.label, provider: m.provider }));
}

// ─── Agent ──────────────────────────────────────────────────────────────────
 
// In-memory checkpointer — saves agent state after each successful step.
// On 429 retry, the agent resumes from the last checkpoint instead of
// restarting the entire conversation from scratch.
// Shared by every per-model agent; thread ids keep the runs separate.
const checkpointer = new MemorySaver();





const SYSTEM_PROMPT = `You are a senior frontend engineer AI that builds and edits polished, production-quality websites inside a live sandbox. You work exclusively on a React + Vite (JavaScript) project that already exists — you never scaffold a new project.

## YOUR TOOLS
- list_files — see what exists in the project
- read_files — fetch current contents of specific files (only unread ones are re-fetched; already-read files return a placeholder, so never re-request a file you've already read in this task)
- update_files — write new/changed file contents (also creates new files)

## STARTING TEMPLATE STRUCTURE
public/favicon.svg, public/icons.svg
src/assets/ (hero.png, react.svg, vite.svg)
src/App.jsx, src/App.css, src/index.css, src/main.jsx
index.html, vite.config.js, package.json

## WORKFLOW (follow in order, every task)
1. If you don't already know the file list from earlier in this task, call list_files once.
2. Read ONLY the files you actually need to understand or modify for this specific request — never read the whole project "just in case." Most tasks touch 2–5 files.
3. Plan the change mentally before writing any tool call. Decide the full final content of each file you'll touch.
4. Call update_files ONCE with every changed/new file included together, not one file per call.
5. After update_files succeeds, respond to the user with a short, plain-language summary of what changed — 2–5 sentences. NEVER paste the file contents back into your reply; the user sees the result in the live preview, not in chat.

## EFFICIENCY RULES (critical — context is token-limited)
- Never re-read a file you've already read in this task.
- Never call list_files more than once per task.
- Never make a "let me double check" tool call after a successful update — trust the tool's success response.
- Keep your own reasoning terse. Do not narrate every step to the user.
- DO NOT output text like "I am listing files", "Reading files...", or "Files listed successfully: ...". The UI handles tool progress automatically. ONLY output conversational text when you are done with all tool calls and providing the final summary.
- NEVER output raw file contents or file lists in your conversational text response.
- If a task only requires editing 1–2 files, do not touch anything else.
- Prefer editing existing files over creating new ones unless the task clearly calls for new components/pages.

## CODE QUALITY STANDARDS
- Write complete, valid, runnable JSX/CSS — no placeholders like "// rest of code", no TODOs, no broken imports.
- Use semantic HTML5 elements (header, nav, main, section, footer, etc.), not div-soup.
- Mobile-first, responsive layouts using CSS Grid/Flexbox — test your mental model against at least 375px and 1280px widths.
- Keep a consistent visual system: reuse CSS custom properties already defined in src/index.css / src/App.css (colors, spacing, radii) rather than inventing new one-off values. If none exist yet for a new project theme, define a small set of CSS variables once at the top of the relevant stylesheet and reuse them throughout.
- Accessible by default: alt text on images, proper label/input pairing, sufficient color contrast, visible focus states, aria-labels on icon-only buttons.
- No lorem-ipsum walls of text — write short, realistic, relevant copy for whatever the site is about.
- For images you don't have a real asset for, use a clearly labeled placeholder approach (existing assets in src/assets, or a placeholder image service) rather than broken paths.
- Componentize when it improves clarity (e.g. src/components/Header.jsx) but don't over-engineer a simple one-page site into a dozen tiny files.

## BOUNDARIES
- Do not modify package.json, vite.config.js, index.html, or add new npm dependencies unless the user's request explicitly requires it (e.g. "add react-router").
- Do not remove existing functionality unless asked to replace it.
- Stay within plain React + Vite + JS + CSS — no TypeScript, no CSS-in-JS libraries, no UI kits, unless the user asks for them.

## INPUT
The user will describe, in one message, what kind of website or change they want (e.g. "build me a landing page for a coffee shop" or "add a testimonials section"). Treat each user message as the full spec for that task — infer sensible defaults for anything unstated rather than asking clarifying questions, unless the request is genuinely too ambiguous to act on.

## OUTPUT
Your final reply to the user is a short confirmation of what you built or changed — never a code dump, never the raw tool output.`


const agents = new Map();

function getAgent(modelId) {

    if (!MODELS[modelId]) {
        throw new Error(`Unknown model: ${modelId}`);
    }

    if (!agents.has(modelId)) {
        agents.set(modelId, createReactAgent({
            llm: MODELS[modelId].create(),
            tools: [listFiles, readFiles, updateFiles],
            checkpointer,
            prompt: SYSTEM_PROMPT,
        }).withConfig({ recursionLimit: 100 }));
    }
    return agents.get(modelId);
}


// Retry-with-backoff for streaming that RESUMES via checkpointer, not restarts.
async function* streamWithRetry(agent, input, config, maxRetries = 3) {
    let currentInput = input;
 
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const stream = await agent.stream(currentInput, config);
            for await (const chunk of stream) {
                yield chunk;
            }
            return; // Success, exit generator
        } catch (err) {
            const errMsg = err?.message || String(err);
            const isRateLimit = err?.status === 429
                || errMsg.includes("429")
                || errMsg.includes("rate_limit")
                || errMsg.includes("RateLimitError");
 
            if (!isRateLimit || attempt === maxRetries) {
                console.error(`\n❌ Agent failed permanently after ${attempt} attempt(s).`);
                console.error(`   Error: ${errMsg.slice(0, 300)}`);
                throw new Error(`Agent failed permanently: ${errMsg.slice(0, 300)}`);
            }
 
            // Parse wait time from Groq error — match all known formats:
            const match = errMsg.match(/(?:try again in|retry after|Please retry after)\s*(\d+(?:\.\d+)?)\s*s/i);
            const rawWait = match ? parseFloat(match[1]) : null;
            const waitSec = rawWait !== null ? rawWait + 2 : 30; // +2s buffer; 30s default if unparseable
 
            console.log(`\n⏳ Rate limited (attempt ${attempt}/${maxRetries}). Sleeping ${waitSec}s...`);
            
            // Yield a custom event so the frontend knows we are rate limited and waiting
            const id = Date.now().toString();
            yield ["custom", { id, tool: "rate_limit_wait", status: "running", label: `Rate limit reached. Resuming in ${Math.ceil(waitSec)}s` }];
            
            await new Promise(r => setTimeout(r, waitSec * 1000));
            
            yield ["custom", { id, tool: "rate_limit_wait", status: "success", label: "Resumed from rate limit" }];
 
            // On retry, send empty messages — the checkpointer already has the
            // full conversation state, so the graph picks up from where it stopped.
            currentInput = { messages: [] };
        }
    }
}

export async function runAgent(userMessage, projectId, modelId = DEFAULT_MODEL) {
    const threadId = `task-${projectId}-${Date.now()}`;
    const agent = getAgent(modelId);
    
    return streamWithRetry(
        agent,
        { messages: [{ role: "user", content: userMessage }] },
        {
            configurable: { thread_id: threadId, projectId },
            streamMode: ["custom", "messages"],
        }
    );
}