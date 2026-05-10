import { useRef, useState, useCallback } from "react";
import type { ChangeEvent, DragEvent } from "react";
import axios from "axios";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  XCircle,
  AlertTriangle,
} from "lucide-react";

const ACCEPTED_TYPES = ["application/pdf", "text/plain", "text/csv"];
const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".csv"];
const API_URL = import.meta.env.VITE_API_URL || "";
const TOAST_DURATION_MS = 3500;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isAcceptedFile = (file: File): boolean => {
  const extension = file.name
    .slice(file.name.lastIndexOf("."))
    .toLowerCase();

  return (
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.includes(extension)
  );
};

export interface PersistedFile {
  name: string;
  size: number;
}

interface Toast {
  id: number;
  message: string;
  type: "error" | "warning";
}

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------
function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 rounded-xl border border-pink-100 bg-white/95 backdrop-blur px-4 py-3 shadow-xl animate-in slide-in-from-bottom-2 fade-in"
          style={{ minWidth: "260px", maxWidth: "360px" }}
        >
          <AlertTriangle className="h-4 w-4 flex-none text-pink-400" />

          <p className="flex-1 text-[13px] text-neutral-700">
            {t.message}
          </p>

          <button
            onClick={() => onDismiss(t.id)}
            className="text-neutral-400 hover:text-pink-500 transition-colors"
            aria-label="Dismiss"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface FileUploadProps {
  uploadedFiles: PersistedFile[];
  onRefresh: () => Promise<void>;
}

export function FileUpload({
  uploadedFiles,
  onRefresh,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // -------------------------------------------------------------------------
  // Toast helpers
  // -------------------------------------------------------------------------
  const pushToast = useCallback(
    (message: string, type: Toast["type"] = "error") => {
      const id = Date.now();

      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION_MS);
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------
  const selectFile = async (nextFile: File) => {
    if (!isAcceptedFile(nextFile)) {
      pushToast("Only PDF, TXT, and CSV files are supported.");
      return;
    }

    const isDuplicate = uploadedFiles.some(
      (f) => f.name === nextFile.name,
    );

    if (isDuplicate) {
      pushToast(
        `"${nextFile.name}" is already in your knowledge base. Remove it first if you want to replace it.`,
        "warning",
      );

      if (inputRef.current) inputRef.current.value = "";

      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();

      formData.append("file", nextFile);

      await axios.post(`${API_URL}/api/upload`, formData);

      await onRefresh();
    } catch (err) {
      let errorMessage =
        "An unexpected error occurred during upload.";

      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      pushToast(errorMessage);
    } finally {
      setIsLoading(false);

      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    setIsDragging(false);

    const nextFile = event.dataTransfer.files[0];

    if (nextFile) selectFile(nextFile);
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextFile = event.target.files?.[0];

    if (nextFile) selectFile(nextFile);
  };

  const clearFile = async (nameToDelete: string) => {
    try {
      await axios.post(`${API_URL}/api/delete`, {
        source: nameToDelete,
      });

      await onRefresh();
    } catch (err) {
      console.error(
        "Failed to sync deletion with vector store:",
        err,
      );
    }
  };

  return (
    <>
      <ToastStack
        toasts={toasts}
        onDismiss={dismissToast}
      />

      <section className="w-full">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-pink-400">
            Knowledge Base
          </p>

          <h2 className="mt-1 text-base font-medium text-neutral-700">
            Sources
          </h2>
        </div>

        <div
          className={[
            "flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-pink-300 bg-pink-50"
              : "border-pink-100 bg-white hover:border-pink-200 hover:bg-pink-50/50",
          ].join(" ")}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button"))
              return;

            if (!isLoading) inputRef.current?.click();
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-pink-500 border border-pink-200 shadow-sm">
            {isLoading ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Upload
                className="h-4 w-4"
                aria-hidden="true"
              />
            )}
          </div>

          <p className="mt-4 text-[15px] font-medium text-neutral-700">
            Upload a document
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            PDF, TXT, or CSV
          </p>

          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            onChange={handleFileChange}
          />

          <button
            className="mt-5 rounded-lg bg-gradient-to-r from-pink-200 to-purple-200 px-5 py-2 text-xs font-semibold text-neutral-700 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={isLoading}
            onClick={() => inputRef.current?.click()}
          >
            Select file
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {uploadedFiles.map((fileData) => (
            <div
              key={fileData.name}
              className="flex items-center gap-3 rounded-lg border border-pink-100 bg-white p-3 shadow-sm"
            >
              <div className="h-10 w-10 rounded bg-pink-100 flex items-center justify-center text-pink-500">
                <FileText className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1 ml-1">
                <p className="truncate text-[14px] font-medium text-neutral-700">
                  {fileData.name}
                </p>

                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {formatFileSize(fileData.size)}
                </p>
              </div>

              <CheckCircle2 className="h-4 w-4 text-purple-400" />

              <button
                className="rounded p-2 text-neutral-400 transition hover:bg-pink-50 hover:text-pink-500"
                type="button"
                onClick={() => clearFile(fileData.name)}
                aria-label="Remove selected file"
              >
                <XCircle
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}