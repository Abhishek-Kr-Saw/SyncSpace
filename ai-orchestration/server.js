import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import "dotenv/config";
import app from './src/app.js'

import { connectDB } from './src/db.js';

await connectDB();

app.listen(3000, () => {
    console.log("AI orchestration is running on port 3000")
})