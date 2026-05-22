"use client";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  MessageCircleIcon,
  RefreshCw,
  Send,
  X,
  SearchIcon,
  SparklesIcon,
  ChevronRightIcon,
  ArrowRightIcon,
} from "lucide-react";
import { cn } from "../lib/cn";
import { buttonVariants } from "./ui/button";
import Link from "next/link";
import { type UIMessage, useChat, type UseChatHelpers } from "@ai-sdk/react";
import { useDocsSearch } from "fumadocs-core/search/client";
import { Markdown } from "./markdown";
import * as Popover from "@radix-ui/react-popover";

const Context = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  mode: "search" | "ai";
  setMode: (mode: "search" | "ai") => void;
  chat: any;
} | null>(null);

export function AISearch({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"search" | "ai">("search");

  const chat = useChat({
    id: "search",
  });

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setMode("search");
    }
  }, [open]);

  return (
    <Context.Provider
      value={useMemo(
        () => ({
          chat,
          open,
          setOpen,
          searchQuery,
          setSearchQuery,
          mode,
          setMode,
        }),
        [chat, open, searchQuery, mode]
      )}
    >
      <Popover.Root open={open} onOpenChange={setOpen}>
        {children}
      </Popover.Root>
    </Context.Provider>
  );
}

export function AISearchTrigger({
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <Popover.Trigger className={cn(className)} {...props}>
      {props.children}
    </Popover.Trigger>
  );
}

