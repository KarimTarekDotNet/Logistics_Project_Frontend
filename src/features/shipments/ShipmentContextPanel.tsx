import type { ReactNode } from "react";
import type { Shipment } from "../../types";
import { formatDate, formatMoney } from "../../utils/format";
import { MetricLine, StatusBadge } from "../../components/ui";

export function ShipmentContextPanel(props: { shipment: Shipment; extra?: Array<{ label: string; value: ReactNode }> }) {
  const { shipment, extra = [] } = props;
  const timelineFacts = [
    { label: "Created", value: formatDate(shipment.createdAt) },
    { label: "Client confirmed", value: formatDate(shipment.clientConfirmedAt) },
    { label: "Booking requested", value: formatDate(shipment.bookingRequestedAt) },
    { label: "Booking confirmed", value: formatDate(shipment.bookingConfirmedAt) },
    { label: "ETD", value: formatDate(shipment.estimatedDeparture) },
    { label: "ETA", value: formatDate(shipment.estimatedArrival) },
    { label: "ATD", value: formatDate(shipment.actualDeparture) },
    { label: "ATA", value: formatDate(shipment.actualArrival) }
  ];

  return (
    <section className="shipment-context-panel">
      <div className="shipment-context-head">
        <div>
          <span className="context-kicker">Selected shipment</span>
          <h2>{shipment.customerName}</h2>
          <small>
            {shipment.carrierName || "Carrier pending"} - {shipment.containerTypeName || "Container pending"}
          </small>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      <div className="context-metrics">
        <MetricLine label="Carrier" value={shipment.carrierName || "Pending"} />
        <MetricLine label="Container" value={shipment.containerTypeName || "Pending"} />
        <MetricLine label="Value" value={formatMoney(shipment.agreedPrice, shipment.currency)} />
        <MetricLine label="Booking" value={shipment.bookingNumber || "Pending"} />
        <MetricLine label="Vessel" value={shipment.vesselName || "Pending"} />
        <MetricLine label="Voyage" value={shipment.voyageNumber || "Pending"} />
        <MetricLine label="Checkpoint" value={shipment.currentCheckpoint || "Pending"} />
        {extra.map((item) => (
          <MetricLine key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="context-timeline">
        {timelineFacts.map((fact) => (
          <div className="context-date" key={fact.label}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
