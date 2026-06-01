import { CloudUpload, Download, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { ConfirmDialog, EmptyState, EntityActions, Field, PanelTitle, SectionHeader } from "../components/ui";
import { documentTypes } from "../constants/logistics";
import { ShipmentContextPanel } from "../features/shipments/ShipmentContextPanel";
import { openApiAsset } from "../services/api";
import type { Shipment, ShipmentDocument } from "../types";
import { getFriendlyErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/format";

export function DocumentsPage(props: {
  selectedShipment?: Shipment;
  documents: ShipmentDocument[];
  busy: boolean;
  draft: { type: number; file: File | null };
  setDraft: (draft: { type: number; file: File | null }) => void;
  onUpload: (event: FormEvent) => void;
  onDeleteDocument: (id: string) => void;
}) {
  const { selectedShipment, documents, busy, draft, setDraft, onUpload, onDeleteDocument } = props;
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function assignFile(file?: File | null) {
    if (!file) return;
    setDraft({ ...draft, file });
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    assignFile(event.dataTransfer.files?.[0]);
  }

  async function openDocument(document: ShipmentDocument) {
    if (!document.storagePath || openingId) return;

    setOpeningId(document.id);
    setOpenError(null);
    try {
      await openApiAsset(document.storagePath, document.fileName);
    } catch (error) {
      setOpenError(getFriendlyErrorMessage(error));
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="view-stack">
      <SectionHeader icon={<FileText size={22} />} title="Documents" meta={selectedShipment ? "Shipment document room" : "No shipment"} />

      {selectedShipment ? (
        <>
          <ShipmentContextPanel
            shipment={selectedShipment}
            extra={[
              { label: "Documents", value: String(documents.length) },
              { label: "Items", value: String(selectedShipment.items?.length ?? 0) },
              { label: "Charges", value: String(selectedShipment.charges?.length ?? 0) }
            ]}
          />

          <div className="two-column">
            <section className="panel">
              <PanelTitle icon={<Upload size={18} />} title="Upload document" />
              <form className="form-stack" onSubmit={onUpload}>
                <Field label="Document type">
                  <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: Number(event.target.value) })}>
                    {documentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => setDraft({ ...draft, file: event.target.files?.[0] ?? null })}
                />
                <button
                  className={`upload-dropzone ${draft.file ? "has-file" : ""}`}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                >
                  <span className="upload-icon">
                    <CloudUpload size={34} />
                  </span>
                  <strong>{draft.file ? draft.file.name : "Drop shipment document here"}</strong>
                  <span>{draft.file ? `${(draft.file.size / 1024 / 1024).toFixed(2)} MB selected` : "Browse or drag a file into this upload area"}</span>
                  <small>Supported: PDF, JPG, JPEG, PNG. Maximum file size: 5 MB.</small>
                </button>
                <button className="primary-button compact upload-action" type="submit" disabled={busy || !draft.file}>
                  <Upload size={17} />
                  Upload
                </button>
              </form>
            </section>

            <section className="panel">
              <PanelTitle icon={<FileText size={18} />} title="Shipment documents" meta={`${documents.length} files`} />
              {openError && <p className="field-error">{openError}</p>}
              <div className="compact-list">
                {documents.map((document) => (
                  <div className="list-row document-row" key={document.id}>
                    <div>
                      <strong>{document.fileName}</strong>
                      <small>
                        {document.type} - {formatDate(document.uploadedAt)} - {document.uploadedByUsername}
                      </small>
                    </div>
                    <span>{document.contentType}</span>
                    <EntityActions>
                      {document.storagePath && (
                        <button
                          className="icon-mini"
                          type="button"
                          disabled={openingId === document.id}
                          title="Open document"
                          onClick={() => void openDocument(document)}
                        >
                          <Download size={14} />
                        </button>
                      )}
                      <button className="icon-mini danger" type="button" title="Delete document" onClick={() => setDeleteId(document.id)}>
                        <Trash2 size={14} />
                      </button>
                    </EntityActions>
                  </div>
                ))}
                {documents.length === 0 && <EmptyState icon={<FileText size={24} />} title="No documents uploaded" />}
              </div>
            </section>
          </div>
        </>
      ) : (
        <EmptyState icon={<FileText size={28} />} title="No shipment selected" />
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete document"
        message="This removes the document from the shipment document set."
        confirmLabel="Delete document"
        tone="danger"
        busy={busy}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          onDeleteDocument(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
