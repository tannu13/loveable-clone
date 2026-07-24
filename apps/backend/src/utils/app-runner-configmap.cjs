// this code is directly inserted into the kubernetes cluster config map via manifest file @ root/k8s/setup.yaml
// have kept this here for reference and debug. this below code is not used in the app directly
const http = require("http");
const { spawn } = require("child_process");

let devServerProcess = null;

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/start") {
    if (devServerProcess) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "already_running" }));
    }

    console.log("Starting React dev server...");

    devServerProcess = spawn("npm", ["run", "dev"], {
      cwd: "/app",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    devServerProcess.stdout.on("data", (data) => {
      console.log(`[Vite Output]: ${data}`);
    });

    devServerProcess.stderr.on("data", (data) => {
      console.error(`[Vite Error]: ${data}`);
    });

    devServerProcess.on("exit", (code) => {
      console.log(`Dev server exited with code ${code}`);
      devServerProcess = null;
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "started" }));
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(8080, "0.0.0.0", () => {
  console.log("Runner listener active on port 8080");
});
