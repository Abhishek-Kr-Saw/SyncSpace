import 'dotenv/config';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import app from './src/app.js';
import connectDB from './src/config/db.js';


connectDB()


app.listen(3000, () => {
    console.log('Sandbox API is running on port 3000')
})