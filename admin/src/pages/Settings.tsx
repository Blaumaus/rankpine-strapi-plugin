import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Field,
  Flex,
  Grid,
  Link,
  Loader,
  Main,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from "@strapi/design-system";
import { CheckCircle, ExternalLink, Link as LinkIcon, Trash } from "@strapi/icons";
import { useFetchClient } from "@strapi/strapi/admin";
import { useCallback, useEffect, useState } from "react";

interface CollectionType {
  uid: string;
  displayName: string;
  attributes: Array<{ name: string; type: string; required: boolean }>;
}

interface SettingsData {
  strapiVersion: string;
  pluginVersion: string;
  publicUrl: string;
  selectedContentTypeUid: string;
  contentTypes: CollectionType[];
  connection: {
    connected: boolean;
    keyId?: string;
    contentTypeUid?: string;
    pairedAt?: string;
  };
  diagnostics: {
    https: boolean;
    lastRequestAt?: string | null;
    lastError?: string | null;
    telemetry: false;
  };
}

const MAPPABLE_FIELD_TYPES = new Set([
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
  "relation",
]);

export default function Settings() {
  const client = useFetchClient();
  const [data, setData] = useState<SettingsData>();
  const [publicUrl, setPublicUrl] = useState("");
  const [contentTypeUid, setContentTypeUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "danger"; text: string }>();

  const load = useCallback(async () => {
    const response = await client.get("/rankpine/settings");
    const next = response.data as SettingsData;
    setData(next);
    setPublicUrl(next.publicUrl);
    setContentTypeUid(next.selectedContentTypeUid);
  }, [client]);

  useEffect(() => {
    void load().catch(() =>
      setMessage({ kind: "danger", text: "RankPine settings could not be loaded." }),
    );
  }, [load]);

  async function save() {
    setBusy(true);
    setMessage(undefined);
    try {
      await client.put("/rankpine/settings", { publicUrl, selectedContentTypeUid: contentTypeUid });
      await load();
      setMessage({ kind: "success", text: "Publishing target saved." });
    } catch (error) {
      setMessage({
        kind: "danger",
        text: providerMessage(error, "Check the public URL and collection, then try again."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function pair() {
    setBusy(true);
    setMessage(undefined);
    try {
      await client.put("/rankpine/settings", { publicUrl, selectedContentTypeUid: contentTypeUid });
      const response = await client.post("/rankpine/pairing");
      const pairing = response.data as {
        connectUrl?: string;
        siteUrl?: string;
        pairToken?: string;
      };
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
        pairToken: pairing.pairToken,
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
        text: providerMessage(error, "A one-time pairing link could not be created."),
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
        text: providerMessage(error, "The connection could not be revoked."),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <Main>
        <Flex minHeight="60vh" justifyContent="center" alignItems="center">
          <Loader>Loading RankPine settings</Loader>
        </Flex>
      </Main>
    );
  }

  const selected = data.contentTypes.find((contentType) => contentType.uid === contentTypeUid);
  const unsupported = selected?.attributes.filter((field) => !MAPPABLE_FIELD_TYPES.has(field.type));

  return (
    <Main>
      <Box paddingTop={10} paddingBottom={10} paddingLeft={10} paddingRight={10}>
        <Flex direction="column" alignItems="stretch" gap={6} maxWidth="960px" margin="0 auto">
          <Flex justifyContent="space-between" alignItems="flex-start" gap={4}>
            <Box>
              <Typography variant="alpha" tag="h1">
                RankPine
              </Typography>
              <Typography textColor="neutral600">
                Publish RankPine articles into one explicit Strapi 5 collection.
              </Typography>
            </Box>
            <Badge active={data.connection.connected}>
              {data.connection.connected ? "Connected" : "Not connected"}
            </Badge>
          </Flex>

          {message ? (
            <Alert
              closeLabel="Close"
              title={message.kind === "success" ? "Saved" : "Check settings"}
              variant={message.kind}
            >
              {message.text}
            </Alert>
          ) : null}

          <Box
            background="neutral0"
            borderColor="neutral150"
            hasRadius
            shadow="tableShadow"
            padding={6}
          >
            <Flex direction="column" alignItems="stretch" gap={5}>
              <Box>
                <Typography variant="beta" tag="h2">
                  Publishing target
                </Typography>
                <Typography textColor="neutral600">
                  RankPine validates this live schema before every plugin-assisted write.
                </Typography>
              </Box>
              <Field.Root name="publicUrl" required>
                <Field.Label>Public Strapi URL</Field.Label>
                <Field.Input
                  type="url"
                  value={publicUrl}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setPublicUrl(event.target.value)
                  }
                  placeholder="https://cms.example.com"
                />
                <Field.Hint>
                  HTTPS only. Private and loopback targets are rejected by RankPine.
                </Field.Hint>
              </Field.Root>
              <Field.Root name="collection" required>
                <Field.Label>Collection type</Field.Label>
                <SingleSelect
                  value={contentTypeUid}
                  onChange={(value: string) => setContentTypeUid(value)}
                >
                  {data.contentTypes.map((contentType) => (
                    <SingleSelectOption key={contentType.uid} value={contentType.uid}>
                      {contentType.displayName} · {contentType.uid}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
                <Field.Hint>
                  Single types are excluded. RankPine maps only fields you approve.
                </Field.Hint>
              </Field.Root>
              {unsupported && unsupported.length > 0 ? (
                <Alert closeLabel="Close" title="Structured fields detected" variant="default">
                  These field types are discovered but cannot be mapped. Required ones must be made
                  optional or replaced with supported top-level fields:{" "}
                  {unsupported.map((field) => field.name).join(", ")}.
                </Alert>
              ) : null}
              <Flex gap={3} wrap="wrap">
                <Button onClick={save} loading={busy} disabled={!publicUrl || !contentTypeUid}>
                  Save settings
                </Button>
                <Button
                  variant="secondary"
                  startIcon={<LinkIcon />}
                  onClick={pair}
                  loading={busy}
                  disabled={!publicUrl || !contentTypeUid}
                >
                  {data.connection.connected ? "Rotate connection" : "Connect RankPine"}
                </Button>
                {data.connection.connected ? (
                  <Button
                    variant="danger-light"
                    startIcon={<Trash />}
                    onClick={disconnect}
                    loading={busy}
                  >
                    Disconnect
                  </Button>
                ) : null}
              </Flex>
            </Flex>
          </Box>

          <Grid.Root gap={4}>
            <Grid.Item col={6} s={12}>
              <Box
                background="neutral0"
                borderColor="neutral150"
                hasRadius
                padding={5}
                height="100%"
              >
                <Flex direction="column" alignItems="stretch" gap={3}>
                  <Typography variant="delta" tag="h2">
                    Connection
                  </Typography>
                  <Diagnostic
                    label="Signing"
                    value={data.connection.connected ? "Ed25519 verified" : "Not paired"}
                    ok={data.connection.connected}
                  />
                  <Diagnostic label="Key ID" value={data.connection.keyId ?? "—"} />
                  <Diagnostic label="Paired" value={formatTime(data.connection.pairedAt)} />
                </Flex>
              </Box>
            </Grid.Item>
            <Grid.Item col={6} s={12}>
              <Box
                background="neutral0"
                borderColor="neutral150"
                hasRadius
                padding={5}
                height="100%"
              >
                <Flex direction="column" alignItems="stretch" gap={3}>
                  <Typography variant="delta" tag="h2">
                    Diagnostics
                  </Typography>
                  <Diagnostic
                    label="Strapi"
                    value={data.strapiVersion}
                    ok={data.strapiVersion.startsWith("5")}
                  />
                  <Diagnostic
                    label="HTTPS"
                    value={data.diagnostics.https ? "Enabled" : "Needs configuration"}
                    ok={data.diagnostics.https}
                  />
                  <Diagnostic
                    label="Last signed request"
                    value={formatTime(data.diagnostics.lastRequestAt)}
                  />
                  <Diagnostic label="Telemetry" value="None" ok />
                </Flex>
              </Box>
            </Grid.Item>
          </Grid.Root>

          {data.diagnostics.lastError ? (
            <Alert closeLabel="Close" title="Last publishing error" variant="danger">
              {data.diagnostics.lastError}
            </Alert>
          ) : null}

          <Divider />
          <Flex justifyContent="space-between" gap={4} wrap="wrap">
            <Typography textColor="neutral600">
              Plugin {data.pluginVersion} · Strapi 5 only
            </Typography>
            <Link
              href="https://rankpine.com/docs/integrations/strapi"
              isExternal
              endIcon={<ExternalLink />}
            >
              Connection guide
            </Link>
          </Flex>
        </Flex>
      </Box>
    </Main>
  );
}

function Diagnostic({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <Flex justifyContent="space-between" gap={4}>
      <Typography textColor="neutral600">{label}</Typography>
      <Flex gap={2}>
        {ok ? <CheckCircle fill="success600" /> : null}
        <Typography fontWeight="semiBold">{value}</Typography>
      </Flex>
    </Flex>
  );
}

function formatTime(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}

function providerMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
  return response?.data?.error?.message ?? fallback;
}
