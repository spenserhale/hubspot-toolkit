import { FastMCP } from "fastmcp";
import { registerObjectTools } from "./tools/objects.js";
import { registerPropertyTools } from "./tools/properties.js";
import { registerAssociationTools } from "./tools/associations.js";

const server = new FastMCP({ name: "hubspot-toolkit", version: "0.1.0" });
registerObjectTools(server);
registerPropertyTools(server);
registerAssociationTools(server);
server.start({ transportType: "stdio" });
