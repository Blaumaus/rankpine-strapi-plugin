"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const __variableDynamicImportRuntimeHelper = (glob, path, segs) => {
  const v = glob[path];
  if (v) {
    return typeof v === "function" ? v() : Promise.resolve(v);
  }
  return new Promise((_, reject) => {
    (typeof queueMicrotask === "function" ? queueMicrotask : setTimeout)(
      reject.bind(
        null,
        new Error(
          "Unknown variable dynamic import: " + path + (path.split("/").length !== segs ? ". Note that variables only represent file names one level deep." : "")
        )
      )
    );
  });
};
const pluginId = "rankpine";
function PluginIcon(props) {
  return /* @__PURE__ */ jsxRuntime.jsx("svg", { viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, focusable: "false", ...props, children: /* @__PURE__ */ jsxRuntime.jsx(
    "path",
    {
      d: "M12 2.5 5.75 10h3.1L4.5 15.5h4.4L6 21.5h12L15.1 15.5h4.4L15.15 10h3.1L12 2.5Z",
      fill: "currentColor"
    }
  ) });
}
const permissions = [
  { action: "plugin::rankpine.settings.read", subject: null },
  { action: "plugin::rankpine.settings.update", subject: null }
];
const index = {
  register(app) {
    app.registerPlugin({ id: pluginId, name: "RankPine" });
  },
  bootstrap(app) {
    app.addSettingsLink("global", {
      id: pluginId,
      icon: PluginIcon,
      intlLabel: { id: "rankpine.plugin.name", defaultMessage: "RankPine" },
      to: "rankpine",
      Component: () => Promise.resolve().then(() => require("./Settings-DNHvxmiA.cjs")),
      permissions
    });
  },
  async registerTrads({ locales }) {
    return Promise.all(
      locales.filter((locale) => locale === "en").map(async (locale) => ({
        data: (await __variableDynamicImportRuntimeHelper(/* @__PURE__ */ Object.assign({ "./translations/en.json": () => Promise.resolve().then(() => require("./en-G5be-d35.cjs")) }), `./translations/${locale}.json`, 3)).default,
        locale
      }))
    );
  }
};
exports.default = index;
