# @hubspot-toolkit/mcp

MCP server for HubSpot CRM, built with [FastMCP](https://github.com/punkpeye/fastmcp).

## Tools

| Tool | Description |
|------|-------------|
| `hubspot_config_status` | Whether `HUBSPOT_ACCESS_TOKEN` is configured, which source supplied it, and the keychain status. Never returns values. |
| `hubspot_list_objects` | List objects of a type, paginated |
| `hubspot_get_object` | Get a single object by ID |
| `hubspot_create_object` | Create a new object |
| `hubspot_update_object` | Update an object's properties |
| `hubspot_delete_object` | Delete (archive) an object |
| `hubspot_search_objects` | Search with a query and/or filterGroups |
| `hubspot_batch_create_objects` | Create up to 100 objects |
| `hubspot_batch_read_objects` | Read up to 100 objects by ID |
| `hubspot_batch_update_objects` | Update up to 100 objects |
| `hubspot_batch_delete_objects` | Delete (archive) up to 100 objects |
| `hubspot_list_properties` | List property definitions for a type |
| `hubspot_get_property` | Get a single property definition |
| `hubspot_list_associations` | List an object's associations to another type |
| `hubspot_create_association` | Associate two objects (default type) |
| `hubspot_delete_association` | Remove an association |

`objectType` accepts any HubSpot CRM object: `contacts`, `companies`, `deals`, `tickets`, or a custom object's name/typeId.

There is deliberately no tool that writes or deletes secrets.

## Setup with Claude Desktop

Store the token once in the OS keychain:

```bash
hubspot auth set hubspot      # or: bun run dev:cli -- auth set hubspot
```

Then add the server with no `env` block (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/hubspot-toolkit/packages/mcp/src/index.ts"]
    }
  }
}
```

The server reads the keychain on every tool call, so `hubspot auth set` takes effect without restarting the host. On macOS, the first read from a GUI host can show a "wants to use your confidential information" dialog; choose **Always Allow**.

An `env` block with `HUBSPOT_ACCESS_TOKEN` still works and takes precedence over the keychain. Set `HUBSPOT_KEYCHAIN=0` there to skip the keychain entirely.

## Development

```bash
# Run in stdio mode
bun run dev

# Inspect with FastMCP inspector
bun run inspect

# Tests spawn the server with HUBSPOT_KEYCHAIN=0
bun test
```
