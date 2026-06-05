import crypto from "crypto";
import { ChildProcess, spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Connection information for the running backend process.
 */
export interface BackendInfo {
  /** The base URL of the backend API (e.g. http://127.0.0.1:8765). */
  url: string;
  /** The authentication token for API requests. */
  token: string;
  /** The process ID of the backend process. */
  pid: number;
}

/**
 * Matches uvicorn's startup message to extract the port number.
 * Example: "Uvicorn running on http://127.0.0.1:8765"
 */
const UVICORN_PORT_PATTERN = /Uvicorn running on http:\/\/127\.0\.0\.1:(\d+)/;

/**
 * Manages the lifecycle of the Python backend process.
 *
 * Spawns the backend via `uv run python -m backend.main` and waits for the
 * uvicorn startup message to determine the port. Exposes connection info
 * once the backend is ready.
 */
export class BackendSupervisor {
  private _process: ChildProcess | null = null;

  private _info: BackendInfo | null = null;

  /**
   * Starts the backend process and waits for it to become ready.
   *
   * Reads stdout and stderr for the uvicorn startup message containing the
   * port number. Generates a random authentication token if the backend does
   * not provide one.
   *
   * @returns A promise that resolves with the backend connection info.
   * @throws {Error} If the process is already running or fails to start.
   */
  async start(): Promise<BackendInfo> {
    if (this._process) {
      throw new Error("Backend process is already running");
    }

    return new Promise<BackendInfo>((resolve, reject) => {
      // Detect whether we are running from a packaged app (ASAR) or dev
      const isPackaged = process.env.NODE_ENV === "production" || __dirname.includes("app.asar");
      let projectRoot: string;
      let pythonPath: string;
      let pythonCwd: string;
      let pythonPathEnv: string;

      if (isPackaged) {
        // In packaged app, extraResources are placed next to the executable
        projectRoot = path.join(process.resourcesPath);
        pythonPath = "python3";
        pythonCwd = projectRoot;
        pythonPathEnv = path.join(projectRoot, "backend");
      } else {
        // In dev, use the local venv
        projectRoot = path.resolve(__dirname, "../../..");
        pythonPath = path.join(projectRoot, ".venv", "bin", "python");
        pythonCwd = projectRoot;
        pythonPathEnv = path.join(projectRoot, "src");
      }

      const child = spawn(
        pythonPath,
        [
          "-m",
          "uvicorn",
          "backend.main:app",
          "--host",
          "127.0.0.1",
          "--port",
          "0",
          "--no-access-log",
        ],
        {
          cwd: pythonCwd,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            PYTHONPATH: pythonPathEnv,
          },
        }
      );

      let resolved = false;

      /**
       * Handles incoming data from the child process stdout or stderr.
       * Looks for the uvicorn startup message to extract the port.
       */
      const onData = (data: Buffer): void => {
        if (resolved) return;

        const text = data.toString();

        const match = text.match(UVICORN_PORT_PATTERN);
        if (match) {
          resolved = true;
          const port = parseInt(match[1], 10);

          // Generate a cryptographically secure random token for API authentication
          const token = crypto.randomUUID();

          this._process = child;
          this._info = {
            url: `http://127.0.0.1:${port}`,
            token,
            pid: child.pid ?? 0,
          };

          resolve(this._info);
        }
      };

      /**
       * Handles errors from the child process before startup completes.
       */
      const onError = (err: Error): void => {
        if (!resolved) {
          resolved = true;
          reject(
            new Error(`Backend failed to start: ${err.message}`)
          );
        }
      };

      /**
       * Handles premature exit of the child process before the startup
       * message is received.
       */
      const onExit = (code: number | null): void => {
        if (!resolved) {
          resolved = true;
          reject(
            new Error(
              `Backend process exited with code ${code} before starting`
            )
          );
        }
      };

      if (child.stdout) {
        child.stdout.on("data", onData);
        child.stdout.on("data", (data: Buffer) => {
          if (resolved) {
            const text = data.toString().trim();
            if (text) console.log(`[backend] ${text}`);
          }
        });
      }
      if (child.stderr) {
        child.stderr.on("data", onData);
        child.stderr.on("data", (data: Buffer) => {
          if (resolved) {
            const text = data.toString().trim();
            if (text) console.error(`[backend] ${text}`);
          }
        });
      }
      child.on("error", onError);
      child.on("exit", onExit);
    });
  }

  /**
   * Stops the backend process gracefully by sending SIGTERM.
   *
   * Safe to call even if the process is not running.
   */
  async stop(): Promise<void> {
    if (this._process) {
      this._process.kill("SIGTERM");
      this._process = null;
      this._info = null;
    }
  }

  /**
   * Returns the current backend connection info, or null if the backend
   * has not been started yet or has been stopped.
   */
  get info(): BackendInfo | null {
    return this._info;
  }
}
