API : http://localhost/api/sandbox/start

Functionalities: Create a sandbox and return preview url
Method: POST
Output: 

{
    "message": "Sandbox environment created successfully",
    "sandboxId": "01a0a94f-5888-77aa-ad7c-56cd8c4ac91f",
    "previewUrl": "http://01a0a94f-5888-77aa-ad7c-56cd8c4ac91f.preview.localhost" // create iframe using this preview url
}


API: http://01a0a918-3604-77b9-896b-45c5888a479f.agent.localhost/list-files

Functionalities: Return all the list of files 
Method: GET
Output: 
{
    "message": "Files listed successfully",
    "files": [
        ".dockerignore",
        ".gitignore",
        "README.md",
        "dockerfile",
        "eslint.config.js",
        "index.html",
        "package-lock.json",
        "package.json",
        "public/favicon.svg",
        "public/icons.svg",
        "src/App.css",
        "src/App.jsx",
        "src/assets/hero.png",
        "src/assets/react.svg",
        "src/assets/vite.svg",
        "src/index.css",
        "src/main.jsx",
        "vite.config.js"
    ]
}


API : http://01a0a918-3604-77b9-896b-45c5888a479f.agent.localhost/read-files?files=src/App.jsx
Functionalities: Read the content of a file. Here it can read App.jsx content
Method: GET
Output:
{
    "message": "File contents",
    "files": [
        {
            "/src/App.jsx": "import { useState } from 'react'\nimport heroImg from './assets/hero.png'\nimport reactLogo from './assets/react.svg'\nimport viteLogo from './assets/vite.svg'\nimport './App.css'\n\nfunction App() {\n  const [count, setCount] = useState(0)\n\n  return (\n    <>\n      <section id=\"center\">\n        <div className=\"hero\">\n          <img src={heroImg} className=\"base\" width=\"170\" height=\"179\" alt=\"\" />\n          <img src={reactLogo} className=\"framework\" alt=\"React logo\" />\n          <img src={viteLogo} className=\"vite\" alt=\"Vite logo\" />\n        </div>\n        <div>\n          <h1>Get started</h1>\n          <p>\n            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>\n          </p>\n        </div>\n        <button\n          type=\"button\"\n          className=\"counter\"\n          onClick={() => setCount((count) => count + 1)}\n        >\n          Count is {count}\n        </button>\n      </section>\n\n      <div className=\"ticks\"></div>\n\n      <section id=\"next-steps\">\n        <div id=\"docs\">\n          <svg className=\"icon\" role=\"presentation\" aria-hidden=\"true\">\n            <use href=\"/icons.svg#documentation-icon\"></use>\n          </svg>\n          <h2>Documentation</h2>\n          <p>Your questions, answered</p>\n          <ul>\n            <li>\n              <a href=\"https://vite.dev/\" target=\"_blank\">\n                <img className=\"logo\" src={viteLogo} alt=\"\" />\n                Explore Vite\n              </a>\n            </li>\n            <li>\n              <a href=\"https://react.dev/\" target=\"_blank\">\n                <img className=\"button-icon\" src={reactLogo} alt=\"\" />\n                Learn more\n              </a>\n            </li>\n          </ul>\n        </div>\n        <div id=\"social\">\n          <svg className=\"icon\" role=\"presentation\" aria-hidden=\"true\">\n            <use href=\"/icons.svg#social-icon\"></use>\n          </svg>\n          <h2>Connect with us</h2>\n          <p>Join the Vite community</p>\n          <ul>\n            <li>\n              <a href=\"https://github.com/vitejs/vite\" target=\"_blank\">\n                <svg\n                  className=\"button-icon\"\n                  role=\"presentation\"\n                  aria-hidden=\"true\"\n                >\n                  <use href=\"/icons.svg#github-icon\"></use>\n                </svg>\n                GitHub\n              </a>\n            </li>\n            <li>\n              <a href=\"https://chat.vite.dev/\" target=\"_blank\">\n                <svg\n                  className=\"button-icon\"\n                  role=\"presentation\"\n                  aria-hidden=\"true\"\n                >\n                  <use href=\"/icons.svg#discord-icon\"></use>\n                </svg>\n                Discord\n              </a>\n            </li>\n            <li>\n              <a href=\"https://x.com/vite_js\" target=\"_blank\">\n                <svg\n                  className=\"button-icon\"\n                  role=\"presentation\"\n                  aria-hidden=\"true\"\n                >\n                  <use href=\"/icons.svg#x-icon\"></use>\n                </svg>\n                X.com\n              </a>\n            </li>\n            <li>\n              <a href=\"https://bsky.app/profile/vite.dev\" target=\"_blank\">\n                <svg\n                  className=\"button-icon\"\n                  role=\"presentation\"\n                  aria-hidden=\"true\"\n                >\n                  <use href=\"/icons.svg#bluesky-icon\"></use>\n                </svg>\n                Bluesky\n              </a>\n            </li>\n          </ul>\n        </div>\n      </section>\n\n      <div className=\"ticks\"></div>\n      <section id=\"spacer\"></section>\n    </>\n  )\n}\n\nexport default App\n"
        }
    ]
}




