import type UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";
import type WhoAmIRepresentation from "@keycloak/keycloak-admin-client/lib/defs/whoAmIRepresentation";
import {
  createNamedContext,
  KeycloakSpinner,
  useEnvironment,
  useFetch,
  useRequiredContext,
} from "@keycloak/keycloak-ui-shared";
import { jwtDecode } from "jwt-decode";
import { PropsWithChildren, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdminClient } from "../../admin-client";
import { DEFAULT_LOCALE } from "../../i18n/constants";
import { useRealm } from "../realm-context/RealmContext";

// can be replaced with https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getTextInfo
const RTL_LOCALES = [
  "ar",
  "dv",
  "fa",
  "ha",
  "he",
  "iw",
  "ji",
  "ps",
  "sd",
  "ug",
  "ur",
  "yi",
];

// MyMaintenance customisation: the per-realm client admin account and group.
export const clientAdminUserName = "mym-client-admin";
export const clientAdminGroupName = "Administrators";

const CLIENT_ADMIN_ROLES = [
  "client-admin-ldap",
  "client-admin-sso",
  "client-admin",
];
const KEYCLOAK_ADMIN_USERNAMES = ["keycloak-admin", "admin"];

type DecodedAccessToken = { preferred_username?: string } | null | undefined;

/**
 * MyMaintenance customisation: decides whether the logged-in user is a
 * Keycloak admin or a client admin, from their realm role mappings, groups
 * and username. 26.8.2 keeps `whoAmI` as a plain WhoAmIRepresentation, so
 * this is exposed beside it on the context as `userAccess`.
 */
export class UserAccess {
  #decodedAccessToken: DecodedAccessToken;
  #userInfo: UserRepresentation | undefined;

  constructor(
    decodedAccessToken?: DecodedAccessToken,
    userInfo?: UserRepresentation,
  ) {
    this.#decodedAccessToken = decodedAccessToken;
    this.#userInfo = userInfo;
  }

  public isClientAdmin(): boolean {
    if (!this.#userInfo) {
      return false;
    }

    const realmMappings = this.#userRealmMappings();
    return (
      CLIENT_ADMIN_ROLES.some((item) => realmMappings.includes(item)) ||
      (this.getUserGroup() ?? []).includes(clientAdminGroupName)
    );
  }

  public isClientAdminWithSsoPermission(): boolean {
    return (
      this.isClientAdmin() &&
      this.#userRealmMappings().includes("client-admin-sso")
    );
  }

  public isClientAdminWithLdapPermission(): boolean {
    return (
      this.isClientAdmin() &&
      this.#userRealmMappings().includes("client-admin-ldap")
    );
  }

  public isKeycloakAdmin(): boolean {
    if (this.#decodedAccessToken?.preferred_username) {
      return KEYCLOAK_ADMIN_USERNAMES.includes(
        this.#decodedAccessToken.preferred_username,
      );
    }
    return KEYCLOAK_ADMIN_USERNAMES.includes(this.#userInfo?.username ?? "");
  }

  public getUserGroup(): string[] | undefined {
    return this.#userInfo?.groups;
  }

  public getUserName(): string | null {
    return (
      this.#decodedAccessToken?.preferred_username ??
      this.#userInfo?.username ??
      null
    );
  }

  #userRealmMappings(): string[] {
    const clientRoles = this.#userInfo?.clientRoles;
    return (
      clientRoles?.["realmMappings"]?.map((i: { name: string }) => i.name) ?? []
    );
  }
}

type WhoAmIProps = {
  refresh: () => void;
  whoAmI: WhoAmIRepresentation;
  /** MyMaintenance customisation */
  userAccess: UserAccess;
  /** MyMaintenance customisation: true while whoami and user access load */
  isLoading: boolean;
};

export const WhoAmIContext = createNamedContext<WhoAmIProps | undefined>(
  "WhoAmIContext",
  undefined,
);

export const useWhoAmI = () => useRequiredContext(WhoAmIContext);

type WhoAmIState = {
  whoAmI: WhoAmIRepresentation;
  userAccess: UserAccess;
};

export const WhoAmIContextProvider = ({ children }: PropsWithChildren) => {
  const { i18n } = useTranslation();
  const { adminClient } = useAdminClient();
  const { environment } = useEnvironment();

  const [state, setState] = useState<WhoAmIState>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { realm } = useRealm();
  const [key, setKey] = useState(0);
  const whoAmI = state?.whoAmI;

  useFetch(
    async (): Promise<WhoAmIState> => {
      setIsLoading(true);
      let me: WhoAmIRepresentation;
      try {
        me = await adminClient.whoAmI.find({
          realm: environment.realm,
          currentRealm: realm,
        });
      } catch (error) {
        console.warn(
          "Unable to fetch whoami, falling back to empty defaults.",
          error,
        );

        me = {
          realm: "",
          userId: "",
          displayName: "",
          locale: DEFAULT_LOCALE,
          createRealm: false,
          realm_access: {},
          temporary: false,
        };
      }

      // MyMaintenance customisation: load the user's realm role mappings and
      // groups so the console can tell a client admin from a Keycloak admin.
      const accessToken = await adminClient.getAccessToken();
      const decodedAccessToken = accessToken
        ? jwtDecode<{ preferred_username?: string }>(accessToken)
        : null;

      let userInfo: UserRepresentation | undefined;
      if (me.userId) {
        // The user lives in the realm they logged in to (whoami's realm),
        // which is not always the realm being viewed.
        const userRealm = me.realm || undefined;
        userInfo = await adminClient.users.findOne({
          id: me.userId,
          realm: userRealm,
        });
        if (userInfo) {
          userInfo.clientRoles = await adminClient.users.listRoleMappings({
            id: me.userId,
            realm: userRealm,
          });
          const joinedUserGroups = await adminClient.users.listGroups({
            id: me.userId,
            realm: userRealm,
          });
          userInfo.groups = joinedUserGroups.map((i) => i.name!);
        }
      }

      return {
        whoAmI: me,
        userAccess: new UserAccess(decodedAccessToken, userInfo),
      };
    },
    (result) => {
      setState(result);
      setIsLoading(false);
    },
    [key, environment.realm, realm],
  );

  useFetch(
    async () => {
      if (whoAmI?.locale) {
        await i18n.changeLanguage(whoAmI.locale);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => {}, // noop
    [whoAmI?.locale],
  );

  useEffect(() => {
    if (whoAmI?.locale && RTL_LOCALES.includes(whoAmI.locale)) {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.removeAttribute("dir");
    }
  }, [whoAmI?.locale]);

  if (!state) {
    return <KeycloakSpinner />;
  }

  return (
    <WhoAmIContext.Provider
      value={{
        refresh: () => setKey(key + 1),
        whoAmI: state.whoAmI,
        userAccess: state.userAccess,
        isLoading,
      }}
    >
      {children}
    </WhoAmIContext.Provider>
  );
};
