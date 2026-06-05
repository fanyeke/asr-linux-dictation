import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import { BackendSupervisor } from "../../src/electron/main/backend-supervisor.js";

// Mock child_process.spawn
vi.mock("child_process", () => {
  const mockSpawn = vi.fn();
  return {
    default: { spawn: mockSpawn },
    spawn: mockSpawn,
  };
});

/**
 * Creates a mock child process that extends EventEmitter.
 * This allows proper event registration via .on() and emission via .emit().
 */
function createMockProcess(): {
  process: EventEmitter & { stdout: PassThrough; stderr: PassThrough; pid: number; kill: ReturnType<typeof vi.fn> };
  stdout: PassThrough;
  stderr: PassThrough;
} {
  const emitter = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    pid: number;
    kill: ReturnType<typeof vi.fn>;
  };
  emitter.stdout = new PassThrough();
  emitter.stderr = new PassThrough();
  emitter.pid = 54321;
  emitter.kill = vi.fn();

  return { process: emitter, stdout: emitter.stdout, stderr: emitter.stderr };
}

describe("BackendSupervisor", () => {
  let supervisor: BackendSupervisor;

  beforeEach(() => {
    supervisor = new BackendSupervisor();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await supervisor.stop();
  });

  describe("info", () => {
    it("returns null before start", () => {
      expect(supervisor.info).toBeNull();
    });
  });

  describe("start", () => {
    it("parses port from uvicorn startup message on stdout", async () => {
      const { spawn } = await import("child_process");
      const { process: mockProc, stdout } = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const startPromise = supervisor.start();

      // Simulate uvicorn writing startup message to stdout
      stdout.write("Uvicorn running on http://127.0.0.1:8765\n");
      stdout.end();

      const info = await startPromise;

      expect(info.url).toBe("http://127.0.0.1:8765");
      expect(info.pid).toBe(54321);
      expect(info.token).toBeTruthy();
      expect(typeof info.token).toBe("string");
    });

    it("parses port from stderr (uvicorn default log output)", async () => {
      const { spawn } = await import("child_process");
      const { process: mockProc, stderr } = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const startPromise = supervisor.start();

      stderr.write("Uvicorn running on http://127.0.0.1:9876\n");
      stderr.end();

      const info = await startPromise;

      expect(info.url).toBe("http://127.0.0.1:9876");
      expect(info.pid).toBe(54321);
    });

    it("generates a unique token on each start", async () => {
      const { spawn } = await import("child_process");
      const { process: mockProc1, stdout: stdout1 } = createMockProcess();
      const { process: mockProc2, stdout: stdout2 } = createMockProcess();
      vi.mocked(spawn).mockReturnValueOnce(mockProc1);
      vi.mocked(spawn).mockReturnValueOnce(mockProc2);

      // First start
      const p1 = supervisor.start();
      stdout1.write("Uvicorn running on http://127.0.0.1:8000\n");
      stdout1.end();
      const info1 = await p1;

      await supervisor.stop();

      // Second start
      const p2 = supervisor.start();
      stdout2.write("Uvicorn running on http://127.0.0.1:8001\n");
      stdout2.end();
      const info2 = await p2;

      expect(info1.token).not.toBe(info2.token);
    });

    it("throws when process exits before startup", async () => {
      const { spawn } = await import("child_process");
      const { process: mockProc } = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const startPromise = supervisor.start();

      // Emit the exit event with non-zero status
      mockProc.emit("exit", 1);

      await expect(startPromise).rejects.toThrow(
        "Backend process exited with code 1 before starting"
      );
    });

    it("throws when process emits an error", async () => {
      const { spawn } = await import("child_process");
      const { process: mockProc } = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const startPromise = supervisor.start();

      mockProc.emit("error", new Error("ENOENT"));

      await expect(startPromise).rejects.toThrow(
        "Backend failed to start: ENOENT"
      );
    });

    it("throws on double start", async () => {
      const { spawn } = await import("child_process");
      const { process: mockProc1, stdout: stdout1 } = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc1);

      // First start succeeds
      const p1 = supervisor.start();
      stdout1.write("Uvicorn running on http://127.0.0.1:8000\n");
      stdout1.end();
      await p1;

      // Second start should throw
      await expect(supervisor.start()).rejects.toThrow(
        "Backend process is already running"
      );
    });
  });

  describe("stop", () => {
    it("terminates the running process", async () => {
      const { spawn } = await import("child_process");
      const { process: mockProc, stdout } = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const startPromise = supervisor.start();
      stdout.write("Uvicorn running on http://127.0.0.1:8000\n");
      stdout.end();
      await startPromise;

      await supervisor.stop();

      expect(mockProc.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("resets info to null after stop", async () => {
      const { spawn } = await import("child_process");
      const { process: mockProc, stdout } = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const startPromise = supervisor.start();
      stdout.write("Uvicorn running on http://127.0.0.1:8000\n");
      stdout.end();
      await startPromise;

      expect(supervisor.info).not.toBeNull();

      await supervisor.stop();

      expect(supervisor.info).toBeNull();
    });

    it("does not throw when called without a running process", async () => {
      await expect(supervisor.stop()).resolves.toBeUndefined();
    });

    it("is safe to call stop multiple times", async () => {
      const { spawn } = await import("child_process");
      const { process: mockProc, stdout } = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc);

      const startPromise = supervisor.start();
      stdout.write("Uvicorn running on http://127.0.0.1:8000\n");
      stdout.end();
      await startPromise;

      await supervisor.stop();
      await supervisor.stop(); // Second stop should not throw

      expect(mockProc.kill).toHaveBeenCalledTimes(1);
    });
  });
});
