import axios from "axios";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

// Per-process cache: resets on each `node code.agent.js` run
const readCache = new Map();

export const listFiles = tool(
    async({ }) => {

        console.log("--------------------------------------")
        console.log("List files tool is used")
        console.log("--------------------------------------")

        const response = await axios.get("http://sandbox-service-01a09f11-2b1d-7378-b41a-eb2cfbecce33:3000/list-files")

        console.log("--------------------------------------")
        console.log("Response from list files", response.data.files)
        console.log("--------------------------------------")

        return JSON.stringify(response.data.files);
    },
    {
        name: "list_files",
        description: "List all the files in the project directory. This is useful for understanding what files are available to work with.",
        schema: z.object({})
    }
)


export const readFiles = tool(
    async ({ files }) => {

        console.log("--------------------------------------")
        console.log("Read files tool is used", files)
        console.log("--------------------------------------")

        const uncachedFiles = files.filter(f => !readCache.has(f));
        const results = {};

        // Return cached placeholder for already-read files
        for (const f of files) {
            if (readCache.has(f)) {
                results[f] = "(already provided earlier in this conversation)";
            }
        }

        // Only fetch files we haven't read yet
        if (uncachedFiles.length > 0) {
            const response = await axios.get("http://sandbox-service-01a09f11-2b1d-7378-b41a-eb2cfbecce33:3000/read-files?files=" + uncachedFiles.join(','));

            // Cache the new results and merge
            for (const fileObj of response.data.files) {
                for (const [filePath, content] of Object.entries(fileObj)) {
                    readCache.set(filePath, true);
                    results[filePath] = content;
                }
            }
        }

        console.log("--------------------------------------")
        console.log(`Read files: ${uncachedFiles.length} fetched, ${files.length - uncachedFiles.length} cached`)
        console.log("--------------------------------------")

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
    async ({ files }) => {

        console.log("--------------------------------------")
        console.log("Update files tool is used", files)
        console.log("--------------------------------------")

        const response = await axios.patch("http://sandbox-service-01a09f11-2b1d-7378-b41a-eb2cfbecce33:3000/update-files", {files})


        console.log("--------------------------------------")
        console.log("Response from update files", response.data)
        console.log("--------------------------------------")

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