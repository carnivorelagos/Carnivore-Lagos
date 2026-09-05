"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageSquare, Plus } from "@phosphor-icons/react";
import {
  adminDeactivateProduct,
  adminGetCategories,
  adminGetProducts,
} from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import { formatNaira } from "@/lib/client/format";
import type { AdminProduct } from "@/lib/client/types";
import { useAdminData } from "@/components/admin/useAdminData";
import { useToast } from "@/components/providers/ToastProvider";
import {
  PageHeader,
  TableWrap,
  thClass,
  tdClass,
  SkeletonRows,
  EmptyRow,
} from "@/components/admin/primitives";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Overlay";
import { ErrorState } from "@/components/ui/feedback";

const PAGE_SIZE = 50;

export default function AdminProductsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const products = useAdminData(() => adminGetProducts({ page, limit: PAGE_SIZE }), [page]);
  const categories = useAdminData(() => adminGetCategories(), []);
  const [toDeactivate, setToDeactivate] = useState<AdminProduct | null>(null);
  const [working, setWorking] = useState(false);

  const categoryName = useMemo(() => {
    const map = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? "-";
  }, [categories.data]);

  const deactivate = useCallback(async () => {
    if (!toDeactivate) return;
    setWorking(true);
    try {
      await adminDeactivateProduct(toDeactivate.id);
      toast({ tone: "success", title: "Product deactivated" });
      setToDeactivate(null);
      products.reload(true);
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't deactivate", description: errorMessage(e) });
    } finally {
      setWorking(false);
    }
  }, [toDeactivate, toast, products]);

  const total = products.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Products"
        description={total ? `${total} in the catalogue (including inactive)` : undefined}
        actions={
          <Link href="/admin/products/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4" aria-hidden /> New product
          </Link>
        }
      />

      {products.status === "error" ? (
        <ErrorState description={errorMessage(products.error)} onRetry={() => products.reload()} />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Product</th>
                <th className={thClass}>Category</th>
                <th className={`${thClass} text-right`}>Price</th>
                <th className={thClass}>State</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.status === "loading" ? (
                <SkeletonRows rows={8} cols={5} />
              ) : products.data!.items.length === 0 ? (
                <EmptyRow colSpan={5}>No products yet. Create the first one.</EmptyRow>
              ) : (
                products.data!.items.map((p) => (
                  <tr key={p.id} className="hover:bg-bg">
                    <td className={tdClass}>
                      <div className="flex items-center gap-2.5">
                        <div className="relative size-9 shrink-0 overflow-hidden rounded border border-line bg-bg">
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt="" fill sizes="36px" className="object-cover" />
                          ) : (
                            <span className="grid size-full place-items-center text-subtle">
                              <ImageSquare className="size-4" aria-hidden />
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-text">{p.name}</span>
                      </div>
                    </td>
                    <td className={`${tdClass} text-muted`}>{categoryName(p.categoryId)}</td>
                    <td className={`${tdClass} text-right tnum font-mono`}>
                      {formatNaira(p.priceKobo)}
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={p.isActive ? "positive" : "neutral"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge tone={p.isAvailable ? "neutral" : "pending"}>
                          {p.isAvailable ? "Available" : "Sold out"}
                        </Badge>
                      </div>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="inline-flex gap-1.5">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          Edit
                        </Link>
                        {p.isActive ? (
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={() => setToDeactivate(p)}
                          >
                            Deactivate
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="tnum text-[12px] text-subtle">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={!!toDeactivate}
        onClose={() => setToDeactivate(null)}
        title="Deactivate product?"
        description={
          toDeactivate
            ? `"${toDeactivate.name}" will be removed from the live menu. It stays in the system and in past orders, and you can reactivate it any time.`
            : ""
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setToDeactivate(null)}>
              Keep active
            </Button>
            <Button variant="danger" size="sm" loading={working} onClick={() => void deactivate()}>
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">This is a soft delete, not a permanent removal.</p>
      </Dialog>
    </>
  );
}
