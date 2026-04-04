"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@clerk/nextjs";
import { t } from "@/lib/t";
import { getAnonId } from "@/lib/anonId";

type UploadState = "idle" | "uploading" | "success" | "error";

export function DocumentUpload({ onSuccess }: { onSuccess?: () => void }) {
  const { getToken, isSignedIn } = useAuth();
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");

  const upload = useCallback(async (file: File) => {
    setState("uploading");
    setMessage("");

    try {
      const headers: Record<string, string> = {};

      if (isSignedIn) {
        const token = await getToken();
        headers["Authorization"] = `Bearer ${token}`;
      } else {
        headers["x-anon-id"] = getAnonId();
      }

      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ingest/document`, {
        method: "POST",
        headers,
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(data.error || t.errors.generic);
        return;
      }

      setState("success");
      setMessage(`"${data.title}" indexado — ${data.chunks} fragmentos`);
      onSuccess?.();
    } catch {
      setState("error");
      setMessage(t.errors.generic);
    }
  }, [getToken, isSignedIn, onSuccess]);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) upload(accepted[0]);
  }, [upload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: state === "uploading",
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-700 hover:border-zinc-500"}
          ${state === "uploading" ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />

        {state === "uploading" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-8 h-10 rounded border border-zinc-600 bg-zinc-800 overflow-hidden">
              <div className="absolute inset-x-0 h-px bg-emerald-400 animate-[scan_0.8s_ease-in-out_infinite]" />
            </div>
            <p className="text-sm text-zinc-400">Procesando documento...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 text-xl">
              📄
            </div>
            <p className="text-sm text-zinc-300">
              {isDragActive ? "Suelta el archivo aquí" : t.dashboard.upload.description}
            </p>
            <p className="text-xs text-zinc-600">Solo PDF · Máx 5MB en plan gratuito</p>
          </div>
        )}
      </div>

      {message && (
        <p className={`text-sm ${state === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {message}
        </p>
      )}

      <style>{`
        @keyframes scan {
          0%   { top: 0%; }
          50%  { top: calc(100% - 1px); }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
