import express from 'express';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware'


const app = express();

app.use(morgan('dev'));


app.get('/api/status/healthz', (req,res) => {
    res.status(200).json({ status: 'ok' })
})

app.get('/api/status/readyz', (req,res) => {
    res.status(200).json({ status: 'ready' })
})

const proxies = {}
const agentProxies = {}

function getProxies(sandboxId){

    const target = `http://sandbox-service-${sandboxId}`; 

    if (!proxies[sandboxId]){
        proxies[ sandboxId ] = createProxyMiddleware({
            target,
            changeOrigin: true,
            ws: true
        })
    }

    return proxies[ sandboxId ]
}

function getAgentProxies(sandboxId){

    const target = `http://sandbox-service-${sandboxId}:3000`; 

    if (!agentProxies[sandboxId]){
        agentProxies[ sandboxId ] = createProxyMiddleware({
            target,
            changeOrigin: true,
            ws: true
        })
    }

    return agentProxies[ sandboxId ]
}


app.use((req,res,next) => {
    const host = req.headers.host;
    const sandboxId = host.split('.')[0];

    if(host.split('.')[1] === 'agent'){
        return getAgentProxies(sandboxId)(req,res,next);
    }else if(host.split('.')[1] === 'preview'){
        return getProxies(sandboxId)(req,res,next);
    }
})


export default app;