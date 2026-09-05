"use client";

import { useRouter } from "next/navigation";
import { adminGetCategories } from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import { useAdminData } from "@/components/admin/useAdminData";
import { PageHeader, Card } from "@/components/admin/primitives";
import { ProductForm } from "@/components/admin/ProductForm";
import { ErrorState, Spinner } from "@/components/ui/feedback";
import { Button } from "@/components/ui/Button";

export default function NewProductPage() {
  const router = useRouter();
  const categories = useAdminData(() => adminGetCategories(), []);

  return (
    <>
      <PageHeader
        title="New product"
        description="Create the product, then add a photo on the next screen."
        backHref="/admin/products"
        backLabel="Products"
      />

      {categories.status === "loading" ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner />
        </div>
      ) : categories.status === "error" ? (
        <ErrorState description={errorMessage(categories.error)} onRetry={() => categories.reload()} />
      ) : (categories.data ?? []).length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted">
            You need at least one category before adding products.
          </p>
          <Button className="mt-3" onClick={() => router.push("/admin/categories")}>
            Add a category
          </Button>
        </Card>
      ) : (
        <Card className="max-w-2xl p-5">
          <ProductForm
            mode="create"
            categories={categories.data!}
            onSaved={(product) => router.replace(`/admin/products/${product.id}/edit?created=1`)}
          />
        </Card>
      )}
    </>
  );
}
