import { Box, Building2, Database, MapPin, Pencil, Plus, RouteIcon, Search, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ConfirmDialog, EmptyState, EntityActions, Field, PanelTitle, SectionHeader } from "../components/ui";
import type { Carrier, ContainerType, Port, Route } from "../types";
import { includesSearch } from "../utils/search";

type Tab = "carriers" | "ports" | "routes" | "containers";

export function MasterDataPage(props: {
  carriers: Carrier[];
  ports: Port[];
  routes: Route[];
  containerTypes: ContainerType[];
  isAdmin: boolean;
  busy: boolean;
  onCreateCarrier: (body: { name: string; code: string }) => void;
  onUpdateCarrier: (id: string, body: { name?: string; code?: string }) => void;
  onDeleteCarrier: (id: string) => void;
  onCreatePort: (body: { name: string; code: string; country: string }) => void;
  onUpdatePort: (id: string, body: { name?: string; code?: string; country?: string }) => void;
  onDeletePort: (id: string) => void;
  onCreateRoute: (body: { fromPortId: string; toPortId: string }) => void;
  onUpdateRoute: (id: string, body: { fromPortId: string; toPortId: string }) => void;
  onDeleteRoute: (id: string) => void;
  onCreateContainerType: (body: { name: string }) => void;
  onUpdateContainerType: (id: string, body: { name: string }) => void;
  onDeleteContainerType: (id: string) => void;
  onFilterPortsByCountry: (country: string) => void;
  onFilterRoutesByPort: (portId: string, direction: "from" | "to") => void;
}) {
  const [tab, setTab] = useState<Tab>("carriers");
  const [query, setQuery] = useState("");
  const [carrierDraft, setCarrierDraft] = useState({ name: "", code: "" });
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [portDraft, setPortDraft] = useState({ name: "", code: "", country: "" });
  const [editingPort, setEditingPort] = useState<Port | null>(null);
  const [routeDraft, setRouteDraft] = useState({ fromPortId: "", toPortId: "" });
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [containerDraft, setContainerDraft] = useState({ name: "" });
  const [editingContainer, setEditingContainer] = useState<ContainerType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: Tab; id: string } | null>(null);
  const [countryFilter, setCountryFilter] = useState("");
  const [routePortFilter, setRoutePortFilter] = useState("");

  const filteredCarriers = useMemo(
    () => props.carriers.filter((carrier) => includesSearch([carrier.name, carrier.code], query)),
    [props.carriers, query]
  );
  const filteredPorts = useMemo(
    () => props.ports.filter((port) => includesSearch([port.name, port.code, port.country], query)),
    [props.ports, query]
  );
  const filteredRoutes = useMemo(
    () => props.routes.filter((route) => includesSearch([route.fromPortName, route.fromPortCode, route.toPortName, route.toPortCode], query)),
    [props.routes, query]
  );
  const filteredContainers = useMemo(
    () => props.containerTypes.filter((containerType) => includesSearch([containerType.name], query)),
    [props.containerTypes, query]
  );
  const routeFromPortId = routeDraft.fromPortId || props.ports[0]?.id || "";
  const routeToPortId = routeDraft.toPortId || props.ports.find((port) => port.id !== routeFromPortId)?.id || "";
  const canSubmitRoute = Boolean(routeFromPortId && routeToPortId && routeFromPortId !== routeToPortId);

  function submitCarrier(event: FormEvent) {
    event.preventDefault();
    if (editingCarrier) {
      props.onUpdateCarrier(editingCarrier.id, { name: carrierDraft.name.trim(), code: carrierDraft.code.trim().toUpperCase() });
      setEditingCarrier(null);
    } else {
      props.onCreateCarrier({ name: carrierDraft.name.trim(), code: carrierDraft.code.trim().toUpperCase() });
    }
    setCarrierDraft({ name: "", code: "" });
  }

  function submitPort(event: FormEvent) {
    event.preventDefault();
    if (editingPort) {
      props.onUpdatePort(editingPort.id, {
        name: portDraft.name.trim(),
        code: portDraft.code.trim().toUpperCase(),
        country: portDraft.country.trim().toUpperCase()
      });
      setEditingPort(null);
    } else {
      props.onCreatePort({
        name: portDraft.name.trim(),
        code: portDraft.code.trim().toUpperCase(),
        country: portDraft.country.trim().toUpperCase()
      });
    }
    setPortDraft({ name: "", code: "", country: "" });
  }

  function submitRoute(event: FormEvent) {
    event.preventDefault();
    if (!canSubmitRoute) return;
    const fromPortId = routeFromPortId;
    const toPortId = routeToPortId;
    if (editingRoute) {
      props.onUpdateRoute(editingRoute.id, { fromPortId, toPortId });
      setEditingRoute(null);
    } else {
      props.onCreateRoute({ fromPortId, toPortId });
    }
    setRouteDraft({ fromPortId: "", toPortId: "" });
  }

  function submitContainer(event: FormEvent) {
    event.preventDefault();
    if (editingContainer) {
      props.onUpdateContainerType(editingContainer.id, { name: containerDraft.name.trim() });
      setEditingContainer(null);
    } else {
      props.onCreateContainerType({ name: containerDraft.name.trim() });
    }
    setContainerDraft({ name: "" });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "carriers") props.onDeleteCarrier(deleteTarget.id);
    if (deleteTarget.type === "ports") props.onDeletePort(deleteTarget.id);
    if (deleteTarget.type === "routes") props.onDeleteRoute(deleteTarget.id);
    if (deleteTarget.type === "containers") props.onDeleteContainerType(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div className="view-stack">
      <SectionHeader icon={<Database size={22} />} title="Master Data" meta="Network, equipment, and carrier setup" />

      <section className="panel">
        <div className="toolbar master-toolbar">
          <div className="segmented inline">
            {[
              ["carriers", "Carriers"],
              ["ports", "Ports"],
              ["routes", "Routes"],
              ["containers", "Containers"]
            ].map(([value, label]) => (
              <button type="button" className={tab === value ? "active" : ""} onClick={() => setTab(value as Tab)} key={value}>
                {label}
              </button>
            ))}
          </div>
          <div className="toolbar-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 100))} placeholder="Search master data" maxLength={100} spellCheck={false} />
          </div>
        </div>
      </section>

      {tab === "carriers" && (
        <div className="two-column">
          <section className="panel">
            <PanelTitle icon={<Building2 size={18} />} title={editingCarrier ? "Edit carrier" : "Create carrier"} />
            <form className="form-stack" onSubmit={submitCarrier}>
              <Field label="Carrier name">
                <input value={carrierDraft.name} onChange={(event) => setCarrierDraft({ ...carrierDraft, name: event.target.value })} required />
              </Field>
              <Field label="Code">
                <input value={carrierDraft.code} onChange={(event) => setCarrierDraft({ ...carrierDraft, code: event.target.value.toUpperCase() })} required />
              </Field>
              <div className="button-row">
                <button className="primary-button compact" type="submit" disabled={props.busy}>
                  <Plus size={17} />
                  {editingCarrier ? "Save carrier" : "Create carrier"}
                </button>
                {editingCarrier && (
                  <button className="secondary-button compact" type="button" onClick={() => setEditingCarrier(null)}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
          <EntityTable
            title="Carriers"
            rows={filteredCarriers.map((carrier) => ({
              id: carrier.id,
              cells: [carrier.name, carrier.code],
              onEdit: () => {
                setEditingCarrier(carrier);
                setCarrierDraft({ name: carrier.name, code: carrier.code });
              },
              onDelete: props.isAdmin ? () => setDeleteTarget({ type: "carriers", id: carrier.id }) : undefined
            }))}
            headers={["Name", "Code"]}
            icon={<Building2 size={18} />}
          />
        </div>
      )}

      {tab === "ports" && (
        <div className="two-column">
          <section className="panel">
            <PanelTitle icon={<MapPin size={18} />} title={editingPort ? "Edit port" : "Create port"} />
            <form className="form-stack" onSubmit={submitPort}>
              <Field label="Port name">
                <input value={portDraft.name} onChange={(event) => setPortDraft({ ...portDraft, name: event.target.value })} required />
              </Field>
              <div className="form-grid">
                <Field label="Code">
                  <input value={portDraft.code} onChange={(event) => setPortDraft({ ...portDraft, code: event.target.value.toUpperCase() })} required />
                </Field>
                <Field label="Country">
                  <input value={portDraft.country} onChange={(event) => setPortDraft({ ...portDraft, country: event.target.value.toUpperCase() })} required />
                </Field>
              </div>
              <button className="primary-button compact" type="submit" disabled={props.busy}>
                <Plus size={17} />
                {editingPort ? "Save port" : "Create port"}
              </button>
            </form>
            <div className="endpoint-tool">
              <Field label="Country lookup">
                <input value={countryFilter} onChange={(event) => setCountryFilter(event.target.value.toUpperCase())} placeholder="EG" />
              </Field>
              <button className="secondary-button compact" type="button" onClick={() => props.onFilterPortsByCountry(countryFilter)} disabled={!countryFilter}>
                Load by country
              </button>
            </div>
          </section>
          <EntityTable
            title="Ports"
            rows={filteredPorts.map((port) => ({
              id: port.id,
              cells: [port.name, port.code, port.country],
              onEdit: () => {
                setEditingPort(port);
                setPortDraft({ name: port.name, code: port.code, country: port.country });
              },
              onDelete: props.isAdmin ? () => setDeleteTarget({ type: "ports", id: port.id }) : undefined
            }))}
            headers={["Name", "Code", "Country"]}
            icon={<MapPin size={18} />}
          />
        </div>
      )}

      {tab === "routes" && (
        <div className="two-column">
          <section className="panel">
            <PanelTitle icon={<RouteIcon size={18} />} title={editingRoute ? "Edit route" : "Create route"} />
            <form className="form-stack" onSubmit={submitRoute}>
              <Field label="From port">
                <select value={routeFromPortId} onChange={(event) => setRouteDraft({ ...routeDraft, fromPortId: event.target.value })}>
                  {props.ports.map((port) => (
                    <option key={port.id} value={port.id}>
                      {port.code} - {port.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="To port">
                <select value={routeToPortId} onChange={(event) => setRouteDraft({ ...routeDraft, toPortId: event.target.value })}>
                  {props.ports.map((port) => (
                    <option key={port.id} value={port.id}>
                      {port.code} - {port.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button className="primary-button compact" type="submit" disabled={props.busy || !canSubmitRoute}>
                <Plus size={17} />
                {editingRoute ? "Save route" : "Create route"}
              </button>
              {!canSubmitRoute && <p className="empty-hint">Choose two different ports to create a lane.</p>}
            </form>
            <div className="endpoint-tool">
              <Field label="Route lookup">
                <select value={routePortFilter} onChange={(event) => setRoutePortFilter(event.target.value)}>
                  <option value="">Choose port</option>
                  {props.ports.map((port) => (
                    <option key={port.id} value={port.id}>
                      {port.code} - {port.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="button-row">
                <button className="secondary-button compact" type="button" onClick={() => props.onFilterRoutesByPort(routePortFilter, "from")} disabled={!routePortFilter}>
                  From port
                </button>
                <button className="secondary-button compact" type="button" onClick={() => props.onFilterRoutesByPort(routePortFilter, "to")} disabled={!routePortFilter}>
                  To port
                </button>
              </div>
            </div>
          </section>
          <EntityTable
            title="Routes"
            rows={filteredRoutes.map((route) => ({
              id: route.id,
              cells: [`${route.fromPortCode} - ${route.fromPortName}`, `${route.toPortCode} - ${route.toPortName}`],
              onEdit: () => {
                setEditingRoute(route);
                setRouteDraft({ fromPortId: route.fromPortId, toPortId: route.toPortId });
              },
              onDelete: props.isAdmin ? () => setDeleteTarget({ type: "routes", id: route.id }) : undefined
            }))}
            headers={["From", "To"]}
            icon={<RouteIcon size={18} />}
          />
        </div>
      )}

      {tab === "containers" && (
        <div className="two-column">
          <section className="panel">
            <PanelTitle icon={<Box size={18} />} title={editingContainer ? "Edit container" : "Create container"} />
            <form className="form-stack" onSubmit={submitContainer}>
              <Field label="Container name">
                <input value={containerDraft.name} onChange={(event) => setContainerDraft({ name: event.target.value })} required />
              </Field>
              <button className="primary-button compact" type="submit" disabled={props.busy}>
                <Plus size={17} />
                {editingContainer ? "Save container" : "Create container"}
              </button>
            </form>
          </section>
          <EntityTable
            title="Container types"
            rows={filteredContainers.map((containerType) => ({
              id: containerType.id,
              cells: [containerType.name],
              onEdit: () => {
                setEditingContainer(containerType);
                setContainerDraft({ name: containerType.name });
              },
              onDelete: props.isAdmin ? () => setDeleteTarget({ type: "containers", id: containerType.id }) : undefined
            }))}
            headers={["Name"]}
            icon={<Box size={18} />}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete master data"
        message="This action is restricted to admins and can affect future pricing setup."
        confirmLabel="Delete"
        tone="danger"
        busy={props.busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function EntityTable(props: {
  title: string;
  icon: ReactNode;
  headers: string[];
  rows: Array<{ id: string; cells: string[]; onEdit: () => void; onDelete?: () => void }>;
}) {
  return (
    <section className="panel">
      <PanelTitle icon={props.icon} title={props.title} meta={`${props.rows.length} records`} />
      {props.rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {props.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr key={row.id}>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.id}-${index}`}>{cell}</td>
                  ))}
                  <td>
                    <EntityActions>
                      <button className="icon-mini" type="button" onClick={row.onEdit} title="Edit">
                        <Pencil size={14} />
                      </button>
                      {row.onDelete && (
                        <button className="icon-mini danger" type="button" onClick={row.onDelete} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </EntityActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={props.icon} title="No records found" />
      )}
    </section>
  );
}
