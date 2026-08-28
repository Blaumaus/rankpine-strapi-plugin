const readScope = "plugin::rankpine.settings.read";
const writeScope = "plugin::rankpine.settings.update";

export default {
  admin: {
    type: "admin",
    routes: [
      {
        method: "GET",
        path: "/settings",
        handler: "rankpine.settings",
        config: {
          policies: ["admin::isAuthenticatedAdmin"],
          auth: { scope: [readScope] },
        },
      },
      {
        method: "PUT",
        path: "/settings",
        handler: "rankpine.saveSettings",
        config: {
          policies: ["admin::isAuthenticatedAdmin"],
          auth: { scope: [writeScope] },
        },
      },
      {
        method: "POST",
        path: "/pairing",
        handler: "rankpine.createPairing",
        config: {
          policies: ["admin::isAuthenticatedAdmin"],
          auth: { scope: [writeScope] },
        },
      },
      {
        method: "DELETE",
        path: "/connection",
        handler: "rankpine.disconnectAdmin",
        config: {
          policies: ["admin::isAuthenticatedAdmin"],
          auth: { scope: [writeScope] },
        },
      },
    ],
  },
  "content-api": {
    type: "content-api",
    routes: [
      {
        method: "GET",
        path: "/pair",
        handler: "rankpine.inspectPairing",
        config: { auth: false, policies: [] },
      },
      {
        method: "POST",
        path: "/pair",
        handler: "rankpine.pair",
        config: { auth: false, policies: [] },
      },
      {
        method: "GET",
        path: "/discovery",
        handler: "rankpine.discovery",
        config: { auth: false, policies: [] },
      },
      {
        method: "POST",
        path: "/publish",
        handler: "rankpine.publish",
        config: { auth: false, policies: [] },
      },
      {
        method: "POST",
        path: "/disconnect",
        handler: "rankpine.disconnect",
        config: { auth: false, policies: [] },
      },
    ],
  },
};
