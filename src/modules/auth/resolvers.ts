import SuperTokens from "supertokens-node";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import Session from "supertokens-node/recipe/session";
import Multitenancy from "supertokens-node/recipe/multitenancy";
import { tenantClient } from "../../clients/proteus.client";
import { MyContext, grpcCall } from "../../utils/grpc-helper";

// Yardımcı fonksiyon: Header'dan tokenları al
const getTokensFromHeaders = (res: any) => {
  const accessToken = res.getHeader("st-access-token") as string;
  const refreshToken = res.getHeader("st-refresh-token") as string;
  return { accessToken, refreshToken };
};

const resolvers = {
  Mutation: {
    login: async (_: any, args: any, context: MyContext) => {
      const { email, password } = args;

      const response = await EmailPassword.signIn("public", email, password);

      if (response.status === "WRONG_CREDENTIALS_ERROR") {
        throw new Error("E-posta veya şifre hatalı.");
      }

      const user = response.user;
      const recipeUserId = new SuperTokens.RecipeUserId(user.id);
      const rawTenantIds = user.tenantIds || [];
      const tenantIds = rawTenantIds.filter((id) => id !== "public");

      let activeTenantId: string | undefined;
      let activeTenantDetails: any = null;
      let availableTenantsDetails: any[] = [];

      if (tenantIds.length > 0) {
        activeTenantId = tenantIds[0];

        try {
          const tempCtx = { ...context, tenantId: activeTenantId };
          activeTenantDetails = await grpcCall(tenantClient, 'GetTenant', { id: activeTenantId }, tempCtx);
        } catch (e) {
          console.warn(`Tenant (${activeTenantId}) detayları çekilemedi:`, e);
        }

        for (const tId of tenantIds) {
            try {
                const tDetails = await grpcCall(tenantClient, 'GetTenant', { id: tId }, { ...context, tenantId: tId });
                availableTenantsDetails.push(tDetails);
            } catch (error) {
                console.warn(`Tenant listesi oluşturulurken hata: ${tId}`);
            }
        }
      }

      await Session.createNewSession(
        context.req,
        context.res,
        "public", 
        recipeUserId,
        activeTenantId ? { tenant_id: activeTenantId } : {}
      );

      const tokens = getTokensFromHeaders(context.res);

      return {
        user: {
          id: user.id,
          email: user.emails[0],
          timeJoined: user.timeJoined
        },
        tenant: activeTenantDetails,
        availableTenants: availableTenantsDetails,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    },

    register: async (_: any, args: any, context: MyContext) => {
      const { email, password } = args;

      const response = await EmailPassword.signUp("public", email, password);

      if (response.status === "EMAIL_ALREADY_EXISTS_ERROR") {
        throw new Error("Bu e-posta adresi zaten kullanımda.");
      }

      const user = response.user;
      const recipeUserId = new SuperTokens.RecipeUserId(user.id);

      await Session.createNewSession(
        context.req,
        context.res,
        "public",
        recipeUserId,
        {} 
      );

      const tokens = getTokensFromHeaders(context.res);

      return {
        user: {
          id: user.id,
          email: user.emails[0],
          timeJoined: user.timeJoined
        },
        tenant: null, 
        availableTenants: [],
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    },

    createOwnTenant: async (_: any, args: { name: string }, context: MyContext) => {
      if (!context.session) {
        throw new Error("Bu işlem için giriş yapmalısınız.");
      }

      const userId = context.session.getUserId();
      const recipeUserId = new SuperTokens.RecipeUserId(userId);

      try {
        const newTenant: any = await new Promise((resolve, reject) => {
            tenantClient.CreateTenant({ name: args.name }, (err: any, response: any) => {
                if (err) reject(err);
                else resolve(response);
            });
        });

        const newTenantId = newTenant.id;

        await Multitenancy.createOrUpdateTenant(newTenantId);
        await Multitenancy.associateUserToTenant(newTenantId, recipeUserId);

        await Session.createNewSession(
            context.req,
            context.res,
            "public",
            recipeUserId,
            { tenant_id: newTenantId }
        );

        return newTenant;

      } catch (error) {
        console.error("Create Own Tenant Error:", error);
        throw new Error("Tenant oluşturulamadı.");
      }
    },

    switchTenant: async (_: any, args: { tenantId: string }, context: MyContext) => {
        if (!context.session) {
            throw new Error("Oturum bulunamadı.");
        }

        const targetTenantId = args.tenantId;
        const userId = context.session.getUserId();
        
        const user = await SuperTokens.getUser(userId);
        if (!user) {
            throw new Error("Kullanıcı bulunamadı.");
        }
        
        const rawTenantIds = user.tenantIds || [];
        const tenantIds = rawTenantIds.filter((id) => id !== "public");
        const hasAccess = tenantIds.includes(targetTenantId);

        if (!hasAccess) {
            throw new Error("Bu tenant'a erişim yetkiniz yok.");
        }

        const recipeUserId = new SuperTokens.RecipeUserId(userId);
        await Session.createNewSession(
            context.req,
            context.res,
            "public",
            recipeUserId,
            { tenant_id: targetTenantId }
        );

        const targetTenantDetails = await grpcCall(tenantClient, 'GetTenant', { id: targetTenantId }, { ...context, tenantId: targetTenantId });
        
        let availableTenantsDetails: any[] = [];
        for (const tId of tenantIds) {
            try {
                const tDetails = await grpcCall(tenantClient, 'GetTenant', { id: tId }, { ...context, tenantId: tId });
                availableTenantsDetails.push(tDetails);
            } catch (e) {}
        }

        const tokens = getTokensFromHeaders(context.res);

        return {
            user: { id: userId, email: user.emails[0], timeJoined: user.timeJoined },
            tenant: targetTenantDetails,
            availableTenants: availableTenantsDetails,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        };
    },

    refreshToken: async (_: any, args: any, context: MyContext) => {
        const { refreshToken } = args;
        try {
            context.req.headers["st-refresh-token"] = refreshToken;
            await Session.refreshSession(context.req, context.res);
            
            const tokens = getTokensFromHeaders(context.res);
            if (!tokens.accessToken || !tokens.refreshToken) {
                throw new Error("Token yenileme başarısız oldu.");
            }
            return {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            };
        } catch (err: any) {
            console.error("Refresh error:", err);
            throw new Error("Oturum yenilenemedi.");
        }
    }
  }
};

export default resolvers;