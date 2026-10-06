import { useState, useEffect } from 'react';
import { startSandbox, waitForAgent, createProject, getProjects } from '../services/api.js';

/**
 * Landing screen shown before any sandbox is active.
 * Centered branding + "New Project" button that spins up a sandbox,
 * and a dashboard showing existing projects.
 */
export default function LandingScreen({ onStartLoading, onSandboxReady }) {
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await getProjects();
        setProjects(res.projects || []);
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    }
    fetchProjects();
  }, []);

  async function handleNewProject() {
    if (!title.trim()) {
      setError('Please enter a project title');
      return;
    }
    setError(null);
    onStartLoading();
    try {
      const projectRes = await createProject(title);
      const data = await startSandbox(projectRes.project._id);
      await waitForAgent(data.sandboxId);
      onSandboxReady(data.sandboxId, data.previewUrl, projectRes.project.title);
    } catch (err) {
      setError(err.message);
      onStartLoading(false);
    }
  }

  async function handleOpenProject(project) {
    setError(null);
    onStartLoading();
    try {
      const data = await startSandbox(project._id);
      await waitForAgent(data.sandboxId);
      onSandboxReady(data.sandboxId, data.previewUrl, project.title);
    } catch (err) {
      setError(err.message);
      onStartLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex flex-col items-center gap-6 w-full max-w-4xl px-4">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="shrink-0">
            <rect width="40" height="40" rx="10" fill="var(--accent)" fillOpacity="0.15" />
            <path d="M12 20L18 14L24 20L18 26Z" fill="var(--accent)" />
            <path d="M18 20L24 14L30 20L24 26Z" fill="var(--accent)" fillOpacity="0.5" />
          </svg>
          <h1 className="text-4xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            SyncSpace
          </h1>
        </div>

        <p className="text-lg text-center" style={{ color: 'var(--text-muted)' }}>
          AI-powered cloud code editor
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center w-full max-w-md mt-4">
          <input 
            type="text" 
            placeholder="Enter project title" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="flex-1 px-4 py-3 rounded-lg border outline-none transition-colors"
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-primary)',
              borderColor: 'var(--border)',
            }} 
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
          <button
            onClick={handleNewProject}
            className="px-8 py-3 rounded-lg text-base font-medium transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--bg-primary)',
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--accent-hover)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--accent)'}
          >
            New Project
          </button>
        </div>

        {error && (
          <div className="mt-4 px-4 py-2 rounded-lg text-sm w-full max-w-md" style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--error)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}>
            {error}
            <button
              onClick={handleNewProject}
              className="ml-3 underline cursor-pointer"
              style={{ color: 'var(--error)' }}
            >
              Retry
            </button>
          </div>
        )}

        <div className="w-full mt-10">
          <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Your Projects</h2>
          {loadingProjects ? (
            <div className="flex justify-center py-10">
              <div className="loading-dot" style={{ animationDelay: '0ms' }} />
              <div className="loading-dot" style={{ animationDelay: '200ms', marginLeft: 6 }} />
              <div className="loading-dot" style={{ animationDelay: '400ms', marginLeft: 6 }} />
            </div>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div 
                  key={project._id} 
                  className="p-6 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-lg flex flex-col justify-between"
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border)',
                  }}
                  onClick={() => handleOpenProject(project)}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <h3 className="text-lg font-medium mb-2 truncate" style={{ color: 'var(--text-primary)' }} title={project.title}>
                    {project.title}
                  </h3>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Open Project &rarr;
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 rounded-xl border border-dashed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              No projects found. Create one above to get started!
            </div>
          )}
        </div>

      </div>

      <p className="mt-auto pt-8 text-xs" style={{ color: 'var(--text-muted)' }}>
        powered by AI
      </p>
    </div>
  );
}
