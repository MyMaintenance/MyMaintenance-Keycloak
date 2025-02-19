import {
  Divider,
  Nav,
  NavGroup,
  NavItem,
  NavList,
  PageSidebar,
  PageSidebarBody,
} from "@patternfly/react-core";
import { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useMatch, useNavigate } from "react-router-dom";
import { RealmSelector } from "./components/realm-selector/RealmSelector";
import { useAccess } from "./context/access/Access";
import { useRealm } from "./context/realm-context/RealmContext";
import { useServerInfo } from "./context/server-info/ServerInfoProvider";
import { toPage } from "./page/routes";
import { AddRealmRoute } from "./realm/routes/AddRealm";
import { routes } from "./routes";
import useIsFeatureEnabled, { Feature } from "./utils/useIsFeatureEnabled";
import { useWhoAmI } from "./context/whoami/WhoAmI";

import "./page-nav.css";

type LeftNavProps = {
  title: string;
  path: string;
  id?: string;
  isVisible?: boolean;
};

const LeftNav = ({ title, path, id, isVisible = true }: LeftNavProps) => {
  const { t } = useTranslation();
  const { hasAccess } = useAccess();
  const { realm } = useRealm();
  const encodedRealm = encodeURIComponent(realm);
  const route = routes.find(
    (route) =>
      route.path.replace(/\/:.+?(\?|(?:(?!\/).)*|$)/g, "") === (id || path),
  );

  const accessAllowed =
    route &&
    (route.handle.access instanceof Array
      ? hasAccess(...route.handle.access)
      : hasAccess(route.handle.access));

  if (!accessAllowed) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  return (
    <li>
      <NavLink
        id={"nav-item" + path.replace("/", "-")}
        to={`/${encodedRealm}${path}`}
        className={({ isActive }) =>
          `pf-v5-c-nav__link${isActive ? " pf-m-current" : ""}`
        }
      >
        {t(title)}
      </NavLink>
    </li>
  );
};

export const PageNav = () => {
  const { t } = useTranslation();
  const { hasSomeAccess } = useAccess();
  const { componentTypes } = useServerInfo();
  const isFeatureEnabled = useIsFeatureEnabled();
  const pages =
    componentTypes?.["org.keycloak.services.ui.extend.UiPageProvider"];
  const navigate = useNavigate();
  const { realmRepresentation } = useRealm();

  type SelectedItem = {
    groupId: number | string;
    itemId: number | string;
    to: string;
    event: FormEvent<HTMLInputElement>;
  };

  const onSelect = (item: SelectedItem) => {
    navigate(item.to);
    item.event.preventDefault();
  };

  const showManage = hasSomeAccess(
    "view-realm",
    "query-groups",
    "query-users",
    "query-clients",
    "view-events",
  );

  const showConfigure = hasSomeAccess(
    "view-realm",
    "query-clients",
    "view-identity-providers",
  );

  const isOnAddRealm = !!useMatch(AddRealmRoute.path);

  const { whoAmI, isLoading } = useWhoAmI();

  if (isLoading || !whoAmI) {
    return null;
  }

  const isKeycloakAdmin = whoAmI.isKeycloakAdmin();
  const isClientAdminWithSsoPermission =
    whoAmI.isClientAdminWithSsoPermission();
  const isClientAdminWithLdapPermission =
    whoAmI.isClientAdminWithLdapPermission();

  return (
    <PageSidebar className="keycloak__page_nav__nav">
      <PageSidebarBody>
        <Nav onSelect={(_event, item) => onSelect(item as SelectedItem)}>
          <NavList>
            <NavItem className="keycloak__page_nav__nav_item__realm-selector">
              <RealmSelector />
            </NavItem>
          </NavList>
          <Divider />
          {showManage && !isOnAddRealm && (
            <NavGroup aria-label={t("manage")} title={t("manage")}>
              {isFeatureEnabled(Feature.Organizations) &&
                realmRepresentation?.organizationsEnabled && (
                  <LeftNav title="organizations" path="/organizations" />
                )}
              <LeftNav
                title="clients"
                path="/clients"
                isVisible={isKeycloakAdmin}
              />
              <LeftNav
                title="clientScopes"
                path="/client-scopes"
                isVisible={isKeycloakAdmin}
              />
              <LeftNav
                title="realmRoles"
                path="/roles"
                isVisible={isKeycloakAdmin}
              />
              <LeftNav title="users" path="/users" />
              <LeftNav
                title="groups"
                path="/groups"
                isVisible={isKeycloakAdmin}
              />
              <LeftNav
                title="sessions"
                path="/sessions"
                isVisible={isKeycloakAdmin}
              />
              <LeftNav
                title="events"
                path="/events"
                isVisible={isKeycloakAdmin}
              />
            </NavGroup>
          )}

          {showConfigure && !isOnAddRealm && (
            <NavGroup aria-label={t("configure")} title={t("configure")}>
              <LeftNav
                title="realmSettings"
                path="/realm-settings"
                isVisible={isKeycloakAdmin}
              />
              <LeftNav
                title="authentication"
                path="/authentication"
                isVisible={isKeycloakAdmin}
              />
              <LeftNav
                title="identityProviders"
                path="/identity-providers"
                isVisible={isKeycloakAdmin || isClientAdminWithSsoPermission}
              />
              <LeftNav
                title="userFederation"
                path="/user-federation"
                isVisible={isKeycloakAdmin || isClientAdminWithLdapPermission}
              />
              {isFeatureEnabled(Feature.AdminFineGrainedAuthzV2) &&
                realmRepresentation?.adminPermissionsEnabled && (
                  <LeftNav
                    title="permissions"
                    path="/permissions"
                    isVisible={isKeycloakAdmin}
                  />
                )}
              {isFeatureEnabled(Feature.DeclarativeUI) &&
                pages?.map((p) => (
                  <LeftNav
                    key={p.id}
                    title={p.id}
                    path={toPage({ providerId: p.id }).pathname!}
                    id="/page-section"
                    isVisible={isKeycloakAdmin}
                  />
                ))}
            </NavGroup>
          )}
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );
};
