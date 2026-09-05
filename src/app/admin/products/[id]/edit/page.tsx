"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { adminGetCategories, adminGetProductById } from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import type { AdminProduct } from "@/lib/client/types";
import { useAdminData } from "@/components/admin/useAdminData";
import { PageHeader, Card } from "@/components/admin/primitives";
import { ProductForm } from "@/components/admin/ProductForm";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";

function EditInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const justCreated = search.get("created") === "1";
  const id = params.id;

  const product = useAdminData(() => adminGetProductById(id), [id]);
  const categories = useAdminData(() => adminGetCategories(), []);
  const [local, setLocal] = useState<AdminProduct | null>(null);

  const current = local ?? product.data ?? null;
  const loading = product.status === "loading" || categories.status === "loading";
  const err = product.error ?? categories.error;

  return (
    <>
      <PageHeader
        title={current ? current.name : "Edit product"}
        description={justCreated ? "Created. Add a photo and fine-tune below." : undefined}
        backHref="/admin/products"
        backLabel="Products"
      />

      {loading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner />
        </div>
      ) : err ? (
        <ErrorState description={errorMessage(err)} onRetry={() => product.reload()} />
      ) : !current ? (
        <EmptyState title="Product not found" description="It may have been removed." />
      ) : (
        <div className="grid max-w-4xl gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
          <Card className="p-5">
            <ProductForm
              mode="edit"
              initial={current}
              categories={categories.data ?? []}
              onSaved={setLocal}
            />
          </Card>
          <div className="lg:sticky lg:top-6">
            <ImageUploader
              productId={current.id}
              currentUrl={current.imageUrl}
              onUploaded={(imageUrl, imagePublicId) =>
                setLocal({ ...current, imageUrl, imagePublicId })
              }
            />
          </div>
        </div>
      )}
    </>
  );
}

export default function EditProductPage() {
  return (
    <Suspense fallback={null}>
      <EditInner />
    </Suspense>
  );
}
