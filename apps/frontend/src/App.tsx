import { useState } from "react";

type ViewMode = "code" | "preview";

const files = [
  { name: "src", depth: 0, kind: "folder", active: false },
  { name: "App.tsx", depth: 1, kind: "file", active: true },
  { name: "components", depth: 1, kind: "folder", active: false },
  { name: "Hero.tsx", depth: 2, kind: "file", active: false },
  { name: "PreviewCard.tsx", depth: 2, kind: "file", active: false },
  { name: "styles", depth: 1, kind: "folder", active: false },
  { name: "theme.css", depth: 2, kind: "file", active: false },
  { name: "package.json", depth: 0, kind: "file", active: false },
];

const codeLines = [
  "export function LandingPage() {",
  "  return (",
  '    <main className="min-h-screen bg-background">',
  '      <section className="mx-auto grid max-w-5xl gap-8 px-6 py-20">',
  '        <span className="text-sm font-medium text-accent">',
  "          Generated preview",
  "        </span>",
  '        <h1 className="text-5xl font-semibold tracking-tight">',
  "          Build launch-ready product pages in minutes.",
  "        </h1>",
  '        <button className="w-fit rounded-lg bg-primary px-4 py-2">',
  "          Start building",
  "        </button>",
  "      </section>",
  "    </main>",
  "  );",
  "}",
];

const messages = [
  {
    role: "assistant",
    text: "I created the first pass of the landing page structure and wired the hero section into the preview.",
  },
  {
    role: "user",
    text: "Make it feel cleaner and add a stronger call to action.",
  },
  {
    role: "assistant",
    text: "Updated the spacing, simplified the color system, and added a focused CTA row.",
  },
];

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("code");

  return (
    <main className="min-h-dvh bg-[var(--app-bg)] text-[var(--text)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
              L
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-5">
                Loveable Workspace
              </h1>
              <p className="hidden text-xs text-[var(--muted)] sm:block">
                app-builder / landing-page
              </p>
            </div>
          </div>

          <div className="grid h-9 grid-cols-2 rounded-lg border border-[var(--border)] bg-[var(--control)] p-1 text-sm">
            {(["code", "preview"] as const).map((mode) => (
              <button
                className={`h-7 min-w-20 rounded-md px-3 font-medium transition ${
                  viewMode === mode
                    ? "bg-[var(--control-active)] text-[var(--text)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
                key={mode}
                onClick={() => setViewMode(mode)}
                type="button"
              >
                {mode === "code" ? "Code" : "Preview"}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-2 text-xs text-[var(--muted)] md:flex">
            <span className="rounded-full border border-[var(--border)] px-2.5 py-1">
              Synced
            </span>
            <button
              className="grid size-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--control)] text-[var(--muted)] transition hover:text-[var(--text)]"
              type="button"
              aria-label="Open settings"
            >
              ...
            </button>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-h-0 overflow-hidden p-3 sm:p-4">
            {viewMode === "code" ? <CodeWorkspace /> : <PreviewWorkspace />}
          </section>

          <ChatPanel />
        </div>
      </div>
    </main>
  );
}

function CodeWorkspace() {
  return (
    <div className="grid h-full min-h-[680px] grid-cols-1 gap-3 md:grid-cols-[240px_minmax(0,1fr)] lg:min-h-0">
      <aside className="flex min-h-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--panel)]">
        <div className="flex h-11 items-center justify-between border-b border-[var(--border)] px-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Files
          </span>
          <button
            className="grid size-7 place-items-center rounded-md text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--text)]"
            type="button"
            aria-label="Add file"
          >
            +
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {files.map((file) => (
            <button
              className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition ${
                file.active
                  ? "bg-[var(--selected)] text-[var(--text)]"
                  : "text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--text)]"
              }`}
              key={`${file.depth}-${file.name}`}
              style={{ paddingLeft: `${file.depth * 18 + 8}px` }}
              type="button"
            >
              <span className="w-4 text-center text-xs">
                {file.kind === "folder" ? ">" : "-"}
              </span>
              <span className="truncate">{file.name}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--editor)]">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--accent)]" />
            <span className="truncate text-sm font-medium">App.tsx</span>
          </div>
          <span className="text-xs text-[var(--muted)]">React + Tailwind</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-6">
          {codeLines.map((line, index) => (
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)]" key={line}>
              <span className="select-none pr-4 text-right text-[var(--line-number)]">
                {index + 1}
              </span>
              <code className="whitespace-pre text-[var(--code)]">{line}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PreviewWorkspace() {
  return (
    <section className="flex h-full min-h-[680px] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] lg:min-h-0">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-red-400" />
          <span className="size-3 rounded-full bg-yellow-400" />
          <span className="size-3 rounded-full bg-green-400" />
        </div>
        <span className="truncate rounded-full bg-[var(--control)] px-3 py-1 text-xs text-[var(--muted)]">
          preview.local
        </span>
        <span className="hidden text-xs text-[var(--muted)] sm:block">
          1440 x 900
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--preview-bg)] p-4 sm:p-8">
        <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-between rounded-lg border border-[var(--preview-border)] bg-[var(--preview-surface)] p-6 shadow-xl shadow-black/5 sm:p-10">
          <nav className="flex items-center justify-between">
            <span className="text-sm font-semibold">Northstar</span>
            <div className="hidden gap-5 text-sm text-[var(--preview-muted)] sm:flex">
              <span>Product</span>
              <span>Pricing</span>
              <span>Docs</span>
            </div>
          </nav>

          <div className="grid gap-8 py-14 sm:py-20">
            <span className="w-fit rounded-full bg-[var(--preview-chip)] px-3 py-1 text-sm font-medium text-[var(--accent)]">
              Generated in the workspace
            </span>
            <div className="max-w-3xl space-y-5">
              <h2 className="text-4xl font-semibold leading-tight text-[var(--preview-text)] sm:text-6xl">
                Ship cleaner product pages with an AI design partner.
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-[var(--preview-muted)]">
                Plan, edit, preview, and refine application screens from one
                focused workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="h-11 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-lg shadow-teal-500/20">
                Start building
              </button>
              <button className="h-11 rounded-lg border border-[var(--preview-border)] px-5 text-sm font-semibold text-[var(--preview-text)]">
                View template
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {["Design system", "Live preview", "Code handoff"].map((item) => (
              <div
                className="rounded-lg border border-[var(--preview-border)] p-4"
                key={item}
              >
                <p className="text-sm font-semibold text-[var(--preview-text)]">
                  {item}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--preview-muted)]">
                  A focused block for validating the generated app experience.
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatPanel() {
  return (
    <aside className="flex min-h-[620px] flex-col border-t border-[var(--border)] bg-[var(--panel)] lg:min-h-0 lg:border-l lg:border-t-0">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div>
          <h2 className="text-sm font-semibold">Assistant</h2>
          <p className="text-xs text-[var(--muted)]">UI generation session</p>
        </div>
        <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-xs font-medium text-[var(--success)]">
          Ready
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-5">
        {messages.map((message, index) => (
          <div
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
            key={`${message.role}-${index}`}
          >
            <div
              className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-[var(--chat-bubble)] text-[var(--text)]"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <form className="border-t border-[var(--border)] p-4">
        <label className="sr-only" htmlFor="prompt">
          Message
        </label>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-2 focus-within:border-[var(--accent)]">
          <textarea
            className="h-24 w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            id="prompt"
            placeholder="Ask the assistant to change the UI..."
          />
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[var(--muted)]">UI only mock</span>
            <button
              className="h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              type="button"
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}

export default App;
