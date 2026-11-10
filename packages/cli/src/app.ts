import { buildApplication, buildRouteMap } from "@stricli/core";
import { listObjectsCommand } from "./commands/objects/list.js";
import { getObjectCommand } from "./commands/objects/get.js";
import { createObjectCommand } from "./commands/objects/create.js";
import { updateObjectCommand } from "./commands/objects/update.js";
import { deleteObjectCommand } from "./commands/objects/delete.js";
import { searchObjectsCommand } from "./commands/objects/search.js";
import { batchCreateObjectsCommand } from "./commands/objects/batch-create.js";
import { batchReadObjectsCommand } from "./commands/objects/batch-read.js";
import { batchUpdateObjectsCommand } from "./commands/objects/batch-update.js";
import { batchDeleteObjectsCommand } from "./commands/objects/batch-delete.js";
import { listPropertiesCommand } from "./commands/properties/list.js";
import { getPropertyCommand } from "./commands/properties/get.js";
import { listAssociationsCommand } from "./commands/associations/list.js";
import { createAssociationCommand } from "./commands/associations/create.js";
import { deleteAssociationCommand } from "./commands/associations/delete.js";
import { agentContextCommand } from "./commands/agent-context.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { authSetCommand } from "./commands/auth/set.js";
import { authListCommand } from "./commands/auth/list.js";
import { authDeleteCommand } from "./commands/auth/delete.js";
import { authMigrateCommand } from "./commands/auth/migrate.js";
import { showConfigCommand } from "./commands/config/show.js";

const objectsRoutes = buildRouteMap({
  routes: {
    list: listObjectsCommand,
    get: getObjectCommand,
    create: createObjectCommand,
    update: updateObjectCommand,
    delete: deleteObjectCommand,
    search: searchObjectsCommand,
    "batch-create": batchCreateObjectsCommand,
    "batch-read": batchReadObjectsCommand,
    "batch-update": batchUpdateObjectsCommand,
    "batch-delete": batchDeleteObjectsCommand,
  },
  docs: {
    brief: "CRUD, search, and batch operations on any HubSpot CRM object type",
  },
});

const propertiesRoutes = buildRouteMap({
  routes: {
    list: listPropertiesCommand,
    get: getPropertyCommand,
  },
  docs: {
    brief: "Inspect property (field) definitions for an object type",
  },
});

const associationsRoutes = buildRouteMap({
  routes: {
    list: listAssociationsCommand,
    create: createAssociationCommand,
    delete: deleteAssociationCommand,
  },
  docs: {
    brief: "Manage associations between objects (e.g. contact <-> company)",
  },
});

const authRoutes = buildRouteMap({
  routes: {
    set: authSetCommand,
    list: authListCommand,
    delete: authDeleteCommand,
    migrate: authMigrateCommand,
  },
  docs: { brief: "Store, list, delete, and migrate credentials in the OS keychain" },
});

const configRoutes = buildRouteMap({
  routes: { show: showConfigCommand },
  docs: { brief: "Inspect resolved configuration (secrets redacted)" },
});

const routes = buildRouteMap({
  routes: {
    auth: authRoutes,
    config: configRoutes,
    objects: objectsRoutes,
    properties: propertiesRoutes,
    associations: associationsRoutes,
    "agent-context": agentContextCommand,
    upgrade: upgradeCommand,
  },
  docs: {
    brief: "HubSpot CLI — agent-native CRUD for CRM objects, properties, and associations",
  },
});

export const app = buildApplication(routes, {
  name: "hubspot",
  versionInfo: {
    currentVersion: "0.2.0",
  },
});
