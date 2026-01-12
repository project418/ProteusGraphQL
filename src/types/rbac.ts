export interface EntityPermission {
    access: boolean;
    actions: ("create" | "read" | "update" | "delete" | "*")[];
    denied_fields?: string[];
}

export interface RolePolicy {
    description?: string;
    permissions: {
        [entityName: string]: EntityPermission;
    };
}

export interface UserMetadataStructure {
    tenants?: {
        [tenantId: string]: string;
    };
}