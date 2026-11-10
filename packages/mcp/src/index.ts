import { FastMCP } from "fastmcp";
import { registerConfigTools } from "./tools/config.js";
import { registerObjectTools } from "./tools/objects.js";
import { registerPropertyTools } from "./tools/properties.js";
import { registerAssociationTools } from "./tools/associations.js";

export const SERVER_VERSION = "0.2.0";

const server = new FastMCP({ name: "hubspot-toolkit", version: SERVER_VERSION });
// There is deliberately no tool that writes or deletes secrets: credentials
// are managed with the `hubspot auth` CLI commands.
registerConfigTools(server);
registerObjectTools(server);
registerPropertyTools(server);
registerAssociationTools(server);
server.start({ transportType: "stdio" });
