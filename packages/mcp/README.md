# @hubspot-toolkit/mcp

MCP server for HubSpot CRM, built with [FastMCP](https://github.com/punkpeye/fastmcp).

## Tools

| Tool | Description |
|------|-------------|
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

## Setup with Claude Desktop

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hubspot-toolkit": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/hubspot-toolkit/packages/mcp/src/index.ts"],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "your-private-app-token-here"
      }
    }
  }
}
```

## Development

```bash
# Run in stdio mode
bun run dev

# Inspect with FastMCP inspector
bun run inspect
```
