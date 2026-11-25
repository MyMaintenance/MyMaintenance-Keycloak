import type IdentityProviderMapperRepresentation from "@keycloak/keycloak-admin-client/lib/defs/identityProviderMapperRepresentation";
import IdentityProviderRepresentation, {
  IdentityProviderType,
} from "@keycloak/keycloak-admin-client/lib/defs/identityProviderRepresentation";
import {
  Action,
  KeycloakDataTable,
  KeycloakSpinner,
  ListEmptyState,
  ScrollForm,
  useAlerts,
  useFetch,
} from "@keycloak/keycloak-ui-shared";
import {
  Alert,
  AlertActionLink,
  AlertVariant,
  Button,
  ButtonVariant,
  Divider,
  DropdownItem,
  Form,
  PageSection,
  Tab,
  TabTitleText,
  Tabs,
  Text,
  ToolbarItem,
} from "@patternfly/react-core";
import { saveAs } from "file-saver";
import { useMemo, useState } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAdminClient } from "../../admin-client";
import { useConfirmDialog } from "../../components/confirm-dialog/ConfirmDialog";
import { DynamicComponents } from "../../components/dynamic/DynamicComponents";
import { FixedButtonsGroup } from "../../components/form/FixedButtonGroup";
import { FormAccess } from "../../components/form/FormAccess";
import { PermissionsTab } from "../../components/permission-tab/PermissionTab";
import {
  RoutableTabs,
  useRoutableTab,
} from "../../components/routable-tabs/RoutableTabs";
import { ViewHeader } from "../../components/view-header/ViewHeader";
import { useAccess } from "../../context/access/Access";
import { useRealm } from "../../context/realm-context/RealmContext";
import { useServerInfo } from "../../context/server-info/ServerInfoProvider";
import {
  beerify,
  convertAttributeNameToForm,
  convertFormValuesToObject,
  toUpperCase,
} from "../../util";
import useIsFeatureEnabled, { Feature } from "../../utils/useIsFeatureEnabled";
import { useParams } from "../../utils/useParams";
import { toIdentityProviderAddMapper } from "../routes/AddMapper";
import { toIdentityProviderEditMapper } from "../routes/EditMapper";
import {
  IdentityProviderParams,
  IdentityProviderTab,
  toIdentityProvider,
} from "../routes/IdentityProvider";
import { toIdentityProviders } from "../routes/IdentityProviders";
import { AdvancedSettings } from "./AdvancedSettings";
import { DescriptorSettings } from "./DescriptorSettings";
import { DiscoverySettings } from "./DiscoverySettings";
import { ExtendedNonDiscoverySettings } from "./ExtendedNonDiscoverySettings";
import { ExtendedOAuth2Settings } from "./ExtendedOAuth2Settings";
import { GeneralSettings } from "./GeneralSettings";
import { OIDCAuthentication } from "./OIDCAuthentication";
import { OIDCGeneralSettings } from "./OIDCGeneralSettings";
import { ReqAuthnConstraints } from "./ReqAuthnConstraintsSettings";
import { SamlGeneralSettings } from "./SamlGeneralSettings";
import { SpiffeSettings } from "./SpiffeSettings";
import { AdminEvents } from "../../events/AdminEvents";
import { UserProfileClaimsSettings } from "./OAuth2UserProfileClaimsSettings";
import { KubernetesSettings } from "./KubernetesSettings";
import { JWTAuthorizationGrantAssertionSettings } from "./JWTAuthorizationGrantAssertionSettings";
import JWTAuthorizationGrantSettings from "./JWTAuthorizationGrantSettings";
import { DefaultSwitchControl } from "../../components/SwitchControl";
import DefaultTrustSettings from "./DefaultTrustSettings";
import { IdpDomainsTab } from "./IdpDomainsTab";
import { IdpOrganizationsTab } from "./IdpOrganizationsTab";
import Oid4VpSettings from "./Oid4VpSettings";
import { useWhoAmI } from "../../context/whoami/WhoAmI";

type HeaderProps = {
  onChange: (value: boolean) => void;
  value: boolean;
  save: () => void;
  toggleDeleteDialog: () => void;
};

type IdPWithMapperAttributes = IdentityProviderMapperRepresentation & {
  name: string;
  category?: string;
  helpText?: string;
  type: string;
  mapperId: string;
};

const certificateFileName = "MyRequests.cer";

const toPem = (base64Der: string) => {
  const cleaned = base64Der.replace(/\s+/g, "");
  const lines = cleaned.match(/.{1,64}/g) ?? [cleaned];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
};

