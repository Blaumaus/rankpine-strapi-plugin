import { pluginId } from "./pluginId";
import { PluginIcon } from "./components/PluginIcon";

const permissions = [
  { action: "plugin::rankpine.settings.read", subject: null },
  { action: "plugin::rankpine.settings.update", subject: null },
];

export default {
  register(app: { registerPlugin(input: { id: string; name: string }): void }) {
    app.registerPlugin({ id: pluginId, name: "RankPine" });
  },

  bootstrap(app: {
    addSettingsLink(
      section: string,
      input: {
        id: string;
        icon: typeof PluginIcon;
        intlLabel: { id: string; defaultMessage: string };
        to: string;
        Component: () => Promise<unknown>;
        permissions: typeof permissions;
      },
    ): void;
  }) {
    app.addSettingsLink("global", {
      id: pluginId,
      icon: PluginIcon,
      intlLabel: { id: "rankpine.plugin.name", defaultMessage: "RankPine" },
      to: "rankpine",
      Component: () => import("./pages/Settings"),
      permissions,
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales
        .filter((locale) => locale === "en")
        .map(async (locale) => ({
          data: (await import(`./translations/${locale}.json`)).default,
          locale,
        })),
    );
  },
};
