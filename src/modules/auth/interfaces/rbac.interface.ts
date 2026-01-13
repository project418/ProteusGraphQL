export interface EntityPermission {
  access: boolean;
  actions: ('create' | 'read' | 'update' | 'delete' | '*')[];
  denied_fields?: string[];
}

export interface RolePolicy {
  description?: string;
  mfa_required?: boolean;
  permissions: {
    [entityName: string]: EntityPermission;
  };
}

export interface InviteInfo {
  tenantId: string;
  roleName: string;
  invitedBy: string;
  createdAt: number;
}

export interface UserMetadataStructure {
  tenants?: {
    [tenantId: string]: string;
  };
  pending_invites?: {
    [token: string]: InviteInfo;
  };
  requires_password_change?: boolean;
  roles?: string[];
  policy?: RolePolicy;
}
