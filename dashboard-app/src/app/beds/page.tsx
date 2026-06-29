import { getBeds } from "@/lib/beds";
import { resolveActiveBed } from "@/lib/activeBed";
import CreateBedForm from "@/components/CreateBedForm";
import BedRenameButton from "@/components/BedRenameButton";
import Badge from "@/components/Badge";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  agent: "агент",
  user: "человек",
};

const TYPE_CLASS: Record<string, string> = {
  agent: "bg-violet-100 text-violet-700 ring-violet-200",
  user: "bg-sky-100 text-sky-700 ring-sky-200",
};

export default async function BedsPage({
  searchParams,
}: {
  searchParams: Promise<{ bed?: string }>;
}) {
  const sp = await searchParams;
  const beds = getBeds();
  const activeBed = await resolveActiveBed(sp.bed);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Грядки</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Пространства внутри Огорода — каждая со своими проектами и инбоксом.
        </p>
      </div>

      {/* Список грядок */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Все грядки · {beds.length}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {beds.map((bed) => (
            <div
              key={bed.id}
              className={`rounded-xl border p-4 ${
                bed.id === activeBed.id
                  ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-neutral-900">{bed.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-neutral-400">{bed.id}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={TYPE_CLASS[bed.type] ?? TYPE_CLASS.agent}>
                    {TYPE_LABEL[bed.type] ?? bed.type}
                  </Badge>
                  {bed.isDefault && (
                    <Badge className="bg-neutral-100 text-neutral-500 ring-neutral-200">
                      по умолч.
                    </Badge>
                  )}
                </div>
              </div>
              {bed.id === activeBed.id && (
                <p className="mt-2 text-xs text-violet-600 font-medium">активная</p>
              )}
              <p className="mt-2 break-all font-mono text-[11px] text-neutral-300">
                {bed.projectsDir}
              </p>
              <div className="mt-2 flex items-center justify-end border-t border-neutral-100 pt-2">
                <BedRenameButton id={bed.id} name={bed.name} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Форма создания */}
      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Новая грядка
        </h2>
        <CreateBedForm />
      </section>
    </div>
  );
}
