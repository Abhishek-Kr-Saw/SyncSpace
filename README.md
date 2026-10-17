# SyncSpace — AI-Powered Cloud Sandbox IDE

[Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
[React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
[Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
[Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
[Kubernetes](https://img.shields.io/badge/Kubernetes-1.28+-326CE5?logo=kubernetes&logoColor=white)
[Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?logo=docker&logoColor=white)
[MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
[Redis](https://img.shields.io/badge/Redis-TTL-DC382D?logo=redis&logoColor=white)
[RabbitMQ](https://img.shields.io/badge/RabbitMQ-queue-FF6600?logo=rabbitmq&logoColor=white)
[Build](https://img.shields.io/badge/build-skaffold-00ADD8)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Features](#2-features)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Microservices Breakdown](#4-microservices-breakdown)
5. [Sandbox Lifecycle](#5-sandbox-lifecycle)
6. [Developer Setup & Local Development](#6-developer-setup--local-development)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [API Overview](#8-api-overview)
9. [Deployment](#9-deployment)
10. [Security Considerations](#10-security-considerations)
11. [Roadmap & Known Limitations](#11-roadmap--known-limitations)
12. [Contributing](#12-contributing)
13. [License](#13-license)

---

## 1. Executive Summary

SyncSpace is a browser-based cloud IDE for AI-assisted software development. It provisions an isolated sandbox for each project session, gives the user a live preview, terminal access, and a file-editing interface, and pairs that with an AI orchestration layer that can read and update project files in the workspace.

The platform is designed for developers who want a frictionless coding environment without setting up a local toolchain. A user can sign in with Google, create or restore a project, launch a sandbox, and interact with a code agent that edits the workspace in real time.

The core product idea is simple:

- sign in securely
- create or open a project
- launch a sandbox environment
- use an AI agent for coding help
- preview the app live in the browser
- use terminal/file APIs inside the sandbox

This monorepo combines:

- a React + Vite front end
- secure auth services with Passport and JWT
- an AI orchestration layer for streaming responses and project memory
- dynamic sandbox orchestration in Kubernetes
- notification processing for auth events
- local dev support via Skaffold and Docker

---

## 2. Features

### Authentication
- Google OAuth 2.0 login
- JWT issuance through secure HTTP-only cookies
- MongoDB-backed user persistence
- auth events published to a messaging layer

### Sandbox Environment
- one-click creation of an isolated workspace
- dedicated preview route and agent route per sandbox
- live terminal access using a PTY shell
- file listing, creation, reading, and update APIs
- persistent workspace session for code editing

### AI Workflows
- AI orchestration service exposes chat and model APIs
- project and history tracking
- streaming responses to the front end
- file operations for agent-based editing
- configurable model selection when configured in the environment

### Developer Experience
- IDE-like layout with file explorer, code panel, preview pane, and chat
- restore session state from browser storage
- socket-based terminal streaming
- Vite-friendly live preview experience for frontend apps

### Deployment & Operations
- Dockerized service architecture
- Kubernetes manifests for runtime deployment
- Skaffold-based local orchestration
- Redis TTL for lifecycle management and sandbox cleanup
- RabbitMQ-style queue consumption for asynchronous notifications

---

## 3. High-Level Architecture

```mermaid
flowchart TB
    subgraph Browser[Browser / Frontend]
        UI[React App\nLanding / IDE / Preview / Terminal / Chat]
    end

    subgraph Services[SyncSpace Services]
        FE[frontend\nReact + Vite]
        AUTH[auth\nExpress + Passport + JWT]
        AI[ai-orchestration\nAI API + project history]
        SB[sandbox/server\nproject + sandbox APIs]
        ROUTER[sandbox/router\nhost-based proxy]
        NOTIFY[notification\nconsumer for auth events]
    end

    subgraph Runtime[Kubernetes + Sandbox Runtime]
        POD[sandbox pod\nworkspace + preview app + agent]
        SVC[service\npreview + agent endpoints]
    end

    subgraph External[External Services]
        MONGO[(MongoDB)]
        REDIS[(Redis)]
        MQ[(RabbitMQ / queue)]
        LLM[LLM provider(s)]
    end

    UI --> FE
    FE --> AUTH
    FE --> AI
    FE --> SB
    FE --> ROUTER

    AUTH --> MONGO
    AUTH --> MQ
    AI --> LLM
    SB --> REDIS
    SB --> K8S[Kubernetes API]
    ROUTER --> POD
    NOTIFY --> MQ
    K8S --> POD
    POD --> SVC
    SVC --> APP[Live app preview]
    SVC --> AGENT[Sandbox agent / terminal API]
```

At a high level, the frontend communicates with the auth, sandbox, and AI services. Those services connect to infrastructure services such as MongoDB, Redis, RabbitMQ, and the Kubernetes API for sandbox provisioning. The router service directs requests based on the incoming host and sandbox ID, so each project instance gets a consistent preview or agent endpoint.

---

## 4. Microservices Breakdown

### 4.1 Frontend
Location: `frontend/`

The frontend is a Vite-powered React application that provides:

- landing and login flow
- project creation and session restoration
- IDE-like workspace UI
- file explorer and terminal panel
- live preview panel
- model selection and chat interactions

The main application logic is in `frontend/src/App.jsx` and its surrounding components/context utilities.

### 4.2 Auth Service
Location: `auth/`

The auth service handles:

- Google OAuth strategy setup using Passport
- JWT generation
- cookie-based session handling
- user lookup/creation in MongoDB
- sending auth notifications through the messaging layer

Key files:

- `auth/src/app.js`
- `auth/src/routes/auth.routes.js`
- `auth/src/models/user.model.js`

### 4.3 AI Orchestration Service
Location: `ai-orchestration/`

This service coordinates AI requests, project memory, and streaming chat responses. It exposes endpoints for:

- listing available models
- invoking the agent
- retrieving and clearing project history
- streaming message/tool output back to the client

Key files:

- `ai-orchestration/src/app.js`
- `ai-orchestration/src/routes/agent.routes.js`
- `ai-orchestration/src/agents/`

### 4.4 Sandbox Server
Location: `sandbox/server/`

The sandbox server is the API layer that manages project and sandbox lifecycle operations. It includes:

- `/api/sandbox/health` checks
- sandbox startup logic for creating a project/workspace
- project creation and lookup routes
- integration with Kubernetes resources for pod and service creation

Key files:

- `sandbox/server/src/app.js`
- `sandbox/server/src/routes/sandbox.routes.js`

### 4.5 Sandbox Agent
Location: `sandbox/agent/`

This is the runtime environment the browser talks to when it needs terminal or file operations inside the project workspace. It acts as a project execution shell and exposes endpoints such as:

- list files
- read files
- create files
- update files
- PTY-based terminal input and output
- Socket.IO terminal streaming

This agent is the core execution layer for the code-editing workflow.

### 4.6 Sandbox Router
Location: `sandbox/router/`

The router service routes traffic based on subdomains and sandbox identifiers. It handles host-based routing to the correct preview URL or agent service for a given sandbox instance.

### 4.7 Notification Service
Location: `notification/`

The notification service consumes queue messages and sends email notifications. It is intentionally decoupled from the auth flow to keep authentication and asynchronous events separate.

---

## 5. Sandbox Lifecycle

A typical sandbox lifecycle looks like this:

1. The user signs in through the frontend.
2. The frontend calls the sandbox API to create or resume a session.
3. The sandbox service creates a Kubernetes pod and service for the user's project.
4. The router assigns a preview route and agent route for that sandbox.
5. The frontend connects to the sandbox agent and terminal.
6. The user edits files or asks the AI to change code.
7. The AI agent reads files, updates code, and streams output back to the browser.
8. The preview route reflects the app state in real time.
9. Idle sandbox resources are cleaned up via Redis TTL and related runtime controls.

This creates a short-lived, isolated project environment where experiments can be created and destroyed without affecting other users.

---

## 6. Developer Setup & Local Development

### Prerequisites

- Node.js 20+
- npm
- Docker
- Kubernetes tooling for local cluster/dev flows
- Skaffold

### Install Dependencies

From the repository root, install dependencies for each service:

```bash
cd auth && npm install
cd ../ai-orchestration && npm install
cd ../notification && npm install
cd ../frontend && npm install
cd ../sandbox/server && npm install
cd ../sandbox/agent && npm install
cd ../sandbox/router && npm install
```

### Run the Frontend

```bash
cd frontend
npm run dev
```

### Run Backend Services Individually

Auth:

```bash
cd auth
npm run dev
```

AI orchestration:

```bash
cd ai-orchestration
npm run dev
```

Notification:

```bash
cd notification
npm run dev
```

Sandbox server:

```bash
cd sandbox/server
npm run dev
```

Sandbox agent:

```bash
cd sandbox/agent
npm run dev
```

Router:

```bash
cd sandbox/router
npm run dev
```

### Run the Full Stack with Skaffold

```bash
skaffold dev
```

This is the recommended workflow when you want the full service graph, Kubernetes-based networking, and sandbox routing behavior to match the intended deployment design.

---

## 7. Environment Variables Reference

Several services depend on environment variables to function properly. Common examples include:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `FRONTEND_URL`
- `JWT_SECRET`
- MongoDB connection values
- Redis connection and TTL values
- RabbitMQ connection values
- Kubernetes-related runtime configuration
- model/provider configuration for AI services

It is recommended to use `.env` files or a secret manager in local development and production deployments.

---

## 8. API Overview

### Frontend to Auth
- Google sign-in routes under `/api/auth`
- JWT-based auth flow with cookies

### Frontend to Sandbox
- sandbox lifecycle and project endpoints under `/api/sandbox`
- health checks and service startup logic

### Frontend to AI
- model registry endpoint under `/api/ai/models`
- streaming invocation endpoint under `/api/ai/invoke`
- history fetch and clear endpoints under `/api/ai/history/:projectId`

### Sandbox Agent Endpoints
The agent service exposes file and terminal operations, including:

- `GET /` for health info
- `GET /list-files`
- `GET /read-files`
- `PATCH /update-files`
- `POST /create-files`
- Socket.IO terminal events like `terminal-input` and `terminal-output`

---

## 9. Deployment

The repository is set up for containerized and Kubernetes-based deployment using:

- Dockerfiles in individual service folders
- Kubernetes YAML manifests in `k8s/`
- Skaffold configuration in `skaffold.yml`
- ingress and service definitions for app routing
- secret manifests for environment configuration

This gives the project a clear path to run in a dev cluster, staging environment, or production-like Kubernetes environment.

---

## 10. Security Considerations

This project includes important security patterns, but production adoption should include additional hardening.

Recommended steps:

- use a secrets manager for credentials and tokens
- enforce strict CORS policies by environment
- validate request payloads before AI invocation and sandbox actions
- use RBAC and namespace isolation in Kubernetes
- store persistent secrets outside Git
- enable TLS through ingress or a dedicated gateway
- ensure sandbox isolation is enforced and resource usage is limited

The code already includes cookie-based auth and JWT generation patterns, but production deployment still requires careful operational hardening.

---

## 11. Roadmap & Known Limitations

### Current Strengths
- working multi-service project structure
- secure Google login flow
- AI orchestration and streaming chat pattern
- file and terminal access inside a sandbox
- live preview and dynamic sandbox routing
- Kubernetes deployment pipeline foundation

### Potential Enhancements
- stronger resource cleanup and lifecycle management
- project persistence and backup strategy
- richer multi-user collaboration model
- improved observability and monitoring
- more complete deployment automation and environment scaffolding
- user permissions and RBAC for project-level access
- additional auth providers and account linking

### Known Notes
This repository appears to be an active development platform rather than a polished production SaaS product. Some features are intentionally modular and task-oriented, and some environment configuration details must be filled in for full local or cloud deployment.

---

## 12. Contributing

Contributions are welcome. If you want to improve the project, please:

1. fork the repository
2. create a feature branch
3. make focused changes with clear scope
4. validate the affected services locally
5. open a pull request with a concise summary of the change

Before submitting a large change, it is recommended to review the service boundaries and deployment setup, since the repo is structured as multiple cooperating services.

---

## 13. License

There is no explicit license file in the repository root at the time of writing. If this project is intended for public reuse or commercial distribution, a license should be added before publishing or distributing the code.

---

## Summary

SyncSpace is a cloud-native AI coding platform that combines Google authentication, project lifecycle management, browser-based sandbox execution, and AI-driven code editing to create a modern developer workspace. It is built as a multi-service Node.js system with a React frontend, dynamic Kubernetes sandboxing, file/terminal APIs, and a streaming AI orchestration layer.

It is a strong foundation for AI-assisted coding workflows and browser-based development environments, and it is well positioned for further extension into collaboration, persistence, and production-grade observability.
