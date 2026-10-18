import express from 'express';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import { createProxyServer } from 'httpxy';
import { refreshTTL } from './config/redis.js'


const app = express();
app.use(morgan('combined'));


app.get('/api/status/healthz', (req,res) => {
    res.status(200).json({ status: 'ok' })
})

app.get('/api/status/readyz', (req,res) => {
    res.status(200).json({ status: 'ready' })
})

app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

const proxies = {}
const agentProxies = {}

function sendProxyError(res, req, sandboxId, serviceType, err) {
    if (res && 'writeHead' in res && !res.headersSent) {
        const origin = req.headers.origin || '*';
        res.writeHead(503, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        });
        res.end(JSON.stringify({
            error: `Sandbox ${serviceType} is not ready yet`,
            sandboxId,
            message: err.message
        }));
    }
}

function getProxies(sandboxId){

    const target = `http://sandbox-service-${sandboxId}`; 

    if (!proxies[sandboxId]){
        proxies[ sandboxId ] = createProxyMiddleware({
            target,
            changeOrigin: true,
            on: {
                error: (err, req, res) => {
                    console.error(`Preview proxy error for ${sandboxId}:`, err.message);
                    sendProxyError(res, req, sandboxId, 'preview', err);
                }
            }
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
            on: {
                error: (err, req, res) => {
                    console.error(`Agent proxy error for ${sandboxId}:`, err.message);
                    sendProxyError(res, req, sandboxId, 'agent', err);
                }
            }
        })
    }

    return agentProxies[ sandboxId ]
}

// Single httpxy proxy server for all WebSocket upgrades
const wsProxy = createProxyServer({ changeOrigin: true });
wsProxy.on('error', (err, req, socket) => {
    console.error('WS proxy error:', err.message);
    socket?.destroy();
});


function parseRoute(host) {
    if (!host) return null;
    const hostname = host.split(':')[0].toLowerCase();
    const parts = hostname.split('.');
    const sandboxId = parts[0];

    const previewDomain = process.env.PREVIEW_DOMAIN || 'preview.localtest.me';
    const cleanPreviewDomain = previewDomain.replace(/^https?:\/\//, '').split(':')[0].toLowerCase();

    if (parts[1] === 'agent') {
        return { sandboxId, type: 'agent' };
    }

    if (parts[1] === 'preview') {
        return { sandboxId, type: 'preview' };
    }

    if (hostname === `${sandboxId}.${cleanPreviewDomain}` || hostname.endsWith(`.${cleanPreviewDomain}`)) {
        return { sandboxId, type: 'preview' };
    }

    if (parts.length === 2 && parts[1] !== 'agent') {
        return { sandboxId, type: 'preview' };
    }

    return null;
}

app.use(async (req, res, next) => {
    const host = req.headers.host;
    if (!host) {
        return res.status(400).json({ error: "Missing Host header" });
    }

    const route = parseRoute(host);
    if (!route) {
        return res.status(404).json({ error: `Unknown routing target for host: ${host}` });
    }

    const { sandboxId, type } = route;

    try {
        await refreshTTL(sandboxId);
    } catch (err) {
        console.error(`Failed to refresh TTL for ${sandboxId}:`, err.message);
    }

    if (type === 'agent') {
        return getAgentProxies(sandboxId)(req, res, next);
    } else if (type === 'preview') {
        return getProxies(sandboxId)(req, res, next);
    } else {
        return res.status(404).json({ error: `Unknown routing target: ${type}` });
    }
});


// Create the HTTP server explicitly
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
    const host = req.headers.host;
    if (!host) { socket.destroy(); return; }

    // Prevent EPIPE and connection-reset errors from crashing the process
    // during the active piped session (after ws() Promise has resolved)
    socket.on('error', () => socket.destroy());

    const route = parseRoute(host);
    if (!route) {
        console.warn(`Unknown WS routing target for host: ${host}`);
        socket.destroy();
        return;
    }

    const { sandboxId, type } = route;
    console.log(`WS upgrade request: ${host}, sandboxId: ${sandboxId}, type: ${type}`);

    if (type === 'agent') {
        wsProxy.ws(req, socket, { target: `http://sandbox-service-${sandboxId}:3000` }, head)
            .catch(() => socket.destroy());
    } else if (type === 'preview') {
        wsProxy.ws(req, socket, { target: `http://sandbox-service-${sandboxId}:80` }, head)
            .catch(() => socket.destroy());
    } else {
        socket.destroy();
    }
});


export { app, server };
export default server;