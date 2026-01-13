import SuperTokens from "supertokens-node"
import EmailPassword from "supertokens-node/recipe/emailpassword"
import Session from "supertokens-node/recipe/session"
import Multitenancy from "supertokens-node/recipe/multitenancy"
import UserMetadata from "supertokens-node/recipe/usermetadata"
import Totp from "supertokens-node/recipe/totp"
import { GraphQLError } from "graphql"
import crypto from 'crypto'
import { tenantClient } from "../../clients/proteus.client"
import { MyContext, grpcCall } from "../../utils/grpc-helper"
import { protect } from "../../utils/auth-middleware"
import { PolicyService } from "../../services/policy.service"
import { RolePolicy, UserMetadataStructure } from "../../types/rbac"
import { checkEntityAccess } from "../../utils/rbac-helper"

// --- Helpers ---
const getTokensFromHeaders = (res: any) => {
  const accessToken = res.getHeader("st-access-token") as string
  const refreshToken = res.getHeader("st-refresh-token") as string
  return { accessToken, refreshToken }
}

const resolvers = {
  Query: {
    auth: () => ({}),
  },
  Mutation: {
    auth: () => ({}),
  },

  AuthQueries: {
    // Self Service
    me: protect(async (_parent: any, _args: any, ctx: MyContext) => {
      const userId = ctx.session!.getUserId()
      const user = await SuperTokens.getUser(userId)

      if (!user) return null

      return {
        id: user.id,
        email: user.emails[0],
        timeJoined: user.timeJoined
      }
    }),

    myPermissions: async (_parent: any, _args: any, ctx: MyContext) => {
      return ctx.currentPermissions || null
    },

    // User Management
    tenantUsers: protect(async (_parent: any, args: { limit?: number, paginationToken?: string }, ctx: MyContext) => {
      checkEntityAccess(ctx, "system_iam", "read")

      if (!ctx.tenantId) {
        throw new GraphQLError("Tenant ID required.", { extensions: { code: "BAD_REQUEST" } })
      }

      try {
        const usersResponse = await SuperTokens.getUsersNewestFirst({
          tenantId: ctx.tenantId,
          limit: args.limit || 10,
          paginationToken: args.paginationToken
        })

        return {
          users: usersResponse.users.map(u => ({
            id: u.id,
            email: u.emails[0],
            timeJoined: u.timeJoined
          })),
          nextPaginationToken: usersResponse.nextPaginationToken
        }
      } catch (error) {
        console.error("List Users Error:", error)
        throw new GraphQLError("Failed to list users.", { extensions: { code: "INTERNAL_SERVER_ERROR" } })
      }
    }),

    // Policy Management
    listPolicies: protect(async (_parent: any, _args: any, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError("Tenant ID header is required.", { extensions: { code: "BAD_REQUEST" } })

      checkEntityAccess(ctx, "system_iam", "read")

      const roleNames = await PolicyService.listTenantRoles(ctx.tenantId)

      const results = []
      for (const name of roleNames) {
        const policy = await PolicyService.getRolePolicy(ctx.tenantId, name)
        if (policy) {
          results.push({ name, policy })
        }
      }
      return results
    }),

    getPolicy: protect(async (_parent: any, args: { roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError("Tenant ID header is required.", { extensions: { code: "BAD_REQUEST" } })

      checkEntityAccess(ctx, "system_iam", "read")

      return await PolicyService.getRolePolicy(ctx.tenantId, args.roleName)
    }),
  },

  AuthMutations: {
    // Authentication
    login: async (_parent: any, args: any, context: MyContext) => {
      const { email, password } = args

      const response = await EmailPassword.signIn("public", email, password)

      if (response.status === "WRONG_CREDENTIALS_ERROR") {
        throw new GraphQLError("Wrong credentials", {
          extensions: { code: "WRONG_CREDENTIALS", http: { status: 401 } },
        })
      }

      const user = response.user
      const recipeUserId = new SuperTokens.RecipeUserId(user.id)
      const rawTenantIds = user.tenantIds || []
      const tenantIds = rawTenantIds.filter((id) => id !== "public")

      let activeTenantId: string | undefined
      let activeTenantDetails: any = null
      let availableTenantsDetails: any[] = []
      let initialPermissions: any = null

      let isMfaRequiredByPolicy = false

      if (tenantIds.length > 0) {
        activeTenantId = tenantIds[0]
        try {
          const tempCtx = { ...context, tenantId: activeTenantId }
          activeTenantDetails = await grpcCall(tenantClient, 'GetTenant', { id: activeTenantId }, tempCtx)

          const role = await PolicyService.getUserRoleInTenant(user.id, activeTenantId)
          if (role) {
            const policy = await PolicyService.getRolePolicy(activeTenantId, role)
            if (policy) {
              initialPermissions = policy.permissions
              if (policy.mfa_required) {
                isMfaRequiredByPolicy = true
              }
            }
          }
        } catch (e) { console.warn(e) }

        for (const tId of tenantIds) {
          try {
            const tDetails = await grpcCall(tenantClient, 'GetTenant', { id: tId }, { ...context, tenantId: tId })
            availableTenantsDetails.push(tDetails)
          } catch (error) { }
        }
      }

      const devices = await Totp.listDevices(user.id)
      const hasMfaDevice = devices.devices.length > 0

      await Session.createNewSession(context.req, context.res, "public", recipeUserId, {
        mfaEnforced: isMfaRequiredByPolicy,
        mfaEnabled: hasMfaDevice,
        mfaVerified: false
      })

      const tokens = getTokensFromHeaders(context.res)
      const { metadata } = await UserMetadata.getUserMetadata(user.id)
      const userMeta = metadata as UserMetadataStructure
      const requiresPasswordChange = userMeta.requires_password_change || false

      return {
        user: { id: user.id, email: user.emails[0], timeJoined: user.timeJoined },
        tenant: activeTenantDetails,
        availableTenants: availableTenantsDetails,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        permissions: initialPermissions,
        requiresPasswordChange,
        requiresMfa: isMfaRequiredByPolicy || hasMfaDevice
      }
    },

    register: async (_parent: any, args: any, context: MyContext) => {
      const { email, password } = args
      const response = await EmailPassword.signUp("public", email, password)

      if (response.status === "EMAIL_ALREADY_EXISTS_ERROR") {
        throw new GraphQLError("Email already exists.", { extensions: { code: "EMAIL_ALREADY_EXISTS", http: { status: 409 } } })
      }

      const user = response.user
      const recipeUserId = new SuperTokens.RecipeUserId(user.id)

      await Session.createNewSession(context.req, context.res, "public", recipeUserId)
      const tokens = getTokensFromHeaders(context.res)

      return {
        user: { id: user.id, email: user.emails[0], timeJoined: user.timeJoined },
        tenant: null,
        availableTenants: [],
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        permissions: null,
        requiresPasswordChange: false
      }
    },

    refreshToken: async (_parent: any, args: any, context: MyContext) => {
      const { refreshToken } = args
      try {
        context.req.headers["st-refresh-token"] = refreshToken
        await Session.refreshSession(context.req, context.res)
        const tokens = getTokensFromHeaders(context.res)
        return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
      } catch (err: any) {
        throw new GraphQLError("Session refresh failed.", { extensions: { code: "SESSION_REFRESH_FAILED", http: { status: 401 } } })
      }
    },

    createTotpDevice: protect(async (_parent: any, args: { deviceName: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId()
      const response = await Totp.createDevice(userId, undefined, args.deviceName)

      if (response.status === "DEVICE_ALREADY_EXISTS_ERROR") {
        throw new GraphQLError("Device name already exists.", { extensions: { code: "BAD_REQUEST" } })
      }

      if (response.status === "UNKNOWN_USER_ID_ERROR") {
        throw new GraphQLError("User not found.", { extensions: { code: "UNAUTHENTICATED" } })
      }

      return {
        deviceName: response.deviceName,
        secret: response.secret,
        qrCode: response.qrCodeString
      }
    }, { allowMfaSetup: true }),

    verifyTotpDevice: protect(async (_parent: any, args: { deviceName: string, totp: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId()
      const response = await Totp.verifyDevice("public", userId, args.deviceName, args.totp)

      if (response.status === "UNKNOWN_DEVICE_ERROR") {
        throw new GraphQLError("Device not found.", { extensions: { code: "BAD_REQUEST" } })
      }

      if (response.status === "INVALID_TOTP_ERROR") {
        throw new GraphQLError("Invalid code", { extensions: { code: "INVALID_MFA_CODE" } })
      }

      await ctx.session!.mergeIntoAccessTokenPayload({
        mfaEnabled: true,
        mfaVerified: true
      })

      const tokens = getTokensFromHeaders(ctx.res)
      return {
        verified: true,
        accessToken: tokens.accessToken
      }
    }, { allowMfaSetup: true }),

    verifyMfa: protect(async (_parent: any, args: { totp: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId()
      const response = await Totp.verifyTOTP("public", userId, args.totp)

      if (response.status === "UNKNOWN_USER_ID_ERROR") {
        throw new GraphQLError("User not found.", { extensions: { code: "UNAUTHENTICATED" } })
      }

      if (response.status === "INVALID_TOTP_ERROR") {
        throw new GraphQLError("Invalid code", { extensions: { code: "INVALID_MFA_CODE" } })
      }

      await ctx.session!.mergeIntoAccessTokenPayload({ mfaVerified: true })

      const tokens = getTokensFromHeaders(ctx.res)
      return {
        verified: true,
        accessToken: tokens.accessToken
      }
    }, { requireMfaVerification: false}),

    removeTotpDevice: protect(async (_parent: any, args: { deviceName: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId()
      await Totp.removeDevice(userId, args.deviceName)

      const devices = await Totp.listDevices(userId)
      const hasRemaining = devices.devices.length > 0

      await ctx.session!.mergeIntoAccessTokenPayload({
        mfaEnabled: hasRemaining,
        mfaVerified: hasRemaining
      })
      return true
    }),

    sendPasswordResetEmail: async (_parent: any, args: { email: string }, ctx: MyContext) => {
      const usersResponse = await SuperTokens.listUsersByAccountInfo("public", { email: args.email })

      if (usersResponse.length === 0) {
        return true
      }

      const user = usersResponse[0]

      try {
        const response = await EmailPassword.createResetPasswordToken("public", user.id, args.email)

        if (response.status === "OK") {
          const resetLink = `http://localhost:3000/auth/reset-password?token=${response.token}`

          // TODO: Burada sendEmail(args.email, resetLink) gibi bir servis çağrılmalı.
          console.log("\n========================================")
          console.log("📧 PASSWORD RESET LINK:", resetLink)
          console.log("========================================\n")
        }

        return true
      } catch (error) {
        console.error("Reset Email Error:", error)
        return false
      }
    },

    resetPassword: async (_parent: any, args: { token: string, password: string }, ctx: MyContext) => {
      try {
        const response = await EmailPassword.resetPasswordUsingToken("public", args.token, args.password)

        if (response.status === "OK") {
          return true
        } else {
          throw new GraphQLError("Invalid or expired password reset token.", {
            extensions: { code: "BAD_REQUEST" }
          })
        }
      } catch (error) {
        console.error("Reset Password Error:", error)
        if (error instanceof GraphQLError) throw error
        throw new GraphQLError("Failed to reset password.", { extensions: { code: "INTERNAL_SERVER_ERROR" } })
      }
    },

    // Tenant Creation
    createOwnTenant: protect(
      async (_parent: any, args: { name: string }, context: MyContext) => {
        const userId = context.session!.getUserId()
        const recipeUserId = new SuperTokens.RecipeUserId(userId)

        try {
          const newTenant: any = await new Promise((resolve, reject) => {
            tenantClient.CreateTenant({ name: args.name }, (err: any, res: any) => err ? reject(err) : resolve(res))
          })

          const newTenantId = newTenant.id

          await Multitenancy.createOrUpdateTenant(newTenantId)
          await Multitenancy.associateUserToTenant(newTenantId, recipeUserId)

          const adminPolicy: RolePolicy = {
            description: "Root Admin Policy",
            mfa_required: true,
            permissions: {
              "system_iam": { access: true, actions: ["*"] },
              "*": { access: true, actions: ["*"] }
            }
          }

          await PolicyService.setRolePolicy(newTenantId, "admin", adminPolicy)
          await PolicyService.assignRoleToUser(userId, newTenantId, "admin")

          return newTenant
        } catch (error) {
          console.error("Create Tenant Error:", error)
          throw new GraphQLError("Tenant creation failed.", { extensions: { code: "TENANT_CREATION_FAILED", http: { status: 500 } } })
        }
      }
    ),

    // Self Service
    updateMe: protect(async (_parent: any, args: { input: { email?: string, password?: string } }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId()
      const recipeUserId = new SuperTokens.RecipeUserId(userId)

      const response = await EmailPassword.updateEmailOrPassword({
        recipeUserId,
        email: args.input.email,
        password: args.input.password
      })

      if (response.status === "EMAIL_ALREADY_EXISTS_ERROR") {
        throw new GraphQLError("Email already exists.", { extensions: { code: "EMAIL_ALREADY_EXISTS" } })
      }

      if (args.input.password) {
        await UserMetadata.updateUserMetadata(userId, {
          requires_password_change: false
        })
      }

      const user = await SuperTokens.getUser(userId)
      if (!user) throw new GraphQLError("User not found.", { extensions: { code: "INTERNAL_SERVER_ERROR" } })

      return {
        id: user.id,
        email: user.emails[0],
        timeJoined: user.timeJoined
      }
    }),

    // User Management
    inviteUser: protect(async (_parent: any, args: { email: string, roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError("Tenant ID required.", { extensions: { code: "BAD_REQUEST" } })

      checkEntityAccess(ctx, "system_iam", "create")

      try {
        const senderId = ctx.session!.getUserId()

        const usersResponse = await SuperTokens.listUsersByAccountInfo("public", {
          email: args.email
        })

        if (usersResponse.length > 0) {
          const targetUser = usersResponse[0]

          const inviteToken = crypto.randomBytes(32).toString('hex')
          await PolicyService.addPendingInvite(targetUser.id, inviteToken, {
            tenantId: ctx.tenantId,
            roleName: args.roleName,
            invitedBy: senderId,
            createdAt: Date.now()
          })

          const inviteLink = `http://localhost:3000/auth/join-tenant?token=${inviteToken}`

          console.log("\n========================================")
          console.log("📨 VAROLAN KULLANICIYA DAVET LİNKİ (Metadata):", inviteLink)
          console.log("========================================\n")

          return true

        } else {
          const tempPassword = crypto.randomBytes(8).toString('hex') + "A1!"

          const signUpResponse = await EmailPassword.signUp("public", args.email, tempPassword)

          if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
            throw new GraphQLError("User exists conflict.")
          }

          const newUser = signUpResponse.user
          const recipeUserId = new SuperTokens.RecipeUserId(newUser.id)

          await Multitenancy.associateUserToTenant(ctx.tenantId, recipeUserId)
          await PolicyService.assignRoleToUser(newUser.id, ctx.tenantId, args.roleName)
          await UserMetadata.updateUserMetadata(newUser.id, { requires_password_change: true })

          console.log("\n========================================")
          console.log("wk YENİ KULLANICI OLUŞTURULDU")
          console.log(`Email: ${args.email}`)
          console.log(`Geçici Şifre: ${tempPassword}`)
          console.log(`Login Linki: http://localhost:3000/auth/login`)
          console.log("========================================\n")

          return true
        }
      } catch (e: any) {
        console.error("Invite Error:", e)
        if (e instanceof GraphQLError) throw e
        return false
      }
    }),

    acceptInvite: protect(async (_parent: any, args: { token: string }, ctx: MyContext) => {
      const userId = ctx.session!.getUserId()
      const inviteData = await PolicyService.consumePendingInvite(userId, args.token)

      if (!inviteData) {
        throw new GraphQLError("Invalid or expired invite token.", { extensions: { code: "BAD_REQUEST" } })
      }

      try {
        const recipeUserId = new SuperTokens.RecipeUserId(userId)
        await Multitenancy.associateUserToTenant(inviteData.tenantId, recipeUserId)
        await PolicyService.assignRoleToUser(userId, inviteData.tenantId, inviteData.roleName)

        return true
      } catch (e) {
        console.error("Accept Invite Failed:", e)
        throw new GraphQLError("Failed to join tenant.", { extensions: { code: "INTERNAL_SERVER_ERROR" } })
      }
    }),

    assignRole: protect(async (_parent: any, args: { userId: string, roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError("Tenant ID header is required.", { extensions: { code: "BAD_REQUEST" } })

      checkEntityAccess(ctx, "system_iam", "update")

      try {
        await PolicyService.assignRoleToUser(args.userId, ctx.tenantId, args.roleName)
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    }),

    removeUserFromTenant: protect(async (_parent: any, args: { userId: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError("Tenant ID required.", { extensions: { code: "BAD_REQUEST" } })

      checkEntityAccess(ctx, "system_iam", "delete")

      try {
        const recipeUserId = new SuperTokens.RecipeUserId(args.userId)

        await Multitenancy.disassociateUserFromTenant(ctx.tenantId, recipeUserId)
        await PolicyService.removeUserRole(args.userId, ctx.tenantId)

        return true
      } catch (e) {
        console.error("Remove User Error:", e)
        return false
      }
    }),

    updateUser: protect(async (_parent: any, args: { userId: string, input: { email?: string, password?: string } }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError("Tenant ID header is required.", { extensions: { code: "BAD_REQUEST" } })

      checkEntityAccess(ctx, "system_iam", "update")

      const targetUserRole = await PolicyService.getUserRoleInTenant(args.userId, ctx.tenantId)
      if (!targetUserRole) {
        throw new GraphQLError("User is not a member of this tenant.", { extensions: { code: "NOT_FOUND" } })
      }

      const recipeUserId = new SuperTokens.RecipeUserId(args.userId)

      const response = await EmailPassword.updateEmailOrPassword({
        recipeUserId,
        email: args.input.email,
        password: args.input.password
      })

      if (response.status === "EMAIL_ALREADY_EXISTS_ERROR") {
        throw new GraphQLError("Email already exists.", { extensions: { code: "EMAIL_ALREADY_EXISTS" } })
      } else if (response.status === "UNKNOWN_USER_ID_ERROR") {
        throw new GraphQLError("User not found.", { extensions: { code: "USER_NOT_FOUND" } })
      }

      const user = await SuperTokens.getUser(args.userId)
      if (!user) throw new GraphQLError("User not found.", { extensions: { code: "USER_NOT_FOUND" } })

      return {
        id: user.id,
        email: user.emails[0],
        timeJoined: user.timeJoined
      }
    }),

    // Policy Management
    createPolicy: protect(async (_parent: any, args: { roleName: string, policy: RolePolicy }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError("Tenant ID header is required.", { extensions: { code: "BAD_REQUEST" } })

      checkEntityAccess(ctx, "system_iam", "create")

      try {
        await PolicyService.setRolePolicy(ctx.tenantId, args.roleName, args.policy)
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    }),

    deletePolicy: protect(async (_parent: any, args: { roleName: string }, ctx: MyContext) => {
      if (!ctx.tenantId) throw new GraphQLError("Tenant ID header is required.", { extensions: { code: "BAD_REQUEST" } })

      checkEntityAccess(ctx, "system_iam", "delete")

      if (args.roleName === "admin") {
        throw new GraphQLError("Cannot delete root admin role.", { extensions: { code: "BAD_REQUEST" } })
      }

      try {
        await PolicyService.deleteRolePolicy(ctx.tenantId, args.roleName)
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    }),
  },
}

export default resolvers