import express from 'express';
import morgan from 'morgan';

const app = express();

//middleware
app.use(morgan('dev'));
app.use(express.json());

//Routes
app.get('/api/ai/healthz', (req,res) => {
    return res.status(200).json({
        message:"AI orchestration is fine",
        status:'ok'
    })
})

export default app;