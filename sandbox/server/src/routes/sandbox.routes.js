import { Router } from "express";
import { createPod } from '../kubernetes/pod.js';
import { createService } from '../kubernetes/service.js';
import { createSandboxKey } from '../config/redis.js';
import { v7 as uuid } from "uuid"
import { authMiddleware } from "../middlewares/auth.middleware.js";
import Project from "../models/project.model.js";



export function buildPreviewUrl(sandboxId) {
    if (!sandboxId) return null;
    const domain = process.env.PREVIEW_DOMAIN || 'preview.localtest.me';
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
        const url = new URL(domain);
        return `${url.protocol}//${sandboxId}.${url.host}${url.pathname === '/' ? '' : url.pathname}`;
    }
    return `http://${sandboxId}.${domain}`;
}

const router = Router();


router.post('/project', authMiddleware, async (req, res) => {
    const { title } = req.body;

    const newProject = new Project({
        user: req.user.id,
        title
    });

    await newProject.save();

    const previewUrl = newProject.sandboxId ? buildPreviewUrl(newProject.sandboxId) : null;

    return res.status(201).json({
        message: 'Project created successfully',
        project: {
            ...newProject.toObject(),
            previewUrl
        },
        previewUrl
    });
})


router.post("/start", authMiddleware, async (req, res) => {

    let projectId = req.body.projectId;
    let project;

    if (!projectId) {
        // Automatically create a new project if none is provided
        project = new Project({
            user: req.user.id,
            title: req.body.title || 'New Project'
        });
        await project.save();
        projectId = project._id;
    } else {
        // Verify that the project belongs to the authenticated user
        project = await Project.findOne({ _id: projectId, user: req.user.id });
        if (!project) {
            return res.status(404).json({ message: 'Project not found or access denied' });
        }
    }

    const sandboxId = uuid();

    await Promise.all([
        createPod(sandboxId, projectId),
        createService(sandboxId),
        createSandboxKey(sandboxId)
    ]);

    project.sandboxId = sandboxId;
    await project.save();

    const previewUrl = buildPreviewUrl(sandboxId);

    return res.status(201).json({
        message: 'Sandbox environment created successfully',
        sandboxId,
        previewUrl
    })
})


router.get("/project", authMiddleware, async (req, res) => {
    const projects = await Project.find({ user: req.user.id });

    const projectsWithPreview = projects.map(p => {
        const pObj = p.toObject();
        return {
            ...pObj,
            previewUrl: pObj.sandboxId ? buildPreviewUrl(pObj.sandboxId) : null
        };
    });

    return res.status(200).json({
        message: 'Projects retrieved successfully',
        projects: projectsWithPreview
    })
})

router.get("/project/:id", authMiddleware, async (req, res) => {
    const project = await Project.findOne({ _id: req.params.id, user: req.user.id });
    if (!project) {
        return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const pObj = project.toObject();
    const previewUrl = pObj.sandboxId ? buildPreviewUrl(pObj.sandboxId) : null;

    return res.status(200).json({
        message: 'Project retrieved successfully',
        project: {
            ...pObj,
            previewUrl
        },
        previewUrl
    });
});

router.get("/:id/preview-status", async (req, res) => {
    const sandboxId = req.params.id;
    if (!sandboxId) {
        return res.status(200).json({ ready: false });
    }

    const target = process.env.SANDBOX_SERVICE_HOST
        ? `http://${process.env.SANDBOX_SERVICE_HOST.replace(':id', sandboxId)}`
        : `http://sandbox-service-${sandboxId}`;

    try {
        const response = await fetch(target, {
            method: 'HEAD',
            signal: AbortSignal.timeout(2000),
            headers: {
                Host: `${sandboxId}.preview.localtest.me`
            }
        });

        if (response.ok || (response.status >= 200 && response.status < 500)) {
            return res.status(200).json({ ready: true });
        }
        return res.status(200).json({ ready: false });
    } catch {
        return res.status(200).json({ ready: false });
    }
});


export default router;