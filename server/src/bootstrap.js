const actions = [
  {
    section: "settings",
    displayName: "Read RankPine settings",
    uid: "settings.read",
    pluginName: "rankpine",
  },
  {
    section: "settings",
    displayName: "Update RankPine settings and connection",
    uid: "settings.update",
    pluginName: "rankpine",
  },
];

export default async ({ strapi }) => {
  await strapi.admin.services.permission.actionProvider.registerMany(actions);
};
