import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-xl px-5">
      <Skeleton variant="list" />
    </main>
  );
}