const Header = ({ onChange, value, save, toggleDeleteDialog }: HeaderProps) => {
  const { adminClient } = useAdminClient();

  const { t } = useTranslation();
  const { alias: displayName } = useParams<{ alias: string }>();
  const [provider, setProvider] = useState<IdentityProviderRepresentation>();
  const { addAlert, addError } = useAlerts();
  const { setValue, formState, control } = useFormContext();
  const { realm, realmRepresentation } = useRealm();

  // Watched here so the "Download Certificate" header button can be shown
  // for OIDC IdPs that authenticate with the realm — private_key_jwt
  // (cert-based, the steady-state Entra ID flow) plus the client_secret_*
  // variants so customers can grab the cert before switching modes.  The
  // accompanying "Confirm Certificate Rotation" button stays exclusive to
  // private_key_jwt since rotation only applies when the cert is actually
  // signing.
  const clientAuthMethod = useWatch({
    control,
    name: "config.clientAuthMethod",
  });

  const validateSignature = useWatch({
    control,
    name: "config.validateSignature",
  });

  const useMetadataDescriptorUrl = useWatch({
    control,
    name: "config.useMetadataDescriptorUrl",
  });

  const metadataDescriptorUrl = useWatch({
    control,
    name: "config.metadataDescriptorUrl",
  });

  useFetch(
    () => adminClient.identityProviders.findOne({ alias: displayName }),
    (fetchedProvider) => {
      if (!fetchedProvider) {
        throw new Error(t("notFound"));
      }
      setProvider(fetchedProvider);
    },
    [],
  );

  const [toggleDisableDialog, DisableConfirm] = useConfirmDialog({
    titleKey: "disableProvider",
    messageKey: t("disableConfirmIdentityProvider", { provider: displayName }),
    continueButtonLabel: "disable",
    onConfirm: () => {
      onChange(!value);
      save();
    },
  });

  const importSamlKeys = async (
    providerId: string,
    metadataDescriptorUrl: string,
  ) => {
    try {
      const result = await adminClient.identityProviders.importFromUrl({
        providerId: providerId,
        fromUrl: metadataDescriptorUrl,
      });
      if (result.signingCertificate) {
        setValue(`config.signingCertificate`, result.signingCertificate, {
          shouldDirty: true,
        });
        addAlert(t("importKeysSuccess"), AlertVariant.success);
      } else {
        addError("importKeysError", t("importKeysErrorNoSigningCertificate"));
      }
    } catch (error) {
      addError("importKeysError", error);
    }
  };

  // validTo is a stringified ms-since-epoch in Keycloak's keys API, but parse
  // defensively in case that changes.
  const validToMs = (k: { validTo?: string | number }): number => {
    if (k.validTo === undefined || k.validTo === "") {
      return -Infinity;
    }
    const n = Number(k.validTo);
    if (!Number.isNaN(n) && n > 0) return n;
    const d = new Date(k.validTo as string).getTime();
    return Number.isNaN(d) ? -Infinity : d;
  };

  // Holds the realm's RS256 key entries returned by /admin/realms/{realm}/keys
  // so we can show the pending-rotation banner and pick the right cert to
  // download without re-fetching on every interaction.
  const [rs256Keys, setRs256Keys] = useState<
    Array<{
      kid?: string;
      status?: string;
      certificate?: string;
      validTo?: string | number;
      providerPriority?: number;
    }>
  >([]);
  const [keysRefreshTrigger, setKeysRefreshTrigger] = useState(0);

  useFetch(
    () => adminClient.realms.getKeys({ realm }),
    (keysMetaData) => {
      const candidates = ((keysMetaData.keys ?? []) as Array<any>).filter(
        (k) => k.algorithm === "RS256" && k.certificate,
      );
      setRs256Keys(candidates);
    },
    [realm, keysRefreshTrigger],
  );

  const activeRs256Key = useMemo(
    () => rs256Keys.find((k) => k.status === "ACTIVE"),
    [rs256Keys],
  );

  // Newest PASSIVE strictly newer than the ACTIVE = pending rotation.  Older
  // PASSIVE keys (demoted-on-confirm leftovers kept around for JWKS
  // verification) are ignored here so they don't masquerade as a rotation.
  const pendingRotationKey = useMemo(() => {
    if (!activeRs256Key) return undefined;
    const activeValidTo = validToMs(activeRs256Key);
    const passiveNewerThanActive = rs256Keys
      .filter((k) => k.status === "PASSIVE" && validToMs(k) > activeValidTo)
      .sort((a, b) => {
        const diff = validToMs(b) - validToMs(a);
        if (diff !== 0) return diff;
        return (b.providerPriority ?? 0) - (a.providerPriority ?? 0);
      });
    return passiveNewerThanActive[0];
  }, [rs256Keys, activeRs256Key]);

  const hasPendingRotation = !!pendingRotationKey;

  // Downloads the realm's RS256 X.509 certificate as PEM for the customer to
  // upload to their Microsoft Entra ID App Registration.
  //  - No pending rotation (steady state) → download the ACTIVE cert, which is
  //    the one Keycloak uses to sign JWT client assertions right now.
  //  - Pending rotation → download the newest PASSIVE cert (the one waiting to
  //    be promoted).  The customer uploads this to Azure, then clicks Confirm
  //    to promote it to ACTIVE so the matching private key starts signing.
  // Older PASSIVE keys (demoted-on-confirm leftovers) are never picked.
  const downloadRealmCertificate = async () => {
    try {
      const chosen = pendingRotationKey ?? activeRs256Key;
      if (!chosen?.certificate) {
        addError("downloadCertificateError", new Error(t("noActiveRs256Cert")));
        return;
      }
      saveAs(
        new Blob([toPem(chosen.certificate)], {
          type: "application/x-x509-ca-cert",
        }),
        certificateFileName,
      );
      addAlert(t("downloadCertificateSuccess"));
    } catch (error) {
      addError("downloadCertificateError", error);
    }
  };

  // Client-secret variant: rotation isn't part of the flow when the IdP
  // doesn't sign with the cert, so always hand over the ACTIVE cert and
  // ignore any pending PASSIVE key in the realm.
  const downloadActiveRealmCertificate = async () => {
    try {
      if (!activeRs256Key?.certificate) {
        addError("downloadCertificateError", new Error(t("noActiveRs256Cert")));
        return;
      }
      saveAs(
        new Blob([toPem(activeRs256Key.certificate)], {
          type: "application/x-x509-ca-cert",
        }),
        certificateFileName,
      );
      addAlert(t("downloadCertificateSuccess"));
    } catch (error) {
      addError("downloadCertificateError", error);
    }
  };

  const certRotationApiUrl: string | undefined =
    realmRepresentation.attributes?.["mym_cert_rotation_api_url"];

  const callCertRotationApi = async (action: "confirm" | "cancel") => {
    if (!certRotationApiUrl) {
      throw new Error(t("certRotationApiUnavailable"));
    }
    const response = await fetch(`${certRotationApiUrl}/cert-rotation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ realmId: realm, action }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(text || response.statusText);
    }
  };

  const confirmCertRotation = async () => {
    try {
      await callCertRotationApi("confirm");
      addAlert(t("confirmCertificateRotationSuccess"), AlertVariant.success);
      setKeysRefreshTrigger((n) => n + 1);
    } catch (error) {
      addError("confirmCertificateRotationError", error);
    }
  };

  const cancelCertRotation = async () => {
    try {
      await callCertRotationApi("cancel");
      addAlert(t("cancelCertificateRotationSuccess"), AlertVariant.success);
      setKeysRefreshTrigger((n) => n + 1);
    } catch (error) {
      addError("cancelCertificateRotationError", error);
    }
  };

  const formatCertValidTo = (k?: { validTo?: string | number }) => {
    if (!k) return "";
    const ms = validToMs(k);
    if (!Number.isFinite(ms)) return "";
    return new Date(ms).toLocaleString();
  };

  const reloadSamlKeys = async (alias: string) => {
    try {
      const result = await adminClient.identityProviders.reloadKeys({
        alias: alias,
      });
      if (result) {
        addAlert(t("reloadKeysSuccess"), AlertVariant.success);
      } else {
        addAlert(t("reloadKeysSuccessButFalse"), AlertVariant.warning);
      }
    } catch (error) {
      addError("reloadKeysError", error);
    }
  };

  const { userAccess, isLoading } = useWhoAmI();

  if (isLoading) {
    return null;
  }

  const isKeycloakAdmin = userAccess.isKeycloakAdmin();
  const isClientAdminWithSsoPermission =
    userAccess.isClientAdminWithSsoPermission();

  // if (!isKeycloakAdmin && !isClientAdminWithSsoPermission) {
  //   return <h3 style={{ padding: "16px" }}>Access Denied</h3>;
  // }

  return (
    <>
      <DisableConfirm />
      {clientAuthMethod === "private_key_jwt" && hasPendingRotation && (
        <Alert
          variant="warning"
          isInline
          title={t("pendingCertRotationTitle")}
          data-testid="pending-cert-rotation-banner"
          actionLinks={
            certRotationApiUrl ? (
              <AlertActionLink onClick={cancelCertRotation}>
                {t("cancelCertificateRotation")}
              </AlertActionLink>
            ) : undefined
          }
        >
          {t("pendingCertRotationDescription", {
            pendingExpiry: formatCertValidTo(pendingRotationKey),
            activeExpiry: formatCertValidTo(activeRs256Key),
          })}
        </Alert>
      )}
      <ViewHeader
        titleKey={toUpperCase(
          provider
            ? provider.displayName
              ? provider.displayName
              : provider.providerId!
            : "",
        )}
        {...(isClientAdminWithSsoPermission
          ? {
              setupGuideUrl:
                clientAuthMethod === "private_key_jwt"
                  ? "https://docs.google.com/document/d/1SHa0Y-ASvLdzn5aJv8IznZOVTaTKhFA5RiflkfWDo0k/edit?usp=sharing"
                  : "https://docs.google.com/document/d/1C1FuhyE9YBuI-kWvWwSrFjVfTXNO8f-CYXu-BRW5hwk/edit?usp=sharing",
            }
          : {})}
        divider={false}
        {...(isKeycloakAdmin && {
          dropdownItems: [
            ...(provider?.providerId?.includes("saml") &&
            validateSignature === "true" &&
            useMetadataDescriptorUrl === "true" &&
            metadataDescriptorUrl &&
            !formState.isDirty &&
            value
              ? [
                  <DropdownItem
                    key="reloadKeys"
                    onClick={() => reloadSamlKeys(provider.alias!)}
                  >
                    {t("reloadKeys")}
                  </DropdownItem>,
                ]
              : provider?.providerId?.includes("saml") &&
                  validateSignature === "true" &&
                  useMetadataDescriptorUrl !== "true" &&
                  metadataDescriptorUrl &&
                  !formState.isDirty
                ? [
                    <DropdownItem
                      key="importKeys"
                      onClick={() =>
                        importSamlKeys(
                          provider.providerId!,
                          metadataDescriptorUrl,
                        )
                      }
                    >
                      {t("importKeys")}
                    </DropdownItem>,
                  ]
                : []),
            <Divider key="separator" />,
            <DropdownItem key="delete" onClick={() => toggleDeleteDialog()}>
              {t("delete")}
            </DropdownItem>,
          ],
        })}
        isEnabled={value}
        onToggle={(value) => {
          if (!value) {
            toggleDisableDialog();
          } else {
            onChange(value);
            save();
          }
        }}
        preToggleButton={
          clientAuthMethod === "private_key_jwt" ? (
            <>
              <Button
                variant="secondary"
                onClick={downloadRealmCertificate}
                isDisabled={!value}
                data-testid="download-realm-certificate"
              >
                {hasPendingRotation
                  ? t("downloadPendingRotationCertificate")
                  : t("downloadCertificate")}
              </Button>
              <Button
                variant="primary"
                onClick={confirmCertRotation}
                isDisabled={!value}
                data-testid="confirm-cert-rotation"
                style={{ marginLeft: "8px" }}
              >
                {t("confirmCertificateRotation")}
              </Button>
            </>
          ) : clientAuthMethod === "client_secret_basic" ||
            clientAuthMethod === "client_secret_post" ||
            clientAuthMethod === "client_secret_jwt" ? (
            <Button
              variant="secondary"
              onClick={downloadActiveRealmCertificate}
              isDisabled={!value}
              data-testid="download-realm-certificate"
            >
              {t("downloadCertificate")}
            </Button>
          ) : undefined
        }
      />
    </>
  );
};

type MapperLinkProps = IdPWithMapperAttributes & {
  provider?: IdentityProviderRepresentation;
};

const MapperLink = ({ name, mapperId, provider }: MapperLinkProps) => {
  const { realm } = useRealm();
  const { alias } = useParams<IdentityProviderParams>();

  return (
    <Link
      to={toIdentityProviderEditMapper({
        realm,
        alias,
        providerId: provider?.providerId!,
        id: mapperId,
      })}
    >
      {name}
    </Link>
  );
};

export default function DetailSettings() {
  const { adminClient } = useAdminClient();

  const { t } = useTranslation();
  const { alias, providerId } = useParams<IdentityProviderParams>();
  const isFeatureEnabled = useIsFeatureEnabled();
  const form = useForm<IdentityProviderRepresentation>();
  const {
    handleSubmit,
    getValues,
    reset,
    control,
    formState: { isDirty },
  } = form;
  const [provider, setProvider] = useState<IdentityProviderRepresentation>();

  const toFormValues = (
    p: IdentityProviderRepresentation,
  ): IdentityProviderRepresentation =>
    p.config
      ? {
          ...p,
          config: Object.fromEntries(
            Object.entries(p.config).map(([key, value]) => [
              beerify(key),
              value,
            ]),
          ),
        }
      : p;

  const [selectedMapper, setSelectedMapper] =
    useState<IdPWithMapperAttributes>();
  const serverInfo = useServerInfo();
  const providerInfo = useMemo(() => {
    const namespaces = [
      "org.keycloak.broker.social.SocialIdentityProvider",
      "org.keycloak.broker.provider.IdentityProvider",
    ];

    for (const namespace of namespaces) {
      const social = serverInfo.componentTypes?.[namespace]?.find(
        ({ id }) => id === providerId,
      );

      if (social) {
        return social;
      }
    }
  }, [serverInfo, providerId]);

  const { addAlert, addError } = useAlerts();
  const navigate = useNavigate();
  const { realm, realmRepresentation } = useRealm();
  const [key, setKey] = useState(0);
  const refresh = () => setKey(key + 1);
  const [orgSubTab, setOrgSubTab] = useState("org-list");
  const { hasAccess } = useAccess();

  useFetch(
    () => adminClient.identityProviders.findOne({ alias }),
    (fetchedProvider) => {
      if (!fetchedProvider) {
        throw new Error(t("notFound"));
      }

      reset(toFormValues(fetchedProvider));
      setProvider(fetchedProvider);

      if (fetchedProvider.config!.authnContextClassRefs) {
        form.setValue(
          "config.authnContextClassRefs",
          JSON.parse(fetchedProvider.config?.authnContextClassRefs),
        );
      }

      if (fetchedProvider.config!.authnContextDeclRefs) {
        form.setValue(
          "config.authnContextDeclRefs",
          JSON.parse(fetchedProvider.config?.authnContextDeclRefs),
        );
      }
    },
    [key],
  );

  const toTab = (tab: IdentityProviderTab) =>
    toIdentityProvider({
      realm,
      alias,
      providerId,
      tab,
    });

  const useTab = (tab: IdentityProviderTab) => useRoutableTab(toTab(tab));

  const settingsTab = useTab("settings");
  const mappersTab = useTab("mappers");
  const organizationsTab = useTab("organizations");
  const permissionsTab = useTab("permissions");
  const eventsTab = useTab("events");

  const save = async (savedProvider?: IdentityProviderRepresentation) => {
    const p = convertFormValuesToObject<IdentityProviderRepresentation>(
      savedProvider || getValues(),
    );
    const origAuthnContextClassRefs = p.config?.authnContextClassRefs;
    if (p.config?.authnContextClassRefs)
      p.config.authnContextClassRefs = JSON.stringify(
        p.config.authnContextClassRefs,
      );
    const origAuthnContextDeclRefs = p.config?.authnContextDeclRefs;
    if (p.config?.authnContextDeclRefs)
      p.config.authnContextDeclRefs = JSON.stringify(
        p.config.authnContextDeclRefs,
      );

    try {
      await adminClient.identityProviders.update(
        { alias: provider?.alias || alias },
        {
          ...p,
          config: { ...provider?.config, ...p.config },
          alias: provider?.alias || alias,
          providerId,
        },
      );
      if (origAuthnContextClassRefs) {
        p.config!.authnContextClassRefs = origAuthnContextClassRefs;
      }
      if (origAuthnContextDeclRefs) {
        p.config!.authnContextDeclRefs = origAuthnContextDeclRefs;
      }
      const updatedProvider = await adminClient.identityProviders.findOne({
        alias: provider?.alias || alias,
      });

      if (updatedProvider) {
        setProvider(updatedProvider);
        reset(toFormValues(updatedProvider));

        if (updatedProvider.config?.authnContextClassRefs) {
          form.setValue(
            "config.authnContextClassRefs",
            JSON.parse(updatedProvider.config.authnContextClassRefs),
          );
        }

        if (updatedProvider.config?.authnContextDeclRefs) {
          form.setValue(
            "config.authnContextDeclRefs",
            JSON.parse(updatedProvider.config.authnContextDeclRefs),
          );
        }
      } else {
        reset(toFormValues(p));
      }
      addAlert(t("updateSuccessIdentityProvider"), AlertVariant.success);
    } catch (error) {
      addError("updateErrorIdentityProvider", error);
    }
  };

  const [toggleDeleteDialog, DeleteConfirm] = useConfirmDialog({
    titleKey: "deleteProvider",
    messageKey: t("deleteConfirmIdentityProvider", { provider: alias }),
    continueButtonLabel: "delete",
    continueButtonVariant: ButtonVariant.danger,
    onConfirm: async () => {
      try {
        await adminClient.identityProviders.del({ alias: alias });
        addAlert(t("deletedSuccessIdentityProvider"), AlertVariant.success);
        void navigate(toIdentityProviders({ realm }));
      } catch (error) {
        addError("deleteErrorIdentityProvider", error);
      }
    },
  });

  const [toggleDeleteMapperDialog, DeleteMapperConfirm] = useConfirmDialog({
    titleKey: "deleteProviderMapper",
    messageKey: t("deleteMapperConfirm", {
      mapper: selectedMapper?.name,
    }),
    continueButtonLabel: "delete",
    continueButtonVariant: ButtonVariant.danger,
    onConfirm: async () => {
      try {
        await adminClient.identityProviders.delMapper({
          alias: alias,
          id: selectedMapper?.mapperId!,
        });
        addAlert(t("deleteMapperSuccess"), AlertVariant.success);
        refresh();
        void navigate(
          toIdentityProvider({ providerId, alias, tab: "mappers", realm }),
        );
      } catch (error) {
        addError("deleteErrorIdentityProvider", error);
      }
    },
  });
  const jwtAuthorizationGrantEnabled = useWatch({
    control,
    name: "config.jwtAuthorizationGrantEnabled",
  });

  const { userAccess, isLoading } = useWhoAmI();

  if (isLoading) {
    return null;
  }

  const isClientAdminWithSsoPermission =
    userAccess.isClientAdminWithSsoPermission();

  if (!provider) {
    return <KeycloakSpinner />;
  }

  const isOIDC = provider.providerId!.includes("oidc");
  const isSAML = provider.providerId!.includes("saml");
  const isOAuth2 = provider.providerId!.includes("oauth2");
  const isSPIFFE = provider.providerId!.includes("spiffe");
  const isKubernetes = provider.providerId!.includes("kubernetes");
  const isJWTAuthorizationGrant = provider.providerId!.includes(
    "jwt-authorization-grant",
  );
  const isDefaultTrust = provider.providerId === "default-trust";
  const isOid4vp = provider.providerId === "oid4vp";
  const isSocial = !isOIDC && !isSAML && !isOAuth2;
  const isJWTAuthorizationGrantSupported =
    (isOAuth2 || isOIDC) &&
    !!provider.types?.includes(IdentityProviderType.JWT_AUTHORIZATION_GRANT) &&
    isFeatureEnabled(Feature.JWTAuthorizationGrant);

  const loader = async () => {
    const [loaderMappers, loaderMapperTypes] = await Promise.all([
      adminClient.identityProviders.findMappers({ alias }),
      adminClient.identityProviders.findMapperTypes({ alias }),
    ]);

    const components = loaderMappers.map((loaderMapper) => {
      const mapperType = Object.values(loaderMapperTypes).find(
        (loaderMapperType) =>
          loaderMapper.identityProviderMapper! === loaderMapperType.id!,
      );

      const result: IdPWithMapperAttributes = {
        ...mapperType,
        name: loaderMapper.name!,
        type: mapperType?.name!,
        mapperId: loaderMapper.id!,
      };

      return result;
    });

    return components;
  };

  const sections = [
    {
      title: t("generalSettings"),
      isHidden:
        isSPIFFE ||
        isKubernetes ||
        isJWTAuthorizationGrant ||
        isDefaultTrust ||
        isOid4vp,
      panel: (
        <FormAccess
          role="manage-identity-providers"
          isHorizontal
          onSubmit={handleSubmit(save)}
        >
          {isSocial && <GeneralSettings create={false} id={providerId} />}
          {(isOIDC || isOAuth2) && <OIDCGeneralSettings />}
          {isSAML && <SamlGeneralSettings isAliasReadonly />}
          {providerInfo && (
            <DynamicComponents stringify properties={providerInfo.properties} />
          )}
        </FormAccess>
      ),
    },
    {
      title: t("generalSettings"),
      isHidden: !isOid4vp,
      panel: (
        <FormAccess
          role="manage-identity-providers"
          isHorizontal
          onSubmit={handleSubmit(save)}
        >
          <Oid4VpSettings />
        </FormAccess>
      ),
    },
    {
      title: t("oidcSettings"),
      isHidden: !isOIDC,
      panel: (
        <>
          <DiscoverySettings readOnly={false} isOIDC={isOIDC} />
          <Form isHorizontal className="pf-v5-u-py-lg">
            <Divider />
            <OIDCAuthentication create={false} />
          </Form>
          <ExtendedNonDiscoverySettings />
        </>
      ),
    },
    {
      title: t("oAuthSettings"),
      isHidden: !isOAuth2,
      panel: (
        <>
          <DiscoverySettings readOnly={false} isOIDC={isOIDC} />
          <Form isHorizontal className="pf-v5-u-py-lg">
            <Divider />
            <OIDCAuthentication create={false} />
          </Form>
          <UserProfileClaimsSettings />
          <ExtendedOAuth2Settings />
        </>
      ),
    },
    {
      title: t("authorizationGrantSettings"),
      isHidden: !isJWTAuthorizationGrantSupported,
      panel: (
        <>
          <Text className="pf-v5-u-pb-lg">
            {t("authorizationGrantSettingsHelp")}
          </Text>
          <Form
            isHorizontal
            className="pf-v5-u-py-lg"
            onSubmit={handleSubmit(save)}
          >
            <DefaultSwitchControl
              name="config.jwtAuthorizationGrantEnabled"
              label={t("jwtAuthorizationGrantIdpEnabled")}
              labelIcon={t("jwtAuthorizationGrantIdpEnabledHelp")}
              stringify
            />

            {jwtAuthorizationGrantEnabled === "true" && (
              <JWTAuthorizationGrantAssertionSettings />
            )}
          </Form>
        </>
      ),
    },
    {
      title: t("generalSettings"),
      isHidden: !isSPIFFE,
      panel: (
        <Form
          isHorizontal
          className="pf-v5-u-py-lg"
          onSubmit={handleSubmit(save)}
        >
          <SpiffeSettings />
          <FixedButtonsGroup
            name="idp-details"
            isSubmit
            reset={reset}
            isDisabled={!isDirty}
          />
        </Form>
      ),
    },
    {
      title: t("generalSettings"),
      isHidden: !isJWTAuthorizationGrant,
      panel: (
        <Form
          isHorizontal
          className="pf-v5-u-py-lg"
          onSubmit={handleSubmit(save)}
        >
          <JWTAuthorizationGrantSettings />
          <FixedButtonsGroup
            name="idp-details"
            isSubmit
            reset={reset}
            isDisabled={!isDirty}
          />
        </Form>
      ),
    },
    {
      title: t("generalSettings"),
      isHidden: !isKubernetes,
      panel: (
        <Form
          isHorizontal
          className="pf-v5-u-py-lg"
          onSubmit={handleSubmit(save)}
        >
          <KubernetesSettings />
          <FixedButtonsGroup
            name="idp-details"
            isSubmit
            reset={reset}
            isDisabled={!isDirty}
          />
        </Form>
      ),
    },
    {
      title: t("generalSettings"),
      isHidden: !isDefaultTrust,
      panel: (
        <Form
          isHorizontal
          className="pf-v5-u-py-lg"
          onSubmit={handleSubmit(save)}
        >
          <DefaultTrustSettings />
          <FixedButtonsGroup
            name="idp-details"
            isSubmit
            reset={reset}
            isDisabled={!isDirty}
          />
        </Form>
      ),
    },
    {
      title: t("samlSettings"),
      isHidden: !isSAML,
      panel: <DescriptorSettings readOnly={false} />,
    },
    {
      title: t("reqAuthnConstraints"),
      isHidden: !isSAML,
      panel: (
        <FormAccess
          role="manage-identity-providers"
          isHorizontal
          onSubmit={handleSubmit(save)}
        >
          <ReqAuthnConstraints />
        </FormAccess>
      ),
    },
    {
      title: t("advancedSettings"),
      isHidden:
        isSPIFFE || isKubernetes || isJWTAuthorizationGrant || isDefaultTrust,
      panel: (
        <FormAccess
          role="manage-identity-providers"
          isHorizontal
          onSubmit={handleSubmit(save)}
        >
          <AdvancedSettings
            isOIDC={isOIDC!}
            isSAML={isSAML!}
            isOAuth2={isOAuth2!}
          />

          <FixedButtonsGroup
            name="idp-details"
            isSubmit
            reset={reset}
            isDisabled={!isDirty}
          />
        </FormAccess>
      ),
    },
    {
      title: t("organizationSettings"),
      isHidden: (provider.organizationLinks?.length ?? 0) === 0,
      panel: (
        <FormAccess
          role="manage-identity-providers"
          isHorizontal
          onSubmit={handleSubmit(save)}
        >
          <DefaultSwitchControl
            name={convertAttributeNameToForm(
              "config.kc.org.broker.login.hide-when-org-unknown",
            )}
            label={t("hideOnLoginWhenOrgNotResolved")}
            labelIcon={t("hideOnLoginWhenOrgNotResolvedHelp")}
            stringify
          />
          <DefaultSwitchControl
            name={convertAttributeNameToForm(
              "config.kc.org.broker.login.show-when-linked-elsewhere",
            )}
            label={t("showOnLoginForUnlinkedMembers")}
            labelIcon={t("showOnLoginForUnlinkedMembersHelp")}
            stringify
          />
          <FixedButtonsGroup
            name="idp-org-settings"
            isSubmit
            reset={reset}
            isDisabled={!isDirty}
          />
        </FormAccess>
      ),
    },
  ];

  return (
    <FormProvider {...form}>
      <DeleteConfirm />
      <DeleteMapperConfirm />
      <Controller
        name="enabled"
        control={form.control}
        defaultValue={true}
        render={({ field }) => (
          <Header
            value={field.value || false}
            onChange={field.onChange}
            save={save}
            toggleDeleteDialog={toggleDeleteDialog}
          />
        )}
      />

      <PageSection variant="light" className="pf-v5-u-p-0">
        <RoutableTabs isBox defaultLocation={toTab("settings")}>
          <Tab
            id="settings"
            title={<TabTitleText>{t("settings")}</TabTitleText>}
            {...settingsTab}
          >
            <ScrollForm
              label={t("jumpToSection")}
              className="pf-v5-u-px-lg"
              sections={sections}
            />
          </Tab>
          <Tab
            id="mappers"
            isHidden={
              isSPIFFE ||
              isKubernetes ||
              isJWTAuthorizationGrant ||
              isDefaultTrust ||
              // MyMaintenance customisation: hidden from a client admin
              isClientAdminWithSsoPermission
            }
            data-testid="mappers-tab"
            title={<TabTitleText>{t("mappers")}</TabTitleText>}
            {...mappersTab}
          >
            <KeycloakDataTable
              emptyState={
                <ListEmptyState
                  message={t("noMappers")}
                  instructions={t("noMappersInstructions")}
                  primaryActionText={t("addMapper")}
                  onPrimaryAction={() =>
                    void navigate(
                      toIdentityProviderAddMapper({
                        realm,
                        alias: alias!,
                        providerId: provider.providerId!,
                        tab: "mappers",
                      }),
                    )
                  }
                />
              }
              loader={loader}
              key={key}
              ariaLabelKey="mappersList"
              searchPlaceholderKey="searchForMapper"
              toolbarItem={
                <ToolbarItem>
                  <Button
                    id="add-mapper-button"
                    component={(props) => (
                      <Link
                        {...props}
                        to={toIdentityProviderAddMapper({
                          realm,
                          alias: alias!,
                          providerId: provider.providerId!,
                          tab: "mappers",
                        })}
                      />
                    )}
                    data-testid="addMapper"
                  >
                    {t("addMapper")}
                  </Button>
                </ToolbarItem>
              }
              columns={[
                {
                  name: "name",
                  displayKey: "name",
                  cellRenderer: (row) => (
                    <MapperLink {...row} provider={provider} />
                  ),
                },
                {
                  name: "category",
                  displayKey: "category",
                },
                {
                  name: "type",
                  displayKey: "type",
                },
              ]}
              actions={[
                {
                  title: t("delete"),
                  onRowClick: (mapper) => {
                    setSelectedMapper(mapper);
                    toggleDeleteMapperDialog();
                  },
                } as Action<IdPWithMapperAttributes>,
              ]}
            />
          </Tab>
          {!isClientAdminWithSsoPermission &&
            (provider.organizationLinks?.length ?? 0) > 0 && (
              <Tab
                id="organizations"
                data-testid="organizationsTab"
                title={<TabTitleText>{t("organizations")}</TabTitleText>}
                {...organizationsTab}
              >
                <Tabs
                  activeKey={orgSubTab}
                  onSelect={(_, key) => setOrgSubTab(key as string)}
                  mountOnEnter
                >
                  <Tab
                    id="org-list"
                    eventKey="org-list"
                    title={<TabTitleText>{t("organizations")}</TabTitleText>}
                  >
                    <IdpOrganizationsTab
                      alias={alias}
                      onLinksChange={refresh}
                    />
                  </Tab>
                  <Tab
                    id="org-domains"
                    eventKey="org-domains"
                    title={<TabTitleText>{t("domains")}</TabTitleText>}
                  >
                    <IdpDomainsTab alias={alias} />
                  </Tab>
                </Tabs>
              </Tab>
            )}
          {!isClientAdminWithSsoPermission &&
            isFeatureEnabled(Feature.AdminFineGrainedAuthz) && (
              <Tab
                id="permissions"
                data-testid="permissionsTab"
                title={<TabTitleText>{t("permissions")}</TabTitleText>}
                {...permissionsTab}
              >
                <PermissionsTab id={alias} type="identityProviders" />
              </Tab>
            )}
          {realmRepresentation.adminEventsEnabled &&
            hasAccess("view-events") && (
              <Tab
                data-testid="admin-events-tab"
                title={<TabTitleText>{t("adminEvents")}</TabTitleText>}
                {...eventsTab}
              >
                <AdminEvents
                  resourcePath={`identity-provider/instances/${alias}`}
                />
              </Tab>
            )}
        </RoutableTabs>
      </PageSection>
    </FormProvider>
  );
}
