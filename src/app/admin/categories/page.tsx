"use client";

import { useState } from "react";
import {
  adminCreateCategory,
  adminGetCategories,
  adminUpdateCategory,
} from "@/lib/client/endpoints";
import { errorMessage, fieldErrors } from "@/lib/client/errors";
import type { AdminCategory } from "@/lib/client/types";
import { useAdminData } from "@/components/admin/useAdminData";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Card } from "@/components/admin/primitives";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { Toggle } from "@/components/admin/Toggle";
import { TextField } from "@/components/ui/form";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/feedback";

function CategoryRow({
  category,
  onSaved,
}: {
  category: AdminCategory;
  onSaved: (c: AdminCategory) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(category.name);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const [isActive, setIsActive] = useState(category.isActive);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty =
    name.trim() !== category.name ||
    Number(sortOrder) !== category.sortOrder ||
    isActive !== category.isActive;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const saved = await adminUpdateCategory(category.id, {
        name: name.trim(),
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        isActive,
      });
      onSaved(saved);
      toast({ tone: "success", title: "Category saved" });
    } catch (e) {
      const fe = fieldErrors(e);
      setErr(fe.name ?? errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
        <TextField label="Name" value={name} error={err} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Sort"
          inputMode="numeric"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
        <Button size="sm" disabled={!dirty || busy} loading={busy} onClick={() => void save()}>
          Save
        </Button>
      </div>
      <div className="mt-3">
        <Toggle
          checked={isActive}
          onChange={setIsActive}
          label="Active"
          description="Inactive categories are hidden from the storefront. There's no delete - products keep their link."
        />
      </div>
    </Card>
  );
}

function AddCategory({ onCreated }: { onCreated: (c: AdminCategory) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Enter a name.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const created = await adminCreateCategory({
        name: name.trim(),
        sortOrder: sortOrder ? Number(sortOrder) : 0,
      });
      onCreated(created);
      setName("");
      setSortOrder("");
      toast({ tone: "success", title: "Category added" });
    } catch (e2) {
      const fe = fieldErrors(e2);
      setErr(fe.name ?? errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-raise)]"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
        <TextField label="New category" value={name} error={err} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Sort"
          inputMode="numeric"
          placeholder="0"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
        <Button type="submit" size="sm" loading={busy}>
          Add
        </Button>
      </div>
    </form>
  );
}

export default function AdminCategoriesPage() {
  const { data, status, error, reload, setData } = useAdminData(
    () => adminGetCategories(),
    [],
  );

  const upsert = (c: AdminCategory) =>
    setData((prev) => {
      const list = prev ?? [];
      const exists = list.some((x) => x.id === c.id);
      const next = exists ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c];
      return [...next].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    });

  return (
    <>
      <PageHeader
        title="Categories"
        description="Order the menu and hide sections. Categories can't be deleted - deactivate instead."
      />

      {status === "loading" ? (
        <AdminPageSkeleton header={false} rows={6} />
      ) : status === "error" ? (
        <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
      ) : (
        <div className="max-w-2xl space-y-3">
          <AddCategory onCreated={upsert} />
          {(data ?? []).length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted">No categories yet.</p>
          ) : (
            data!.map((c) => <CategoryRow key={c.id} category={c} onSaved={upsert} />)
          )}
        </div>
      )}
    </>
  );
}
