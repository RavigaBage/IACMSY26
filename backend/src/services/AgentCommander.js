import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AgentCommandHandler {

    constructor(socket) {
        this.socket = socket;
    }

    register() {

        this.socket.on("device:command", async (cmd) => {

            this.socket.emit("command:ack", {
                commandId: cmd.commandId
            });

            try {

                const result = await this.execute(cmd);

                this.socket.emit("command:complete", {
                    commandId: cmd.commandId,
                    success: true,
                    ...result
                });

            } catch (err) {

                this.socket.emit("command:failed", {
                    commandId: cmd.commandId,
                    error: err.message
                });
            }
        });
    }

    async execute(cmd) {

        switch (cmd.type) {

            case "SYSTEM_RESTART":
                return this.restart();

            case "SYSTEM_SHUTDOWN":
                return this.shutdown();

            case "SYSTEM_UPDATE":
                return this.systemUpdate();

            default:
                throw new Error("Unknown command");
        }
    }

    async restart() {
        await execFileAsync("shutdown", ["/r", "/t", "0"]);
        return { success: true };
    }

    async shutdown() {
        await execFileAsync("shutdown", ["/s", "/t", "0"]);
        return { success: true };
    }

    async systemUpdate() {
        const scriptPath = path.join(__dirname, "scripts", "check-and-install-updates.ps1");

        const { stdout } = await execFileAsync(
            "powershell.exe",
            ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
            { timeout: 30 * 60 * 1000 }
        );

        let updateResult;
        try {
            updateResult = JSON.parse(stdout.trim());
        } catch {
            throw new Error("Failed to parse update result: " + stdout);
        }

        return { success: true, ...updateResult };
    }
}