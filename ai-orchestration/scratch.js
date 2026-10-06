import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { FakeListChatModel } from "@langchain/core/utils/testing";

const myTool = tool(async () => "hi", { name: "my_tool", description: "foo", schema: {} });
const llm = new FakeListChatModel({ responses: ["I will call the tool", { tool_calls: [{ name: "my_tool", args: {}, id: "1" }] }, "done"] });
const agent = createReactAgent({ llm, tools: [myTool] });

async function run() {
    const stream = await agent.stream({ messages: [{ role: "user", content: "hi" }] }, { streamMode: ["custom", "messages"] });
    for await (const chunk of stream) {
        console.log("IS ARRAY:", Array.isArray(chunk));
        console.log("CHUNK:", JSON.stringify(chunk));
    }
}
run().catch(console.error);