export function AISearchPanel() {
  const { open, setOpen, searchQuery, setSearchQuery, mode, setMode, chat } =
    useAISearchContext();
  const { search, setSearch, query } = useDocsSearch({ type: "fetch" });
  const results = Array.isArray(query.data) ? query.data : [];

  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery, setSearch]);

  useHotKey();

  const commonQuestions = [
    { q: "What is Inheribase?", icon: <SparklesIcon className="size-3.5" /> },
    {
      q: "How to setup a Guardian?",
      icon: <MessageCircleIcon className="size-3.5" />,
    },
    {
      q: "Heir claim process explained",
      icon: <ArrowRightIcon className="size-3.5" />,
    },
    { q: "Pricing and Gas model", icon: <SearchIcon className="size-3.5" /> },
  ];

  const handleAskAI = (text?: string) => {
    const query = text || searchQuery;
    if (!query) return;
    setMode("ai");
    void chat.append({ role: "user", content: query });
  };

  return (
    <>
      <Popover.Portal>
        <Popover.Content
          align="end"
          side="bottom"
          sideOffset={8}
          className={cn(
            "z-50 w-[420px] overflow-hidden rounded-2xl max-md:w-[95vw]",
            "border-fd-border/60 bg-fd-popover/95 border backdrop-blur-xl",
            "shadow-2xl dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
        >
          <div className="flex max-h-[600px] flex-col">
            {/* Header / Input */}
            <div className="border-fd-border/30 flex items-center gap-2 border-b p-3">
              <SearchIcon className="text-fd-muted-foreground ms-2 size-4" />
              <input
                autoFocus
                value={searchQuery}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery) {
                    if (results.length === 0) {
                      handleAskAI();
                    }
                  }
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (mode === "ai") setMode("search");
                }}
                placeholder="Search documentation or ask AI..."
                className="text-fd-foreground placeholder:text-fd-muted-foreground/50 flex-1 border-none bg-transparent py-1.5 text-sm outline-none"
              />
              <button
                onClick={() => setOpen(false)}
                className="hover:bg-fd-accent text-fd-muted-foreground rounded-md p-1 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="fd-scroll-container flex-1 overflow-y-auto p-2">
              {mode === "search" ? (
                <>
                  {/* AI Primary Action */}
                  {searchQuery && (
                    <button
                      onClick={() => handleAskAI()}
                      className="bg-brand-500/10 border-brand-500/20 hover:bg-brand-500/20 group mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all"
                    >
                      <div className="bg-brand-500 text-dark-950 flex size-8 items-center justify-center rounded-lg">
                        <SparklesIcon className="size-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          Ask "{searchQuery}"
                        </p>
                        <p className="text-fd-muted-foreground text-xs">
                          Find the answer with AI
                        </p>
                      </div>
                      <ArrowRightIcon className="text-brand-500 size-4 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </button>
                  )}

                  {/* Results or Common Questions */}
                  {!searchQuery ? (
                    <div className="py-2">
                      <p className="text-fd-muted-foreground/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
                        Common Questions
                      </p>
                      <div className="space-y-1">
                        {commonQuestions.map((q) => (
                          <button
                            key={q.q}
                            onClick={() => {
                              setSearchQuery(q.q);
                              handleAskAI(q.q);
                            }}
                            className="hover:bg-fd-accent/50 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                          >
                            <span className="text-fd-muted-foreground">
                              {q.icon}
                            </span>
                            <span className="text-sm">{q.q}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-fd-muted-foreground text-sm tracking-tight">
                        No documentation results for "{searchQuery}"
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-fd-muted-foreground/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
                        Documentation
                      </p>
                      {results.map((res: any) => (
                        <Link
                          key={res.url}
                          href={res.url}
                          className="hover:bg-fd-accent group flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors"
                          onClick={() => setOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {res.content || res.title}
                            </span>
                            <ChevronRightIcon className="text-fd-muted-foreground/50 size-3.5 opacity-0 transition-all group-hover:opacity-100" />
                          </div>
                          <span className="text-fd-muted-foreground truncate text-[10px]">
                            {res.url}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-[300px] flex-col gap-4 py-2">
                  <div className="mb-2 flex items-center justify-between px-2">
                    <button
                      onClick={() => setMode("search")}
                      className="text-brand-500 hover:text-brand-400 flex items-center gap-1 text-xs font-medium"
                    >
                      <ChevronRightIcon className="size-3.5 rotate-180" /> Back
                      to Search
                    </button>
                    <button
                      onClick={() => chat.setMessages([])}
                      className="text-fd-muted-foreground hover:text-fd-foreground text-[10px]"
                    >
                      Clear Chat
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col gap-4">
                    {chat.messages
                      .filter((m: UIMessage) => m.role !== "system")
                      .map((m: UIMessage) => (
                        <div
                          key={m.id}
                          className={cn(
                            "flex flex-col gap-1 px-2",
                            m.role === "user" ? "items-end" : "items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-2xl p-3 text-sm",
                              m.role === "user"
                                ? "bg-brand-500 text-dark-950 rounded-tr-none"
                                : "bg-fd-secondary text-fd-foreground border-fd-border/50 rounded-tl-none border"
                            )}
                          >
                            <Markdown
                              text={m.parts
                                .filter(
                                  (
                                    p
                                  ): p is Extract<typeof p, { type: "text" }> =>
                                    p.type === "text"
                                )
                                .map((p) => p.text)
                                .join("")}
                            />
                          </div>
                        </div>
                      ))}
                  </div>

                  {(chat.status === "streaming" ||
                    chat.status === "submitted") && (
                    <div className="text-fd-muted-foreground mt-auto flex animate-pulse items-center gap-2 px-3 pb-4 text-xs">
                      <Loader2 className="text-brand-500 size-3 animate-spin" />{" "}
                      Inheribase AI is composing...
                    </div>
                  )}

                  <div className="border-fd-border/30 mt-auto border-t px-2 pb-2 pt-4">
                    <form
                      className="bg-fd-secondary/50 ring-brand-500/50 flex items-center gap-2 rounded-xl p-1.5 transition-all focus-within:ring-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const input = (e.target as any).message.value;
                        if (!input) return;
                        void chat.append({ role: "user", content: input });
                        (e.target as any).message.value = "";
                      }}
                    >
                      <input
                        name="message"
                        autoFocus
                        className="flex-1 border-none bg-transparent px-2 py-1 text-sm outline-none"
                        placeholder="Ask a follow up..."
                      />
                      <button className="bg-brand-500 text-dark-950 hover:bg-brand-400 rounded-lg p-2 transition-all">
                        <Send className="size-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </>
  );
}

export function useHotKey() {
  const { open, setOpen } = useAISearchContext();

  const onKeyPress = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      setOpen(false);
      e.preventDefault();
    }

    if (e.key === "k" && (e.metaKey || e.ctrlKey) && !open) {
      setOpen(true);
      e.preventDefault();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyPress);
    return () => window.removeEventListener("keydown", onKeyPress);
  }, []);
}

export function useAISearchContext() {
  return use(Context)!;
}
