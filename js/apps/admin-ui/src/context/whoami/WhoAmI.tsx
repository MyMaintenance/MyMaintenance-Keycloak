import type WhoAmIRepresentation from "@keycloak/keycloak-admin-client/lib/defs/whoAmIRepresentation";
import type { AccessType } from "@keycloak/keycloak-admin-client/lib/defs/whoAmIRepresentation";
import type UserRepresentation from "@keycloak/keycloak-admin-client/lib/defs/userRepresentation";
import {
  createNamedContext,
  useEnvironment,
  useFetch,
  useRequiredContext,
} from "@keycloak/keycloak-ui-shared";
import { PropsWithChildren, useState } from "react";
import { useAdminClient } from "../../admin-client";
import { DEFAULT_LOCALE, i18n } from "../../i18n/i18n";
import { useRealm } from "../realm-context/RealmContext";
import { jwtDecode } from "jwt-decode";
import { getMapping } from "../../components/role-mapping/queries";

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

export const clientAdminUserName = "mym-client-admin";
export const clientAdminGroupName = "Administrators";

export class WhoAmI {
  #me?: WhoAmIRepresentation;
  #decodedAccessToken?: any;
  #userInfo: UserRepresentation | undefined;

  constructor(
    me?: WhoAmIRepresentation,
    decodedAccessToken?: any,
    userInfo?: UserRepresentation,
  ) {
    this.#me = me;
    this.#decodedAccessToken = decodedAccessToken;
    this.#userInfo = userInfo;

    if (this.#me?.locale) {
      i18n.changeLanguage(this.#me.locale, (error) => {
        if (error) {
          console.warn("Error(s) loading locale", this.#me?.locale, error);
        }
      });

      if (RTL_LOCALES.includes(this.#me.locale)) {
        document.documentElement.setAttribute("dir", "rtl");
      }
    }
  }

  public isLoaded(): boolean {
    return !!this.#me;
  }

  public isClientAdmin(): boolean {
    if (!this.#userInfo) {
      return false;
    }

    const clientMappings = this.#userRealmMappings();
    const isClientAdmin =
      ["client-admin-ldap", "client-admin-sso", "client-admin"].some((item) =>
        clientMappings.includes(item),
      ) || (this.getUserGroup() ?? []).includes(clientAdminGroupName);
    return isClientAdmin;
  }

  public isClientAdminWithSsoPermission(): boolean {
    const isClientAdminWithSsoPermission =
      this.isClientAdmin() &&
      (this.#userRealmMappings() ?? []).includes("client-admin-sso");

    return isClientAdminWithSsoPermission;
  }

  public isClientAdminWithLdapPermission(): boolean {
    const isClientAdminWithLdapPermission =
      this.isClientAdmin() &&
      (this.#userRealmMappings() ?? []).includes("client-admin-ldap");

    return isClientAdminWithLdapPermission;
  }

  public isKeycloakAdmin(): boolean {
    if (this.#decodedAccessToken?.preferred_username) {
      return ["keycloak-admin", "admin"].includes(
        this.#decodedAccessToken.preferred_username,
      );
    }
    return ["keycloak-admin", "admin"].includes(this.#userInfo?.username ?? "");
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

  public getDisplayName(): string {
    return this.#me?.displayName ?? "";
  }

  public getLocale(): string {
    return this.#me?.locale ?? DEFAULT_LOCALE;
  }

  public getRealm(): string {
    return this.#me?.realm ?? "";
  }

  public getUserId(): string {
    return this.#me?.userId ?? "";
  }

  public canCreateRealm(): boolean {
    return !!this.#me?.createRealm;
  }

  public getRealmAccess(): Readonly<{
    [key: string]: ReadonlyArray<AccessType>;
  }> {
    return this.#me?.realm_access ?? {};
  }

  public isTemporary(): boolean {
    return this.#me?.temporary ?? false;
  }

  public isEmpty(): boolean {
    return !this.#me;
  }

  // Private methods
  #userRealmMappings(): string[] {
    const clientRoles = this.#userInfo?.clientRoles;
    const clientMappings =
      clientRoles?.["realmMappings"]?.map((i: { name: any }) => i.name) ?? [];

    return clientMappings;
  }
}

type WhoAmIProps = {
  refresh: () => void;
  whoAmI: WhoAmI;
  isLoading: boolean;
};

export const WhoAmIContext = createNamedContext<WhoAmIProps | undefined>(
  "WhoAmIContext",
  undefined,
);

export const useWhoAmI = () => useRequiredContext(WhoAmIContext);

export const WhoAmIContextProvider = ({ children }: PropsWithChildren) => {
  const { adminClient } = useAdminClient();
  const { environment } = useEnvironment();
  const { realm } = useRealm();

  const [whoAmI, setWhoAmI] = useState<WhoAmI>(new WhoAmI());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [key, setKey] = useState(0);

  useFetch(
    async () => {
      setIsLoading(true);
      const me = await adminClient.whoAmI.find({
        realm: environment.realm,
        currentRealm: realm!,
      });

      const accessToken = await adminClient.getAccessToken();
      const decodedAccessToken = accessToken ? jwtDecode(accessToken) : null;
      const userId = me.userId;

      const userInfo = await adminClient.users.findOne({ id: userId });
      if (userInfo) {
        userInfo.clientRoles = await getMapping(adminClient, "users", userId);

        const joinedUserGroups = await adminClient.users.listGroups({
          id: userId,
        });
        userInfo.groups = joinedUserGroups.map((i) => i.name!);
      }

      setWhoAmI(new WhoAmI(me, decodedAccessToken, userInfo));
      setIsLoading(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => {},
    [key, realm],
  );

  return (
    <WhoAmIContext.Provider
      value={{ refresh: () => setKey((prev) => prev + 1), whoAmI, isLoading }}
    >
      {children}
    </WhoAmIContext.Provider>
  );
};
