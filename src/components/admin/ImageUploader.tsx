"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImageSquare, UploadSimple } from "@phosphor-icons/react";
import { adminGetImageSignature, adminUpdateProduct, uploadToCloudinary } from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";

/**
 * Section 35 flow: signature -> direct-to-Cloudinary upload -> PATCH the
 * product with the resulting url + public id. Product must exist first.
 */
export function ImageUploader({
  productId,
  currentUrl,
  onUploaded,
}: {
  productId: string;
  currentUrl: string | null;
  onUploaded: (imageUrl: string, imagePublicId: string) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // Cloudinary's free-plan per-image cap.

  const pick = (f: File | null) => {
    if (f && f.size > MAX_UPLOAD_BYTES) {
      toast({
        tone: "danger",
        title: "Image too large",
        description: "That photo is over 10MB. Resize it or pick a smaller one and try again.",
      });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const sig = await adminGetImageSignature(productId);
      const result = await uploadToCloudinary(file, sig);
      await adminUpdateProduct(productId, {
        imageUrl: result.secure_url,
        imagePublicId: result.public_id,
      });
      onUploaded(result.secure_url, result.public_id);
      toast({ tone: "success", title: "Image updated" });
      pick(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast({
        tone: "danger",
        title: "Upload failed",
        description: errorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  };

  const shown = preview ?? currentUrl;

  return (
    <div className="rounded-lg border border-line bg-bg p-4">
      <p className="mb-3 text-[13px] font-medium text-text">Product image</p>
      <div className="flex items-start gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-md border border-line bg-surface">
          {shown ? (
            <Image src={shown} alt="" fill sizes="96px" className="object-cover" unoptimized={!!preview} />
          ) : (
            <span className="grid size-full place-items-center text-subtle">
              <ImageSquare className="size-7" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="block w-full text-[12.5px] text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[12.5px] file:font-medium file:text-text"
          />
          <p className="mt-1.5 text-[12px] text-subtle">
            Uploads straight to Cloudinary (auto-resized and compressed, up to
            10MB). JPG or PNG, landscape works best.
          </p>
          {file ? (
            <Button size="sm" className="mt-2.5" loading={busy} onClick={() => void upload()} icon={<UploadSimple className="size-4" />}>
              Upload &amp; save
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
