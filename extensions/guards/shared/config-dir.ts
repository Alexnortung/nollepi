import os from "node:os";
import path from "node:path";

export function getCodingAgentConfigDir() {
	return process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");
}
