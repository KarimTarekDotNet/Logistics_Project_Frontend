import { Activity, BarChart3, CircleDollarSign, ClipboardList, Clock3, LayoutDashboard, Ship } from "lucide-react";
import { EmptyState, PanelTitle, SectionHeader, StatCard, StatusBadge } from "../components/ui";
import type { Quote, Rate, Shipment } from "../types";
import { formatDate, formatMoney } from "../utils/format";

export function OverviewPage(props: {
  stats: { activeRates: number; openShipments: number; quotedValue: number; shipmentValue: number };
  shipments: Shipment[];
  rates: Rate[];
  quotes: Quote[];
  loading: boolean;
  onSelectShipment: (id: string) => void;
}) {
  const { stats, shipments, rates, quotes, loading, onSelectShipment } = props;
  const urgentShipments = shipments.filter((shipment) => ["PaymentPending", "OnHold", "BookingRequested"].includes(shipment.status)).slice(0, 5);
  const highestRate = Math.max(0, ...rates.map((rate) => rate.price));

  return (
    <div className="view-stack">
      <SectionHeader icon={<LayoutDashboard size={22} />} title="Operations Overview" meta={loading ? "Syncing live workspace" : "Live workspace"} />

      <div className="stat-grid">
        <StatCard icon={<Activity size={20} />} label="Open shipments" value={stats.openShipments} tone="blue" />
        <StatCard icon={<CircleDollarSign size={20} />} label="Active rates" value={stats.activeRates} tone="green" />
        <StatCard icon={<ClipboardList size={20} />} label="Quoted value" value={formatMoney(stats.quotedValue)} tone="amber" />
        <StatCard icon={<Ship size={20} />} label="Shipment value" value={formatMoney(stats.shipmentValue)} tone="red" />
      </div>

      <div className="ops-board">
        <section className="panel board-main">
          <PanelTitle icon={<Ship size={18} />} title="Shipment Command Board" meta={`${shipments.length} visible`} />
          {shipments.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Customer</th>
                    <th>Carrier</th>
                    <th>Status</th>
                    <th>Checkpoint</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.slice(0, 10).map((shipment) => (
                    <tr key={shipment.id} onClick={() => onSelectShipment(shipment.id)} className="clickable-row">
                      <td>{shipment.bookingNumber || "Pending"}</td>
                      <td>{shipment.customerName}</td>
                      <td>{shipment.carrierName || "Pending"}</td>
                      <td>
                        <StatusBadge status={shipment.status} />
                      </td>
                      <td>{shipment.currentCheckpoint || "Pending"}</td>
                      <td>{formatMoney(shipment.agreedPrice, shipment.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Ship size={28} />} title="No shipments yet" description="Shipments appear here after a customer creates from an approved quote." />
          )}
        </section>

        <aside className="board-rail">
          <section className="panel">
            <PanelTitle icon={<Clock3 size={18} />} title="Attention Queue" />
            <div className="compact-list">
              {urgentShipments.map((shipment) => (
                <button className="list-row button-row-card" type="button" key={shipment.id} onClick={() => onSelectShipment(shipment.id)}>
                  <div>
                    <strong>{shipment.customerName}</strong>
                    <small>
                      {shipment.currentCheckpoint || "No checkpoint"} - {formatDate(shipment.createdAt)}
                    </small>
                  </div>
                  <StatusBadge status={shipment.status} />
                </button>
              ))}
              {urgentShipments.length === 0 && <EmptyState icon={<Clock3 size={24} />} title="No urgent operations" />}
            </div>
          </section>

          <section className="panel">
            <PanelTitle icon={<BarChart3 size={18} />} title="Pricing Pulse" />
            <div className="metric-grid">
              <div>
                <span>Rates loaded</span>
                <strong>{rates.length}</strong>
              </div>
              <div>
                <span>Quotes loaded</span>
                <strong>{quotes.length}</strong>
              </div>
              <div>
                <span>Highest rate</span>
                <strong>{formatMoney(highestRate)}</strong>
              </div>
              <div>
                <span>Latest quote</span>
                <strong>{quotes[0] ? formatDate(quotes[0].createdAt) : "Pending"}</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
