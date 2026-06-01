import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "../services/api";
import type { AppData, AuthSession, Shipment, ShipmentCharge, ShipmentDocument, ShipmentHistory, ShipmentItem, TimelineItem } from "../types";
import { isValidId } from "../utils/ids";
import { safe } from "../utils/errors";

type SetAppData = Dispatch<SetStateAction<AppData>>;

export function useShipmentWorkspace(session: AuthSession | null, setData: SetAppData) {
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [selectedShipmentDetail, setSelectedShipmentDetail] = useState<Shipment | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [shipmentHistory, setShipmentHistory] = useState<ShipmentHistory[]>([]);
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([]);
  const [charges, setCharges] = useState<ShipmentCharge[]>([]);

  const clearShipmentContext = useCallback(() => {
    setSelectedShipmentId("");
    setSelectedShipmentDetail(null);
    setTimeline([]);
    setShipmentHistory([]);
    setDocuments([]);
    setShipmentItems([]);
    setCharges([]);
  }, []);

  const loadShipmentRelated = useCallback(
    async (shipmentId: string) => {
      if (!session?.accessToken || !isValidId(shipmentId)) return;

      const token = session.accessToken;
      const [detail, nextTimeline, nextDocuments, nextItems, nextHistory, nextCharges] = await Promise.all([
        safe(() => api.getShipment(token, shipmentId), null),
        safe(() => api.getTimeline(token, shipmentId, { pageSize: 50 }), [] as TimelineItem[]),
        safe(() => api.getDocuments(token, shipmentId), [] as ShipmentDocument[]),
        safe(() => api.getShipmentItems(token, shipmentId), [] as ShipmentItem[]),
        safe(() => api.getShipmentHistory(token, shipmentId, { pageSize: 50 }), [] as ShipmentHistory[]),
        safe(() => api.getChargesByShipment(token, shipmentId), [] as ShipmentCharge[])
      ]);

      const detailCharges = nextCharges.length > 0 ? nextCharges : detail?.charges ?? [];

      if (detail) {
        const enriched = {
          ...detail,
          items: nextItems.length > 0 ? nextItems : detail.items,
          charges: detailCharges,
          statusHistory: nextHistory.length > 0 ? nextHistory : detail.statusHistory
        };
        setSelectedShipmentDetail(enriched);
        setData((current) => ({
          ...current,
          shipments: current.shipments.map((shipment) => (shipment.id === enriched.id ? enriched : shipment))
        }));
      }

      setTimeline(nextTimeline);
      setDocuments(nextDocuments);
      setShipmentItems(nextItems);
      setCharges(detailCharges);
      setShipmentHistory(nextHistory.length > 0 ? nextHistory : detail?.statusHistory ?? []);
    },
    [session?.accessToken, setData]
  );

  const selectShipment = useCallback((id: string) => {
    if (!isValidId(id)) return;
    setSelectedShipmentId(id);
  }, []);

  const reconcileSelectedShipment = useCallback(
    (shipments: Shipment[]) => {
      if (selectedShipmentId && shipments.every((shipment) => shipment.id !== selectedShipmentId)) {
        clearShipmentContext();
      }
    },
    [clearShipmentContext, selectedShipmentId]
  );

  useEffect(() => {
    if (isValidId(selectedShipmentId)) void loadShipmentRelated(selectedShipmentId);
  }, [loadShipmentRelated, selectedShipmentId]);

  return {
    selectedShipmentId,
    setSelectedShipmentId,
    selectedShipmentDetail,
    setSelectedShipmentDetail,
    timeline,
    shipmentHistory,
    documents,
    setDocuments,
    shipmentItems,
    charges,
    setCharges,
    loadShipmentRelated,
    selectShipment,
    clearShipmentContext,
    reconcileSelectedShipment
  };
}
