import { NetworkError } from "@keycloak/keycloak-admin-client";
import {
  KeycloakDataTable,
  useAlerts,
  useEnvironment,
} from "@keycloak/keycloak-ui-shared";
import {
  AlertVariant,
  Badge,
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  PageSection,
  Popover,
  ToolbarItem,
} from "@patternfly/react-core";
import { EllipsisVIcon } from "@patternfly/react-icons";
import { cellWidth } from "@patternfly/react-table";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAdminClient } from "../admin-client";
import { useConfirmDialog } from "../components/confirm-dialog/ConfirmDialog";
import { ViewHeader } from "../components/view-header/ViewHeader";
import { fetchAdminUI } from "../context/auth/admin-ui-endpoint";
import { useRealm } from "../context/realm-context/RealmContext";
import { useRecentRealms } from "../context/RecentRealms";
import { useWhoAmI } from "../context/whoami/WhoAmI";
import type { Environment } from "../environment-types";
import { resolveDisplayName } from "../util";
import NewRealmForm from "./add/NewRealmForm";
import { toRealm } from "./RealmRoutes";
import { toDashboard } from "../dashboard/routes/Dashboard";

export type RealmNameRepresentation = {
  name: string;
  displayName?: string;
};

const RecentRealmsDropdown = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const recentRealms = useRecentRealms();

  if (recentRealms.length < 3) return null;
  return (
    <Dropdown
      shouldFocusToggleOnSelect
      onOpenChange={(isOpen) => setOpen(isOpen)}
      toggle={(ref) => (
        <MenuToggle
          data-testid="kebab"
          aria-label="Kebab toggle"
          ref={ref}
          onClick={() => setOpen(!open)}
        >
          {t("recentRealms")}
        </MenuToggle>
      )}
      isOpen={open}
    >
      <DropdownList>
        {recentRealms.map(({ name }) => (
          <DropdownItem
            key="server info"
            component={(props) => (
              <Link {...props} to={toDashboard({ realm: name })} />
            )}
          >
            {name}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};

type KebabDropdownProps = {
  onClick: () => void;
  isDisabled?: boolean;
};

const KebabDropdown = ({ onClick, isDisabled }: KebabDropdownProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Dropdown
      shouldFocusToggleOnSelect
      onOpenChange={(isOpen) => setOpen(isOpen)}
      toggle={(ref) => (
        <MenuToggle
          data-testid="kebab"
          aria-label="Kebab toggle"
          ref={ref}
          onClick={() => setOpen(!open)}
          variant="plain"
          isDisabled={isDisabled}
        >
          <EllipsisVIcon />
        </MenuToggle>
      )}
      isOpen={open}
    >
      <DropdownList>
        <DropdownItem
          data-testid="delete"
          onClick={() => {
            setOpen(false);
            onClick();
          }}
        >
          {t("delete")}
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

type RealmRow = RealmNameRepresentation & { id: string };

const PINNED_FIRST_REALMS = ["mym_sso"];
const PINNED_LAST_REALMS = ["master", "mym_admin"];

/** MyMaintenance customisation, carried over from the 26.1.2 realm selector. */
const sortRealmsForMyMaintenance = (
  realms: RealmNameRepresentation[],
  currentRealm: string,
  locale: string,
): RealmNameRepresentation[] => {
  const byName = (name: string) =>
    realms.find((r) => r.name.toLowerCase() === name);
  const pinned = [...PINNED_FIRST_REALMS, ...PINNED_LAST_REALMS];
  const others = realms
    .filter((r) => !pinned.includes(r.name.toLowerCase()))
    .sort((a, b) => {
      if (a.name === currentRealm) return -1;
      if (b.name === currentRealm) return 1;
      return a.name.localeCompare(b.name, locale);
    });

  return [
    ...PINNED_FIRST_REALMS.map(byName),
    ...others,
    ...PINNED_LAST_REALMS.map(byName),
  ].filter((r): r is RealmNameRepresentation => !!r);
};

export default function RealmSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { whoAmI } = useWhoAmI();
  const { realm } = useRealm();
  const { environment } = useEnvironment<Environment>();
  const { adminClient } = useAdminClient();
  const { addAlert, addError } = useAlerts();

  const [selected, setSelected] = useState<RealmRow[]>([]);
  const [openNewRealm, setOpenNewRealm] = useState(false);
  const [key, setKey] = useState(0);
  const refresh = () => setKey(key + 1);

  const loader = async (first?: number, max?: number, search?: string) => {
    try {
      const result = await fetchAdminUI<RealmNameRepresentation[]>(
        adminClient,
        "ui-ext/realms/names",
        { first: `${first}`, max: `${max}`, search: search || "" },
      );
      // MyMaintenance customisation: order the page as mym_sso first, then
      // the other realms (current realm first, then by name), then master
      // and mym_admin last. The table asks for one row more than a page to
      // know if there is a next page; that probe row is left where it is.
      const pageSize = max !== undefined ? Math.max(max - 1, 0) : result.length;
      const ordered = [
        ...sortRealmsForMyMaintenance(
          result.slice(0, pageSize),
          realm,
          whoAmI.locale,
        ),
        ...result.slice(pageSize),
      ];
      return ordered.map((r) => ({ ...r, id: r.name }));
    } catch (error) {
      if (error instanceof NetworkError && error.response.status < 500) {
        return [];
      }

      throw error;
    }
  };

  const [toggleDeleteDialog, DeleteConfirm] = useConfirmDialog({
    titleKey: t("deleteConfirmRealm", {
      count: selected.length,
      name: selected[0]?.name,
    }),
    messageKey: "deleteConfirmRealmSetting",
    continueButtonLabel: "delete",
    onConfirm: async () => {
      try {
        if (selected.some(({ name }) => name === environment.masterRealm)) {
          addAlert(t("cantDeleteMasterRealm"), AlertVariant.warning);
        }
        const filtered = selected.filter(
          ({ name }) => name !== environment.masterRealm,
        );
        if (filtered.length === 0) return;
        await Promise.all(
          filtered.map(({ name: realmName }) =>
            adminClient.realms.del({ realm: realmName }),
          ),
        );
        addAlert(t("deletedSuccessRealmSetting"));
        if (selected.some(({ name }) => name === realm)) {
          void navigate(toRealm({ realm: environment.masterRealm }));
        }
        refresh();
        setSelected([]);
      } catch (error) {
        addError("deleteError", error);
      }
    },
  });

  return (
    <>
      <DeleteConfirm />
      {openNewRealm && (
        <NewRealmForm
          onClose={() => {
            setOpenNewRealm(false);
            refresh();
          }}
        />
      )}
      <ViewHeader titleKey="manageRealms" divider={false} />
      <PageSection variant="light" className="pf-v5-u-p-0">
        <KeycloakDataTable
          key={key}
          loader={loader}
          isPaginated
          onSelect={setSelected}
          canSelectAll
          ariaLabelKey="selectRealm"
          searchPlaceholderKey="search"
          actions={[
            {
              title: t("delete"),
              onRowClick: (selected) => {
                setSelected([selected]);
                toggleDeleteDialog();
              },
            },
          ]}
          toolbarItem={
            <>
              <ToolbarItem>
                {whoAmI.createRealm && (
                  <Button
                    onClick={() => setOpenNewRealm(true)}
                    data-testid="add-realm"
                  >
                    {t("createRealm")}
                  </Button>
                )}
              </ToolbarItem>
              <ToolbarItem>
                <RecentRealmsDropdown />
              </ToolbarItem>
              <ToolbarItem>
                <KebabDropdown
                  onClick={toggleDeleteDialog}
                  isDisabled={selected.length === 0}
                />
              </ToolbarItem>
            </>
          }
          columns={[
            {
              name: "name",
              transforms: [cellWidth(20)],
              cellRenderer: ({ name }) =>
                name !== realm ? (
                  <Link to={toDashboard({ realm: name })}>{name}</Link>
                ) : (
                  <Popover
                    bodyContent={t("currentRealmExplain")}
                    triggerAction="hover"
                  >
                    <>
                      {name} <Badge isRead>{t("currentRealm")}</Badge>
                    </>
                  </Popover>
                ),
            },
            {
              name: "displayName",
              transforms: [cellWidth(80)],
              cellRenderer: ({ displayName }) =>
                resolveDisplayName(t, displayName, "—"),
            },
          ]}
        />
      </PageSection>
    </>
  );
}
