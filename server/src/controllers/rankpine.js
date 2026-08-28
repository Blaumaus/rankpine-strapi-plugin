import { redactError } from "../security.js";

function pairingToken(ctx) {
  const header = ctx.get("authorization");
  const match = /^Pairing ([A-Za-z0-9_-]{32,256})$/.exec(header ?? "");
  return match?.[1];
}

export default ({ strapi }) => {
  const service = () => strapi.plugin("rankpine").service("rankpine");
  return {
    async settings(ctx) {
      ctx.body = await service().settings();
    },

    async saveSettings(ctx) {
      try {
        ctx.body = await service().saveSettings(ctx.request.body ?? {});
      } catch (error) {
        ctx.badRequest(redactError(error));
      }
    },

    async createPairing(ctx) {
      try {
        ctx.body = await service().createPairing();
      } catch (error) {
        ctx.badRequest(redactError(error));
      }
    },

    async disconnectAdmin(ctx) {
      ctx.body = await service().disconnect();
    },

    async inspectPairing(ctx) {
      const token = pairingToken(ctx);
      if (!token) return ctx.unauthorized("Pairing is unavailable.");
      try {
        ctx.body = await service().pairing(token, false);
      } catch {
        ctx.unauthorized("Pairing is unavailable.");
      }
    },

    async pair(ctx) {
      const token = pairingToken(ctx);
      if (!token) return ctx.unauthorized("Pairing is unavailable.");
      try {
        ctx.body = await service().pairing(token, true, ctx.request.body ?? {});
      } catch {
        ctx.unauthorized("Pairing is unavailable.");
      }
    },

    async discovery(ctx) {
      try {
        ctx.body = await service().discovery(ctx);
      } catch {
        ctx.unauthorized("Signed RankPine request required.");
      }
    },

    async publish(ctx) {
      try {
        ctx.body = await service().publish(ctx);
      } catch (error) {
        const message = redactError(error);
        if (/signature|connected|already used/i.test(message)) {
          return ctx.unauthorized("Signed RankPine request required.");
        }
        await service().recordError(error);
        ctx.badRequest(message);
      }
    },

    async disconnect(ctx) {
      try {
        ctx.body = await service().disconnect(ctx);
      } catch {
        ctx.unauthorized("Signed RankPine request required.");
      }
    },
  };
};
