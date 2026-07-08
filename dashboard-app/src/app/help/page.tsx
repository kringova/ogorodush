import Link from "next/link";
import GradeBadge from "@/components/GradeBadge";

export const metadata = {
  title: "Справка — Огород",
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Справка</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Дашборд показывает проекты и задачи из vault и даёт кидать мысли в инбокс
        откуда угодно. Источник данных — markdown-файлы vault; правки задач делает
        агент, дашборд только показывает (и принимает инбокс).
      </p>

      <Section title="Виды">
        <Row name="Проекты" href="/">
          Карточки всех проектов с прогрессом по задачам. Клик по проекту —
          задачи и тело карточки.
        </Row>
        <Row name="Канбан" href="/kanban">
          Задачи по статусам (todo / в работе / готово), фильтр по проекту.
        </Row>
        <Row name="RICE" href="/rice">
          Открытые задачи по убыванию приоритета — «что брать следующим».
        </Row>
        <Row name="Роадмап" href="/roadmap">
          Прогнозный Гант: ожидаемые сроки открытых задач по проекту.
        </Row>
        <Row name="Сгорание" href="/burndown">
          Остаток открытых задач во времени.
        </Row>
        <Row name="Поиск" href="/search">
          По номеру (OGOROD-####), названию, проекту, тексту задачи.
        </Row>
        <Row name="Инбокс" href="/inbox">
          Захват сырых мыслей и список неразобранных записей.
        </Row>
      </Section>

      <Section title="Кинуть мысль в инбокс (в т.ч. с телефона)">
        <p>
          Самый частый сценарий — на ходу. Любой способ создать markdown-файл в{" "}
          <code className="rounded bg-neutral-100 px-1">_inbox/</code> подойдёт:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Со страницы</strong> <Link href="/inbox" className="text-[color:var(--color-accent)] hover:underline">Инбокс</Link>{" "}
            — ввести текст в поле, отправить (создаёт запись + коммит в vault).
          </li>
          <li>
            <strong>С телефона</strong> — добавить дашборд на домашний экран и
            писать в Инбокс, либо завести iOS Shortcut / бот, который кладёт файл
            в <code className="rounded bg-neutral-100 px-1">_inbox/</code> через
            GitHub API.
          </li>
        </ul>
        <p className="mt-2">
          В следующей сессии агент разбирает инбокс: каждая запись становится
          задачей с RICE, запись удаляется. Инбокс не остаётся разобранным
          наполовину.
        </p>
      </Section>

      <Section title="Грейды">
        <div className="flex flex-col gap-4">
          {(
            [
              {
                tier: "junior",
                desc: "sp ≤ 2, механические задачи, модель Haiku. Дешевле всего, берётся по умолчанию для мелких и однозначных задач.",
              },
              {
                tier: "middle",
                desc: "sp 3–5, дефолтный грейд, модель Sonnet. Большинство задач: разработка, рефакторинг, средней сложности исследования.",
              },
              {
                tier: "senior",
                desc: "sp ≥ 8, сложное/рассуждение, модель Opus. Архитектурные решения, трудные дебаги, задачи с неявными требованиями. Эскалация на ступень вверх при затыке.",
              },
            ] as const
          ).map(({ tier, desc }) => (
            <div key={tier} className="flex items-start gap-3">
              <GradeBadge tier={tier} showLabel size="lg" />
              <p className="text-sm text-neutral-600">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Артефакты документации проекта">
        <p>
          У каждого проекта могут быть vault-резидентные документы:{" "}
          <strong>brief</strong> (RFC/замысел, метрики успеха, фазы),{" "}
          <strong>roadmap</strong> (фазы с чеклистами),{" "}
          <strong>decisions</strong> (журнал архитектурных решений),{" "}
          <strong>scenarios</strong> (пользовательские сценарии → smoke-тесты).
          На карточке проекта видны прогресс по фазам роадмапа (фазы: N/M) и
          JTBD — «работа», для которой проект нанят. На странице проекта — блок
          «Документы» с кликабельными ссылками на те доки, что уже есть, и
          серыми заглушками для отсутствующих.
        </p>
      </Section>

      <Section title="Откуда берутся задачи">
        <p>
          Дашборд не редактируется руками. Задачи заводит и двигает агент в vault
          (по методологии Огорода); дашборд читает результат. Чтобы что-то
          поменять в задаче — скажите агенту, а не правьте здесь.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      <div className="mt-3 space-y-1 text-sm leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}

function Row({
  name,
  href,
  children,
}: {
  name: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <p>
      <Link href={href} className="font-medium text-neutral-900 hover:text-[color:var(--color-accent)]">
        {name}
      </Link>{" "}
      — {children}
    </p>
  );
}
