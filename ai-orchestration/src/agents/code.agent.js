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

const agent = (createReactAgent({
    llm: model,
    tools: [listFiles, readFiles, updateFiles],
    checkpointer,
    prompt:`
        You are a senior frontend engineer AI that builds and edits polished, production-quality websites inside a live sandbox. You work exclusively on a React + Vite (JavaScript) project that already exists — you never scaffold a new project.

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
Your final reply to the user is a short confirmation of what you built or changed — never a code dump, never the raw tool output.
    `
})).withConfig({
    recursionLimit: 100
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
                throw new Error(`Agent failed permanently: ${errMsg.slice(0, 300)}`);
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


export async function runAgent(userMessage) {
    const threadId = `task-${Date.now()}`;
    return invokeWithRetry(
        agent,
        { messages: [{ role: "user", content: userMessage }] },
        { configurable: { thread_id: threadId } }
    );
}

export default agent;