API: http://01a0a918-3604-77b9-896b-45c5888a479f.agent.localhost/update-files
Functionalities: Can update the content of the files
Method: PATCH
Input:
{
    "files":[
        {
            "file":"src/App.jsx",
            "content":"import { useState } from 'react'\nimport heroImg from './assets/hero.png'\nimport reactLogo from './assets/react.svg'\nimport viteLogo from './assets/vite.svg'\nimport './App.css'\n\nfunction App() {\n  const [count, setCount] = useState(0)\n\n  return (\n    <>\n      <section id=\"center\">\n        <div className=\"hero\">\n          <img src={heroImg} className=\"base\" width=\"170\" height=\"179\" alt=\"\" />\n          <img src={reactLogo} className=\"framework\" alt=\"React logo\" />\n          <img src={viteLogo} className=\"vite\" alt=\"Vite logo\" />\n        </div>\n        <div>\n          <h1>Let's gooooo</h1>\n          <p>\n            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>\n          </p>\n        </div>\n        <button\n          type=\"button\"\n          className=\"counter\"\n          onClick={() => setCount((count) => count + 1)}\n        >\n          Counting is {count}\n        </button>\n      </section>\n\n      <div className=\"ticks\"></div>\n\n      <section id=\"next-steps\">\n        <div id=\"docs\">\n          <svg className=\"icon\" role=\"presentation\" aria-hidden=\"true\">\n            <use href=\"/icons.svg#documentation-icon\"></use>\n          </svg>\n          <h2>Documentation</h2>\n          <p>Your questions, answered</p>\n          <ul>\n            <li>\n              <a href=\"https://vite.dev/\" target=\"_blank\">\n                <img className=\"logo\" src={viteLogo} alt=\"\" />\n                Explore Vite\n              </a>\n            </li>\n            <li>\n              <a href=\"https://react.dev/\" target=\"_blank\">\n                <img className=\"button-icon\" src={reactLogo} alt=\"\" />\n                Learn more\n              </a>\n            </li>\n          </ul>\n        </div>\n        <div id=\"social\">\n          <svg className=\"icon\" role=\"presentation\" aria-hidden=\"true\">\n            <use href=\"/icons.svg#social-icon\"></use>\n          </svg>\n          <h2>Connect with us</h2>\n          <p>Join the Vite community</p>\n          <ul>\n            <li>\n              <a href=\"https://github.com/vitejs/vite\" target=\"_blank\">\n                <svg\n                  className=\"button-icon\"\n                  role=\"presentation\"\n                  aria-hidden=\"true\"\n                >\n                  <use href=\"/icons.svg#github-icon\"></use>\n                </svg>\n                GitHub\n              </a>\n            </li>\n            <li>\n              <a href=\"https://chat.vite.dev/\" target=\"_blank\">\n                <svg\n                  className=\"button-icon\"\n                  role=\"presentation\"\n                  aria-hidden=\"true\"\n                >\n                  <use href=\"/icons.svg#discord-icon\"></use>\n                </svg>\n                Discord\n              </a>\n            </li>\n            <li>\n              <a href=\"https://x.com/vite_js\" target=\"_blank\">\n                <svg\n                  className=\"button-icon\"\n                  role=\"presentation\"\n                  aria-hidden=\"true\"\n                >\n                  <use href=\"/icons.svg#x-icon\"></use>\n                </svg>\n                X.com\n              </a>\n            </li>\n            <li>\n              <a href=\"https://bsky.app/profile/vite.dev\" target=\"_blank\">\n                <svg\n                  className=\"button-icon\"\n                  role=\"presentation\"\n                  aria-hidden=\"true\"\n                >\n                  <use href=\"/icons.svg#bluesky-icon\"></use>\n                </svg>\n                Bluesky\n              </a>\n            </li>\n          </ul>\n        </div>\n      </section>\n\n      <div className=\"ticks\"></div>\n      <section id=\"spacer\"></section>\n    </>\n  )\n}\n\nexport default App\n"
        }
    ]
}
Output: 
{
    "message": "File update results",
    "results": [
        {
            "/workspace/src/App.jsx": "File updated successfully"
        }
    ]
}




API: http://localhost/api/ai/invoke
Functionalities: Can invoke the agent to perform some task.
Method: POST
Input: 

req.body = {
    "message":"Create a snake game",
    "projectId":"01a0a94f-5888-77aa-ad7c-56cd8c4ac91f"
}
Output: Response will be in SSE




Then we have socket.io url 

01a0a918-3604-77b9-896b-45c5888a479f.agent.localhost  // use xterm js for terminal on the frontend

with event name "terminal-input" for terminal input and "terminal-output" for terminal output
