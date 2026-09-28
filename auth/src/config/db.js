import mongoose from 'mongoose';


export const connectToDB = async () => {
    try{
        await mongoose.connect(process.env.AUTH_MONGO_URI);
        console.log('MongoDB connected');
    }catch(error){  
        console.error('MongoDB connection error', error);
        process.exit(1);
    }
}