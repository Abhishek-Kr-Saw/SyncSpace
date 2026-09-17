import axios from "axios";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

const readCache = new Map();

export const listFiles = tool(
    async({ }, config) => {

        const writer = config.writer;
        writer?.({ type: "tool_call", tool: "list_files", status: "start" });

        const projectId = config.configurable?.projectId;
        const response = await axios.get(`http://sandbox-service-${projectId}:3000/list-files`)

        writer?.({ type: "tool_call", tool: "list_files", status: "end", files: response.data.files });
        return JSON.stringify(response.data.files);
    },
    {
        name: "list_files",
        description: "List all the files in the project directory. This is useful for understanding what files are available to work with.",
        schema: z.object({})
    }
)


export const readFiles = tool(
    async ({ files }, config) => {

        const writer = config.writer;
        writer?.({ type: "tool_call", tool: "read_files", status: "start", files });

        // Scope cache by thread_id so different projects don't collide
        const threadId = config.configurable?.thread_id || '';
        const scopedKey = (f) => `${threadId}:${f}`;

        const uncachedFiles = files.filter(f => !readCache.has(scopedKey(f)));
        const results = {};

        // Return cached placeholder for already-read files
        for (const f of files) {
            if (readCache.has(scopedKey(f))) {
                results[f] = "(already provided earlier in this conversation)";
            }
        }

        // Only fetch files we haven't read yet
        if (uncachedFiles.length > 0) {
            const projectId = config.configurable?.projectId;
            const response = await axios.get(`http://sandbox-service-${projectId}:3000/read-files?files=` + uncachedFiles.join(','));

            // Cache the new results and merge
            for (const fileObj of response.data.files) {
                for (const [filePath, content] of Object.entries(fileObj)) {
                    readCache.set(scopedKey(filePath), true);
                    results[filePath] = content;
                }
            }
        }
        writer?.({ type: "tool_call", tool: "read_files", status: "end", files });
        return JSON.stringify({ message: "File contents", files: results });
    },
    {
        name: "read_files",
        description: "Read the contents of specified files. Do NOT request files you have already read earlier in this conversation — their content is already in your context. Only request new or unread files.",
        schema: z.object({
            files: z.array(z.string()).describe("The list of files absolute paths to read. These should be files that were listed using the list_files tool or created later. Do not re-request files already read.")
        })
    }
)


export const updateFiles = tool(
    async ({ files }, config) => {

        const writer = config.writer;
        writer?.({ type: "tool_call", tool: "update_files", status: "start", files: fileNames });

        const projectId = config.configurable?.projectId;
        const response = await axios.patch(`http://sandbox-service-${projectId}:3000/update-files`, {files})

        writer?.({ type: "tool_call", tool: "update_files", status: "end", files: fileNames });

        return JSON.stringify(response.data);
    },
    {
        name: "update_files",
        description: "Update the contents of specified files. This is useful for making changes to files based on the requirements of the task at hand. this tool can also use to create new files by providing a new file name in the file field and the content to be added in the content field.",
        schema: z.object({
            files: z.array(z.object({
                file: z.string().describe("The absolute path of the file to update"),
                content: z.string().describe("The new content for the file, the content should support json format.")
            })).describe("The list of files to update and their new contents")
        })
    }
)