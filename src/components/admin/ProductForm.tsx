"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminCreateProduct,
  adminUpdateProduct,
  type AdminProductInput,
} from "@/lib/client/endpoints";
import { fieldErrors, errorMessage } from "@/lib/client/errors";
import { koboToNairaInput, nairaInputToKobo } from "@/lib/client/format";
import type { AdminCategory, AdminProduct } from "@/lib/client/types";
import { TextField, TextArea, SelectField } from "@/components/ui/form";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/admin/Toggle";
import { useToast } from "@/components/providers/ToastProvider";

export function ProductForm({
  mode,
  initial,
  categories,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: AdminProduct;
  categories: AdminCategory[];
  onSaved: (product: AdminProduct) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceNaira, setPriceNaira] = useState(
    initial ? koboToNairaInput(initial.priceKobo) : "",
  );
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories[0]?.id ?? "",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));

  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const activeCategories = categories.filter((c) => c.isActive || c.id === categoryId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrs({});
    setFormError(null);

    const local: Record<string, string> = {};
    if (name.trim().length === 0) local.name = "Required.";
    const priceKobo = nairaInputToKobo(priceNaira);
    if (priceKobo === null || priceKobo < 1) local.priceKobo = "Enter a price in Naira, e.g. 8000.";
    if (!categoryId) local.categoryId = "Choose a category.";
    if (Object.keys(local).length) {
      setErrs(local);
      return;
    }

    const tags = Array.from(
      new Set(
        tagsInput
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    const payload: AdminProductInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      priceKobo: priceKobo as number,
      categoryId,
      isActive,
      isAvailable,
      tags,
    };

    setBusy(true);
    try {
      const saved =
        mode === "create"
          ? await adminCreateProduct(payload)
          : await adminUpdateProduct(initial!.id, payload);
      toast({ tone: "success", title: mode === "create" ? "Product created" : "Saved" });
      onSaved(saved);
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrs(fe);
      else setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <TextField
        label="Name"
        required
        value={name}
        error={errs.name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextArea
        label="Description"
        optionalHint
        rows={3}
        value={description}
        error={errs.description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Price (₦)"
          required
          inputMode="decimal"
          placeholder="8000"
          value={priceNaira}
          error={errs.priceKobo}
          hint="Stored as kobo. 8000 becomes ₦8,000."
          onChange={(e) => setPriceNaira(e.target.value)}
        />
        <SelectField
          label="Category"
          required
          value={categoryId}
          error={errs.categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {activeCategories.length === 0 ? (
            <option value="">No categories yet</option>
          ) : (
            activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isActive ? "" : " (inactive)"}
              </option>
            ))
          )}
        </SelectField>
      </div>

      <TextField
        label="Tags"
        optionalHint
        placeholder="spicy, meaty, shareable, seafood"
        value={tagsInput}
        hint="Comma-separated. Powers smart search and the AI concierge — e.g. spicy, meaty, seafood, light, shareable, grilled."
        onChange={(e) => setTagsInput(e.target.value)}
      />

      <div className="space-y-3 rounded-lg border border-line bg-bg p-4">
        <Toggle
          checked={isActive}
          onChange={setIsActive}
          label="Active"
          description="Off = removed from the live menu (soft-deleted). History is kept."
        />
        <Toggle
          checked={isAvailable}
          onChange={setIsAvailable}
          label="Available"
          description="Off = shown as sold out, can't be added to a cart."
        />
      </div>

      {formError ? <p className="text-[12.5px] text-danger">{formError}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          {mode === "create" ? "Create product" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/products")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
