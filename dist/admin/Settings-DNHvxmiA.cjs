"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const jsxRuntime = require("react/jsx-runtime");
const designSystem = require("@strapi/design-system");
const icons = require("@strapi/icons");
const admin = require("@strapi/strapi/admin");
const react = require("react");
const MAPPABLE_FIELD_TYPES = /* @__PURE__ */ new Set([
  "string",
  "text",
  "richtext",
  "blocks",
  "uid",
  "media",
  "date",
  "datetime",
  "timestamp",
  "boolean",
  "enumeration",
  "relation"
]);
function Settings() {
  const client = admin.useFetchClient();
  const [data, setData] = react.useState();
  const [publicUrl, setPublicUrl] = react.useState("");
  const [contentTypeUid, setContentTypeUid] = react.useState("");
  const [busy, setBusy] = react.useState(false);
  const [message, setMessage] = react.useState();
  const load = react.useCallback(async () => {
    const response = await client.get("/rankpine/settings");
    const next = response.data;
    setData(next);
    setPublicUrl(next.publicUrl);
    setContentTypeUid(next.selectedContentTypeUid);
  }, [client]);
  react.useEffect(() => {
    void load().catch(
      () => setMessage({ kind: "danger", text: "RankPine settings could not be loaded." })
    );
  }, [load]);
  async function save() {
    setBusy(true);
    setMessage(void 0);
    try {
      await client.put("/rankpine/settings", { publicUrl, selectedContentTypeUid: contentTypeUid });
      await load();
      setMessage({ kind: "success", text: "Publishing target saved." });
    } catch (error) {
      setMessage({
        kind: "danger",
        text: providerMessage(error, "Check the public URL and collection, then try again.")
      });
    } finally {
      setBusy(false);
    }
  }
  async function pair() {
    setBusy(true);
    setMessage(void 0);
    try {
      await client.put("/rankpine/settings", { publicUrl, selectedContentTypeUid: contentTypeUid });
      const response = await client.post("/rankpine/pairing");
      const pairing = response.data;
      if (!pairing.connectUrl || !pairing.siteUrl || !pairing.pairToken) {
        throw new Error("Pairing handoff missing");
      }
      const target = new URL(pairing.connectUrl);
      if (target.protocol !== "https:" || target.pathname !== "/connect/strapi") {
        throw new Error("Pairing destination is invalid");
      }
      const form = document.createElement("form");
      form.method = "post";
      form.action = target.toString();
      for (const [name, value] of Object.entries({
        intent: "bootstrap",
        siteUrl: pairing.siteUrl,
        pairToken: pairing.pairToken
      })) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.append(input);
      }
      document.body.append(form);
      form.submit();
    } catch (error) {
      setMessage({
        kind: "danger",
        text: providerMessage(error, "A one-time pairing link could not be created.")
      });
      setBusy(false);
    }
  }
  async function disconnect() {
    if (!window.confirm("Disconnect RankPine and revoke its signing key?")) return;
    setBusy(true);
    try {
      await client.del("/rankpine/connection");
      await load();
      setMessage({ kind: "success", text: "RankPine disconnected. The signing key was revoked." });
    } catch (error) {
      setMessage({
        kind: "danger",
        text: providerMessage(error, "The connection could not be revoked.")
      });
    } finally {
      setBusy(false);
    }
  }
  if (!data) {
    return /* @__PURE__ */ jsxRuntime.jsx(designSystem.Main, { children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Flex, { minHeight: "60vh", justifyContent: "center", alignItems: "center", children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Loader, { children: "Loading RankPine settings" }) }) });
  }
  const selected = data.contentTypes.find((contentType) => contentType.uid === contentTypeUid);
  const unsupported = selected?.attributes.filter((field) => !MAPPABLE_FIELD_TYPES.has(field.type));
  return /* @__PURE__ */ jsxRuntime.jsx(designSystem.Main, { children: /* @__PURE__ */ jsxRuntime.jsx(designSystem.Box, { paddingTop: 10, paddingBottom: 10, paddingLeft: 10, paddingRight: 10, children: /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { direction: "column", alignItems: "stretch", gap: 6, maxWidth: "960px", margin: "0 auto", children: [
    /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { justifyContent: "space-between", alignItems: "flex-start", gap: 4, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Box, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { variant: "alpha", tag: "h1", children: "RankPine" }),
        /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { textColor: "neutral600", children: "Publish RankPine articles into one explicit Strapi 5 collection." })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(designSystem.Badge, { active: data.connection.connected, children: data.connection.connected ? "Connected" : "Not connected" })
    ] }),
    message ? /* @__PURE__ */ jsxRuntime.jsx(
      designSystem.Alert,
      {
        closeLabel: "Close",
        title: message.kind === "success" ? "Saved" : "Check settings",
        variant: message.kind,
        children: message.text
      }
    ) : null,
    /* @__PURE__ */ jsxRuntime.jsx(
      designSystem.Box,
      {
        background: "neutral0",
        borderColor: "neutral150",
        hasRadius: true,
        shadow: "tableShadow",
        padding: 6,
        children: /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { direction: "column", alignItems: "stretch", gap: 5, children: [
          /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Box, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { variant: "beta", tag: "h2", children: "Publishing target" }),
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { textColor: "neutral600", children: "RankPine validates this live schema before every plugin-assisted write." })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Field.Root, { name: "publicUrl", required: true, children: [
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Field.Label, { children: "Public Strapi URL" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              designSystem.Field.Input,
              {
                type: "url",
                value: publicUrl,
                onChange: (event) => setPublicUrl(event.target.value),
                placeholder: "https://cms.example.com"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Field.Hint, { children: "HTTPS only. Private and loopback targets are rejected by RankPine." })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Field.Root, { name: "collection", required: true, children: [
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Field.Label, { children: "Collection type" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              designSystem.SingleSelect,
              {
                value: contentTypeUid,
                onChange: (value) => setContentTypeUid(value),
                children: data.contentTypes.map((contentType) => /* @__PURE__ */ jsxRuntime.jsxs(designSystem.SingleSelectOption, { value: contentType.uid, children: [
                  contentType.displayName,
                  " · ",
                  contentType.uid
                ] }, contentType.uid))
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Field.Hint, { children: "Single types are excluded. RankPine maps only fields you approve." })
          ] }),
          unsupported && unsupported.length > 0 ? /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Alert, { closeLabel: "Close", title: "Structured fields detected", variant: "default", children: [
            "These field types are discovered but cannot be mapped. Required ones must be made optional or replaced with supported top-level fields:",
            " ",
            unsupported.map((field) => field.name).join(", "),
            "."
          ] }) : null,
          /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { gap: 3, wrap: "wrap", children: [
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Button, { onClick: save, loading: busy, disabled: !publicUrl || !contentTypeUid, children: "Save settings" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              designSystem.Button,
              {
                variant: "secondary",
                startIcon: /* @__PURE__ */ jsxRuntime.jsx(icons.Link, {}),
                onClick: pair,
                loading: busy,
                disabled: !publicUrl || !contentTypeUid,
                children: data.connection.connected ? "Rotate connection" : "Connect RankPine"
              }
            ),
            data.connection.connected ? /* @__PURE__ */ jsxRuntime.jsx(
              designSystem.Button,
              {
                variant: "danger-light",
                startIcon: /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, {}),
                onClick: disconnect,
                loading: busy,
                children: "Disconnect"
              }
            ) : null
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Grid.Root, { gap: 4, children: [
      /* @__PURE__ */ jsxRuntime.jsx(designSystem.Grid.Item, { col: 6, s: 12, children: /* @__PURE__ */ jsxRuntime.jsx(
        designSystem.Box,
        {
          background: "neutral0",
          borderColor: "neutral150",
          hasRadius: true,
          padding: 5,
          height: "100%",
          children: /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { direction: "column", alignItems: "stretch", gap: 3, children: [
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { variant: "delta", tag: "h2", children: "Connection" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              Diagnostic,
              {
                label: "Signing",
                value: data.connection.connected ? "Ed25519 verified" : "Not paired",
                ok: data.connection.connected
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(Diagnostic, { label: "Key ID", value: data.connection.keyId ?? "—" }),
            /* @__PURE__ */ jsxRuntime.jsx(Diagnostic, { label: "Paired", value: formatTime(data.connection.pairedAt) })
          ] })
        }
      ) }),
      /* @__PURE__ */ jsxRuntime.jsx(designSystem.Grid.Item, { col: 6, s: 12, children: /* @__PURE__ */ jsxRuntime.jsx(
        designSystem.Box,
        {
          background: "neutral0",
          borderColor: "neutral150",
          hasRadius: true,
          padding: 5,
          height: "100%",
          children: /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { direction: "column", alignItems: "stretch", gap: 3, children: [
            /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { variant: "delta", tag: "h2", children: "Diagnostics" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              Diagnostic,
              {
                label: "Strapi",
                value: data.strapiVersion,
                ok: data.strapiVersion.startsWith("5")
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              Diagnostic,
              {
                label: "HTTPS",
                value: data.diagnostics.https ? "Enabled" : "Needs configuration",
                ok: data.diagnostics.https
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              Diagnostic,
              {
                label: "Last signed request",
                value: formatTime(data.diagnostics.lastRequestAt)
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(Diagnostic, { label: "Telemetry", value: "None", ok: true })
          ] })
        }
      ) })
    ] }),
    data.diagnostics.lastError ? /* @__PURE__ */ jsxRuntime.jsx(designSystem.Alert, { closeLabel: "Close", title: "Last publishing error", variant: "danger", children: data.diagnostics.lastError }) : null,
    /* @__PURE__ */ jsxRuntime.jsx(designSystem.Divider, {}),
    /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { justifyContent: "space-between", gap: 4, wrap: "wrap", children: [
      /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Typography, { textColor: "neutral600", children: [
        "Plugin ",
        data.pluginVersion,
        " · Strapi 5 only"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(
        designSystem.Link,
        {
          href: "https://rankpine.com/docs/integrations/strapi",
          isExternal: true,
          endIcon: /* @__PURE__ */ jsxRuntime.jsx(icons.ExternalLink, {}),
          children: "Connection guide"
        }
      )
    ] })
  ] }) }) });
}
function Diagnostic({ label, value, ok }) {
  return /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { justifyContent: "space-between", gap: 4, children: [
    /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { textColor: "neutral600", children: label }),
    /* @__PURE__ */ jsxRuntime.jsxs(designSystem.Flex, { gap: 2, children: [
      ok ? /* @__PURE__ */ jsxRuntime.jsx(icons.CheckCircle, { fill: "success600" }) : null,
      /* @__PURE__ */ jsxRuntime.jsx(designSystem.Typography, { fontWeight: "semiBold", children: value })
    ] })
  ] });
}
function formatTime(value) {
  return value ? new Intl.DateTimeFormat(void 0, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  ) : "—";
}
function providerMessage(error, fallback) {
  if (!error || typeof error !== "object") return fallback;
  const response = error.response;
  return response?.data?.error?.message ?? fallback;
}
exports.default = Settings;
