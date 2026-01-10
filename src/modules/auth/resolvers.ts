import SuperTokens from "supertokens-node";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import Session from "supertokens-node/recipe/session";
import Multitenancy from "supertokens-node/recipe/multitenancy";
import { tenantClient } from "../../clients/proteus.client";
import { MyContext, grpcCall } from "../../utils/grpc-helper"; // grpcCall eklendi

const createTenantViaGrpc = (name: string) => {
    return new Promise<any>((resolve, reject) => {
        tenantClient.CreateTenant({ name }, (err: any, response: any) => {
            if (err) reject(err);
            else resolve(response);
        });
    });
};

const getTokensFromHeaders = (res: any) => {
    const accessToken = res.getHeader("st-access-token") as string;
    const refreshToken = res.getHeader("st-refresh-token") as string;
    return { accessToken, refreshToken };
};

const resolvers = {
  Mutation: {
    login: async (_: any, args: any, context: MyContext) => {
      const { email, password } = args;

      // 1. Giriş Yap (Public context)
      const response = await EmailPassword.signIn(context.tenantId || "public", email, password);

      if (response.status === "WRONG_CREDENTIALS_ERROR") {
        throw new Error("E-posta veya şifre hatalı.");
      }

      const user = response.user;
      const recipeUserId = new SuperTokens.RecipeUserId(user.id);
      
      // 2. Kullanıcının Tenantlarını Bul
      const userTenants = await Multitenancy.listAllTenants(user);
      
      let selectedTenantId: string | undefined;
      let selectedTenantDetails: any = null;

      // 3. Eğer tenantı varsa ilkini seç (Auto-Select)
      if (userTenants.tenants.length > 0) {
        selectedTenantId = userTenants.tenants[0].tenantId;

        // Tenant detaylarını gRPC'den çek (AuthResponse içinde dönmek için)x
        try {
            // Geçici context oluşturup tenantId'yi veriyoruz ki gRPC metadata doğru gitsin
            const tempCtx = { ...context, tenantId: selectedTenantId };
            selectedTenantDetails = await grpcCall(tenantClient, 'GetTenant', { id: selectedTenantId }, tempCtx);
        } catch (e) {
            console.warn("Tenant detayları çekilemedi:", e);
        }
      }

      // 4. Session Oluştur (Seçilen Tenant ID ile)
      // Eğer selectedTenantId varsa payload'a eklenir, yoksa (henüz tenantı yoksa) boş geçer.
      await Session.createNewSession(
          context.req, 
          context.res, 
          "public", 
          recipeUserId,
          selectedTenantId ? { tenant_id: selectedTenantId } : {} // AccessTokenPayload
      );

      const tokens = getTokensFromHeaders(context.res);

      return {
        user: {
          id: user.id,
          email: user.emails[0],
          timeJoined: user.timeJoined
        },
        tenant: selectedTenantDetails, // Artık null dönmüyor (varsa)
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    },

    register: async (_: any, args: any, context: MyContext) => {
      const { email, password, tenantName } = args;

      const response = await EmailPassword.signUp("public", email, password);

      if (response.status === "EMAIL_ALREADY_EXISTS_ERROR") {
        throw new Error("Bu e-posta adresi zaten kullanımda.");
      }

      const user = response.user;

      try {
        const newTenant = await createTenantViaGrpc(tenantName);
        const newTenantId = newTenant.id;

        // Tenant ayarlarını yap (Login methodları)
        await Multitenancy.createOrUpdateTenant(newTenantId, { firstFactors: null });

        // Kullanıcıyı tenant'a ekle
        const recipeUserId = new SuperTokens.RecipeUserId(user.id);
        await Multitenancy.associateUserToTenant(newTenantId, recipeUserId);

        // Session oluştur (Tenant ID ile)
        await Session.createNewSession(
            context.req, 
            context.res, 
            "public", 
            recipeUserId,
            { tenant_id: newTenantId }
        );

        const tokens = getTokensFromHeaders(context.res);

        return {
          user: {
            id: user.id,
            email: user.emails[0],
            timeJoined: user.timeJoined
          },
          tenant: newTenant,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        };

      } catch (error) {
        console.error("Register flow error:", error);
        throw new Error("Kayıt işlemi sırasında bir hata oluştu.");
      }
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