import mongoose from 'mongoose';
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MemorySaver } from "@langchain/langgraph";

export let checkpointer = new MemorySaver();
export let mongoClient = null;

const HistoryEventSchema = new mongoose.Schema({
    projectId: { type: String, required: true, index: true },
    eventId: { type: String, required: true },
    type: { type: String, enum: ['user', 'tool', 'assistant', 'rate_limit'], required: true },
    tool: { type: String }, 
    status: { type: String },
    message: { type: String },
    paths: { type: [String] },
    content: { type: String }, 
    createdAt: { type: Date, default: Date.now }
}, { bufferCommands: false });
export const HistoryEvent = mongoose.model('HistoryEvent', HistoryEventSchema);

export async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.warn("MONGODB_URI not configured, falling back to MemorySaver for agent checkpointer and in-memory history won't persist.");
        return;
    }

    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB via Mongoose for History");

        mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        checkpointer = new MongoDBSaver({ client: mongoClient, dbName: mongoose.connection.name });
        console.log("Connected to MongoDB via MongoClient for LangGraph Checkpointer");
    } catch (err) {
        console.error("Failed to connect to MongoDB, falling back to MemorySaver:", err);
        checkpointer = new MemorySaver();
    }
}
