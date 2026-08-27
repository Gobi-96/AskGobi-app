"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  User,
  X,
} from "lucide-react";

import ChatHeader from "@/components/ChatHeader";
import ChatInputBar from "@/components/ChatInputBar";
import ChatMessages from "@/components/ChatMessages";
import EmptyChatScreen from "@/components/EmptyChatScreen";
import { useAskGobi } from "@/app/hooks/useAskGobi";
import { requestAuthModal, requestAuthSignOut } from "@/lib/supabaseAuth";
import { getCard } from "@/lib/curiosity/cards";
import Link from "next/link";
import "./chat.css";

export default function HomePage() {
  const {
    messages,
    thinking,
    isTyping,
    thinkingLabel,
    abortController,
    handleAsk,
    regenerateLastMessage,
    editLastMessage,
    viewLastResponseVariant,
    conversations,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    activeConversationId,
    historyLoading,
    isAuthed,
    currentUserEmail,
    openConversation,
    startNewConversation,
    createProjectFolder,
    renameProjectFolder,
    deleteProjectFolder,
    renameConversationById,
    deleteConversationById,
  } = useAskGobi();

  const { resolvedTheme: theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [question, setQuestion] = useState("");
  const [isEditingLast, setIsEditingLast] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(false);
  const [onlineMode, setOnlineMode] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showAboutDeveloperModal, setShowAboutDeveloperModal] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [projectMenuOpenId, setProjectMenuOpenId] = useState<string | null>(null);
  const [chatMenuOpenId, setChatMenuOpenId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{
    type: "project" | "chat";
    id: string;
    name: string;
  } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "chat" | "project"; id: string; title: string } | null
  >(null);
  const [showSidebarAccountMenu, setShowSidebarAccountMenu] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarContentExpanded = desktopSidebarExpanded || mobileSidebarOpen;
  const isEmpty = messages.length === 0 && !thinking;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [mobileSidebarOpen]);
  useEffect(() => {
    const card = getCard(new URLSearchParams(window.location.search).get("card"));
    if (card) setQuestion(("Tell me more about this: " + card.prompt).slice(0, 500));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking, isTyping]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-menu-trigger]") || target.closest("[data-menu-popover]")) {
        return;
      }
      setProjectMenuOpenId(null);
      setChatMenuOpenId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!showSidebarAccountMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-sidebar-account-menu]")) return;
      setShowSidebarAccountMenu(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showSidebarAccountMenu]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations.slice(0, 20);
    return conversations.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 50);
  }, [conversations, search]);

  const rootChats = useMemo(
    () => conversations.filter((c) => c.project_id === null),
    [conversations]
  );
  const scopedChats = useMemo(
    () =>
      selectedProjectId
        ? conversations.filter((c) => c.project_id === selectedProjectId)
        : rootChats,
    [conversations, rootChats, selectedProjectId]
  );

  const composer = <ChatInputBar question={question} setQuestion={setQuestion}
    thinking={thinking} abortController={abortController}
    askGobi={(q, online) => handleAsk(q, online)} onlineMode={onlineMode}
    setOnlineMode={setOnlineMode} autoFocus={!isEmpty} />;

  if (!mounted) return null;

  return (
    <main
      className={`chat-workspace relative flex h-[100dvh] overflow-hidden transition-colors duration-300 ${
        theme === "light" ? "bg-white text-gray-900" : "bg-[#0d0d0d] text-gray-100"
      }`}
    >
        <>
          <ChatHeader
            onMenuClick={() => setMobileSidebarOpen(true)}
            sidebarExpanded={desktopSidebarExpanded}
          />

          <aside
            aria-label="Chats and projects"
            data-mobile-open={mobileSidebarOpen}
            className={`fixed top-0 left-0 bottom-0 z-[70] w-[88vw] max-w-[320px] md:w-[300px] border-r pt-4 pb-4 transition-all duration-200 md:translate-x-0 ${
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            } ${
              desktopSidebarExpanded ? "md:w-[300px] px-3" : "md:w-[64px] px-2"
            } ${
              theme === "light"
                ? "bg-[#f8f9fb] border-gray-200"
                : "bg-[#101114] border-gray-800"
            }`}
          >
            {sidebarContentExpanded ? (
              <>
                <div className="hidden md:block absolute right-3 top-4">
                  <button
                    type="button"
                    onClick={() => setDesktopSidebarExpanded(false)}
                    className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-700"
                        : "bg-[#17181d] border-gray-700 text-gray-200"
                    }`}
                    title="Collapse sidebar"
                    aria-label="Collapse sidebar"
                  >
                    ◧
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`md:hidden absolute right-4 top-4 inline-flex items-center justify-center text-lg ${
                    theme === "light" ? "text-gray-700" : "text-gray-200"
                  }`}
                  title="Close menu"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
                <div className="space-y-1 mb-3 md:pr-10 mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      startNewConversation(null);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full inline-flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                      theme === "light"
                        ? "text-gray-900 hover:bg-gray-100"
                        : "text-gray-100 hover:bg-[#1a1b20]"
                    }`}
                  >
                    <Plus size={14} />
                    New chat
                  </button>
                  <button
                    type="button"
                      onClick={() => {
                      setSearch("");
                      setShowSearchModal(true);
                    }}
                    className={`w-full inline-flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                      theme === "light"
                        ? "text-gray-900 hover:bg-gray-100"
                        : "text-gray-100 hover:bg-[#1a1b20]"
                    }`}
                  >
                    <Search size={14} />
                    Search chats
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAuthed) {
                        requestAuthModal("signup");
                        return;
                      }
                      setProjectNameDraft("");
                      setShowCreateProjectModal(true);
                    }}
                    className={`w-full inline-flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                      theme === "light"
                        ? "text-gray-900 hover:bg-gray-100"
                        : "text-gray-100 hover:bg-[#1a1b20]"
                    }`}
                  >
                    <FolderPlus size={14} />
                    Create project
                  </button>
                </div>

                <div className="overflow-y-auto h-[calc(100%-210px)] pr-1 space-y-4">
                  <div>
                    <button
                      type="button"
                      onClick={() => setProjectsOpen((v) => !v)}
                      className="w-full inline-flex items-center justify-between text-xs uppercase tracking-wide opacity-70 mb-1 px-1"
                    >
                      <span>Projects</span>
                      {projectsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {projectsOpen && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAuthed) {
                              requestAuthModal("signup");
                              return;
                            }
                            setProjectNameDraft("");
                            setShowCreateProjectModal(true);
                          }}
                          className={`w-full text-left rounded-lg px-2.5 py-2 text-sm inline-flex items-center gap-2 transition ${
                            theme === "light"
                              ? "hover:bg-gray-100 text-gray-900"
                              : "hover:bg-[#1a1b20] text-gray-100"
                          }`}
                        >
                          <FolderPlus size={14} />
                          New project
                        </button>
                        {projects.map((project) => {
                          const isSelected = selectedProjectId === project.id;
                          const showChildren = selectedProjectId
                            ? selectedProjectId === project.id && Boolean(expandedProjects[project.id])
                            : Boolean(expandedProjects[project.id]);
                          const projectChats = conversations.filter((c) => c.project_id === project.id);
                          return (
                            <div key={project.id} className="space-y-1">
                              <div className="group relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const isOpen = Boolean(expandedProjects[project.id]);
                                    const isSameSelected = selectedProjectId === project.id;
                                    if (isSameSelected && isOpen) {
                                      setExpandedProjects({});
                                      setSelectedProjectId(null);
                                    } else {
                                      setSelectedProjectId(project.id);
                                      setExpandedProjects({ [project.id]: true });
                                    }
                                    setMobileSidebarOpen(false);
                                  }}
                                  className={`w-full text-left rounded-lg px-2.5 pr-8 py-2 text-sm inline-flex items-center gap-2 transition ${
                                    isSelected
                                      ? theme === "light"
                                        ? "bg-gray-200 text-gray-900"
                                        : "bg-[#1f2128] text-gray-100"
                                      : theme === "light"
                                        ? "hover:bg-gray-100 text-gray-900"
                                        : "hover:bg-[#1a1b20] text-gray-100"
                                  }`}
                                >
                                  <Folder size={14} />
                                  {project.name}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setChatMenuOpenId(null);
                                    setProjectMenuOpenId((prev) => (prev === project.id ? null : project.id));
                                  }}
                                  data-menu-trigger="project"
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 px-1 py-0.5 text-sm leading-none rounded transition opacity-0 group-hover:opacity-100 ${
                                    theme === "light"
                                      ? "text-gray-700"
                                      : "text-gray-200"
                                  } ${projectMenuOpenId === project.id ? "opacity-100" : ""}`}
                                  title="Project actions"
                                >
                                  ...
                                </button>
                                {projectMenuOpenId === project.id && (
                                  <div
                                    data-menu-popover="project"
                                    className={`absolute right-0 top-8 z-20 min-w-[150px] rounded-lg border shadow-lg ${
                                      theme === "light"
                                        ? "bg-white border-gray-200"
                                        : "bg-[#17181d] border-gray-700"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedProjectId(project.id);
                                        setExpandedProjects({ [project.id]: true });
                                        startNewConversation(project.id);
                                        setProjectMenuOpenId(null);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                      New chat
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRenameTarget({ type: "project", id: project.id, name: project.name });
                                        setRenameDraft(project.name);
                                        setProjectMenuOpenId(null);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                      Rename project
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteTarget({
                                          type: "project",
                                          id: project.id,
                                          title: project.name,
                                        });
                                        setProjectMenuOpenId(null);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                      Delete project
                                    </button>
                                  </div>
                                )}
                              </div>

                              {showChildren && (
                                <div className="ml-4 space-y-1">
                                  {projectChats.map((chat) => (
                                    <div key={chat.id} className="group relative">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void openConversation(chat.id);
                                          setMobileSidebarOpen(false);
                                        }}
                                        className={`w-full text-left rounded-lg px-2 pr-8 py-1.5 text-xs transition ${
                                          activeConversationId === chat.id
                                            ? theme === "light"
                                              ? "bg-gray-200 text-gray-900"
                                              : "bg-[#1f2128] text-gray-100"
                                            : theme === "light"
                                              ? "hover:bg-gray-100 text-gray-900"
                                              : "hover:bg-[#1a1b20] text-gray-100"
                                        }`}
                                      >
                                        {chat.title || "Untitled chat"}
                                      </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setProjectMenuOpenId(null);
                                            setChatMenuOpenId((prev) => (prev === chat.id ? null : chat.id));
                                          }}
                                          data-menu-trigger="chat"
                                        className={`absolute right-1 top-1/2 -translate-y-1/2 px-1 py-0.5 text-xs leading-none rounded transition opacity-0 group-hover:opacity-100 ${
                                          theme === "light"
                                            ? "text-gray-700"
                                            : "text-gray-200"
                                        } ${chatMenuOpenId === chat.id ? "opacity-100" : ""}`}
                                        title="Chat actions"
                                      >
                                        ...
                                      </button>
                                      {chatMenuOpenId === chat.id && (
                                        <div
                                          data-menu-popover="chat"
                                          className={`absolute right-0 top-7 z-20 min-w-[140px] rounded-lg border shadow-lg ${
                                            theme === "light"
                                              ? "bg-white border-gray-200"
                                              : "bg-[#17181d] border-gray-700"
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setRenameTarget({
                                                type: "chat",
                                                id: chat.id,
                                                name: chat.title || "Untitled chat",
                                              });
                                              setRenameDraft(chat.title || "Untitled chat");
                                              setChatMenuOpenId(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                                          >
                                            Edit title
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDeleteTarget({
                                                type: "chat",
                                                id: chat.id,
                                                title: chat.title || "Untitled chat",
                                              });
                                              setChatMenuOpenId(null);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-black/5 dark:hover:bg-white/5"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setChatsOpen((v) => !v)}
                      className="w-full inline-flex items-center justify-between text-xs uppercase tracking-wide opacity-70 mb-1 px-1"
                    >
                      <span>Chats</span>
                      {chatsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {chatsOpen && (
                      <div className="space-y-1">
                        {scopedChats.map((c) => (
                          <div key={c.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => {
                              void openConversation(c.id);
                              setMobileSidebarOpen(false);
                            }}
                            className={`w-full text-left rounded-lg px-2.5 pr-8 py-2 text-sm transition ${
                              activeConversationId === c.id
                                ? theme === "light"
                                  ? "bg-gray-200 text-gray-900"
                                  : "bg-[#1f2128] text-gray-100"
                                : theme === "light"
                                  ? "hover:bg-gray-100 text-gray-900"
                                  : "hover:bg-[#1a1b20] text-gray-100"
                            }`}
                          >
                            {c.title || "Untitled chat"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProjectMenuOpenId(null);
                              setChatMenuOpenId((prev) => (prev === c.id ? null : c.id));
                            }}
                            data-menu-trigger="chat"
                            className={`absolute right-2 top-1/2 -translate-y-1/2 px-1 py-1 text-sm leading-none rounded transition opacity-0 group-hover:opacity-100 ${
                              theme === "light"
                                ? "text-gray-700"
                                : "text-gray-200"
                            }`}
                            title="Chat actions"
                          >
                            ...
                          </button>
                          {chatMenuOpenId === c.id && (
                            <div
                              data-menu-popover="chat"
                              className={`absolute right-0 top-8 z-20 min-w-[140px] rounded-lg border shadow-lg ${
                                theme === "light"
                                  ? "bg-white border-gray-200"
                                  : "bg-[#17181d] border-gray-700"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameTarget({ type: "chat", id: c.id, name: c.title || "Untitled chat" });
                                  setRenameDraft(c.title || "Untitled chat");
                                  setChatMenuOpenId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                              >
                                Edit title
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTarget({
                                    type: "chat",
                                    id: c.id,
                                    title: c.title || "Untitled chat",
                                  });
                                  setChatMenuOpenId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-black/5 dark:hover:bg-white/5"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {historyLoading && <div className="text-xs opacity-60">Loading chats...</div>}
                </div>
              </>
            ) : (
              <div className="hidden md:flex flex-col items-center gap-3 pt-0 h-full">
                <button
                  type="button"
                  onClick={() => setDesktopSidebarExpanded(true)}
                  className={`h-10 w-10 inline-flex items-center justify-center rounded-xl border ${
                    theme === "light"
                      ? "bg-white border-gray-300 text-gray-700"
                      : "bg-[#17181d] border-gray-700 text-gray-200"
                  }`}
                  title="Open sidebar"
                  aria-label="Open sidebar"
                >
                  ◨
                </button>
                <button
                  type="button"
                  onClick={() => {
                    startNewConversation(null);
                  }}
                  className={`h-10 w-10 inline-flex items-center justify-center rounded-xl border ${
                    theme === "light"
                      ? "bg-white border-gray-300 text-gray-700"
                      : "bg-[#17181d] border-gray-700 text-gray-200"
                  }`}
                  title="New chat"
                  aria-label="New chat"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDesktopSidebarExpanded(true);
                    setSearch("");
                    setShowSearchModal(true);
                  }}
                  className={`h-10 w-10 inline-flex items-center justify-center rounded-xl border ${
                    theme === "light"
                      ? "bg-white border-gray-300 text-gray-700"
                      : "bg-[#17181d] border-gray-700 text-gray-200"
                  }`}
                  title="Search chats"
                  aria-label="Search chats"
                >
                  <Search size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthed) {
                      requestAuthModal("signup");
                      return;
                    }
                    setProjectNameDraft("");
                    setShowCreateProjectModal(true);
                    setDesktopSidebarExpanded(true);
                  }}
                  className={`h-10 w-10 inline-flex items-center justify-center rounded-xl border ${
                    theme === "light"
                      ? "bg-white border-gray-300 text-gray-700"
                      : "bg-[#17181d] border-gray-700 text-gray-200"
                  }`}
                  title="New project"
                  aria-label="New project folder"
                >
                  <FolderPlus size={16} />
                </button>
                <div className="mt-auto mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAuthed) {
                        requestAuthModal("login");
                        return;
                      }
                      setDesktopSidebarExpanded(true);
                    }}
                    className={`h-9 w-9 inline-flex items-center justify-center rounded-full border ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-700"
                        : "bg-[#17181d] border-gray-700 text-gray-200"
                    }`}
                    title={isAuthed ? currentUserEmail || "Account" : "Log in"}
                  >
                    <User size={16} />
                  </button>
                </div>
              </div>
            )}

            {sidebarContentExpanded && (
              <>
                {isAuthed ? (
                  <div
                    className={`hidden md:flex absolute left-3 right-3 bottom-3 flex-col gap-2 ${
                      theme === "light" ? "text-gray-700" : "text-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setShowAboutDeveloperModal(true)}
                      className={`w-full inline-flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                        theme === "light"
                          ? "text-gray-900 hover:bg-gray-100"
                          : "text-gray-100 hover:bg-[#1a1b20]"
                      }`}
                      title="About developer"
                    >
                      <Info size={14} />
                      About developer
                    </button>
                    <div
                      data-sidebar-account-menu
                      className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 ${
                        theme === "light"
                          ? "bg-white border-gray-300"
                          : "bg-[#17181d] border-gray-700"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setShowSidebarAccountMenu((v) => !v)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <div
                          className={`h-8 w-8 rounded-full inline-flex items-center justify-center text-sm font-semibold ${
                            theme === "light" ? "bg-gray-100 text-gray-700" : "bg-[#101114] text-gray-200"
                          }`}
                        >
                          {(currentUserEmail?.[0] || "U").toUpperCase()}
                        </div>
                        <div className="text-xs opacity-80 truncate">
                          {currentUserEmail}
                        </div>
                      </button>
                      {showSidebarAccountMenu && (
                        <div
                          className={`absolute left-3 right-3 bottom-[72px] z-[75] rounded-lg border shadow-lg ${
                            theme === "light"
                              ? "bg-white border-gray-200 text-gray-900"
                              : "bg-[#17181d] border-gray-700 text-gray-100"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowSidebarAccountMenu(false);
                              requestAuthModal("login");
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            Use another Google account
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowSidebarAccountMenu(false);
                              requestAuthSignOut();
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            Sign out
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`hidden md:flex absolute left-3 right-3 bottom-3 flex-col gap-2 ${
                      theme === "light" ? "text-gray-700" : "text-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setShowAboutDeveloperModal(true)}
                      className={`w-full inline-flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                        theme === "light"
                          ? "text-gray-900 hover:bg-gray-100"
                          : "text-gray-100 hover:bg-[#1a1b20]"
                      }`}
                      title="About developer"
                    >
                      <Info size={14} />
                      About developer
                    </button>
                    <div
                      className={`rounded-xl border px-3 py-3 ${
                        theme === "light"
                          ? "bg-white border-gray-300"
                          : "bg-[#17181d] border-gray-700"
                      }`}
                    >
                      <p className="text-xs opacity-80 leading-relaxed">
                        Save your history, get better responses, and continue from any device.
                      </p>
                      <button
                      type="button"
                      onClick={() => requestAuthModal("login")}
                      className="mt-2 w-full rounded-lg py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Log in
                    </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {sidebarContentExpanded && (
              <div
                className={`md:hidden absolute left-3 right-3 bottom-3 flex flex-col gap-2 ${
                  theme === "light" ? "text-gray-700" : "text-gray-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setShowAboutDeveloperModal(true)}
                  className={`w-full inline-flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition ${
                    theme === "light"
                      ? "text-gray-900 hover:bg-gray-100"
                      : "text-gray-100 hover:bg-[#1a1b20]"
                  }`}
                  title="About developer"
                >
                  <Info size={14} />
                  About developer
                </button>
                {isAuthed ? (
                  <div
                    data-sidebar-account-menu
                    className={`w-full flex items-center rounded-xl border px-3 py-2 ${
                      theme === "light"
                        ? "bg-white border-gray-300"
                        : "bg-[#17181d] border-gray-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setShowSidebarAccountMenu((v) => !v)}
                      className="flex min-w-0 flex-1 items-center text-left"
                    >
                      <div
                        className={`h-8 w-8 rounded-full inline-flex items-center justify-center text-sm font-semibold ${
                          theme === "light" ? "bg-gray-100 text-gray-700" : "bg-[#101114] text-gray-200"
                        }`}
                      >
                        {(currentUserEmail?.[0] || "U").toUpperCase()}
                      </div>
                      <div className="ml-2 text-xs opacity-80 truncate">{currentUserEmail}</div>
                    </button>
                    {showSidebarAccountMenu && (
                      <div
                        className={`absolute left-3 right-3 bottom-[72px] z-[75] rounded-lg border shadow-lg ${
                          theme === "light"
                            ? "bg-white border-gray-200 text-gray-900"
                            : "bg-[#17181d] border-gray-700 text-gray-100"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowSidebarAccountMenu(false);
                            requestAuthModal("login");
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          Use another Google account
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSidebarAccountMenu(false);
                            requestAuthSignOut();
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`rounded-xl border px-3 py-3 ${
                      theme === "light"
                        ? "bg-white border-gray-300"
                        : "bg-[#17181d] border-gray-700"
                    }`}
                  >
                    <p className="text-xs opacity-80 leading-relaxed">
                      Save your history, get better responses, and continue from any device.
                    </p>
                    <button
                      type="button"
                      onClick={() => requestAuthModal("login")}
                      className="mt-2 w-full rounded-lg py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Log in
                    </button>
                  </div>
                )}
              </div>
            )}
          </aside>

          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-[65] bg-black/40 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          {showCreateProjectModal && (
            <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div
                className={`w-full max-w-lg rounded-2xl border p-6 ${
                  theme === "light"
                    ? "bg-white border-gray-200 text-gray-900"
                    : "bg-[#15161b] border-gray-700 text-gray-100"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-3xl font-semibold">Create project</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateProjectModal(false)}
                    className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-700"
                        : "bg-[#101114] border-gray-700 text-gray-200"
                    }`}
                  >
                    <X size={14} />
                  </button>
                </div>
                <label className="text-sm opacity-80">Project name</label>
                <input
                  value={projectNameDraft}
                  onChange={(e) => setProjectNameDraft(e.target.value)}
                  placeholder="Project name"
                  className={`mt-2 w-full rounded-xl px-4 py-3 border outline-none ${
                    theme === "light"
                      ? "bg-white border-gray-300 text-gray-900"
                      : "bg-[#101114] border-gray-700 text-gray-100"
                  }`}
                />
                <p className="mt-4 text-sm opacity-70">
                  Projects keep related chats together so you can track work by topic.
                </p>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    disabled={!projectNameDraft.trim()}
                    onClick={async () => {
                      const name = projectNameDraft.trim();
                      if (!name) return;
                      const ok = await createProjectFolder(name);
                      if (!ok) {
                        window.alert("Could not create project. Please confirm DB migration and login status.");
                        return;
                      }
                      setShowCreateProjectModal(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                  >
                    Create project
                  </button>
                </div>
              </div>
            </div>
          )}

          {showAboutDeveloperModal && (
            <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div
                className={`w-full max-w-lg rounded-2xl border p-6 ${
                  theme === "light"
                    ? "bg-white border-gray-200 text-gray-900"
                    : "bg-[#15161b] border-gray-700 text-gray-100"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-3xl font-semibold">About developer</h3>
                  <button
                    type="button"
                    onClick={() => setShowAboutDeveloperModal(false)}
                    className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-700"
                        : "bg-[#101114] border-gray-700 text-gray-200"
                    }`}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div
                  className={`rounded-2xl border p-4 ${
                    theme === "light"
                      ? "bg-gray-50 border-gray-200"
                      : "bg-[#101114] border-gray-700"
                  }`}
                >
                  <p className="text-xl font-semibold">Gobishankar Rathinam</p>
                  <p className={`mt-1 text-sm ${theme === "light" ? "text-gray-600" : "text-gray-300"}`}>
                    gobishankar.rathinam@gmail.com
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  <a
                    href="https://www.linkedin.com/in/gobishankar-rathinam"
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full inline-flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                      theme === "light"
                        ? "bg-white border-gray-300 hover:bg-gray-50"
                        : "bg-[#101114] border-gray-700 hover:bg-[#17181d]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#0A66C2] text-white">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M6.94 8.5H3.56V19.5H6.94V8.5ZM5.25 3C4.17 3 3.5 3.71 3.5 4.64C3.5 5.55 4.15 6.29 5.2 6.29H5.22C6.33 6.29 7 5.55 7 4.64C6.98 3.71 6.33 3 5.25 3ZM20.5 12.76C20.5 9.38 18.69 7.8 16.28 7.8C14.33 7.8 13.45 8.87 12.96 9.62V8.5H9.58C9.62 9.24 9.58 19.5 9.58 19.5H12.96V13.36C12.96 13.03 12.98 12.7 13.08 12.46C13.34 11.8 13.94 11.12 14.93 11.12C16.23 11.12 16.75 12.11 16.75 13.56V19.5H20.13V13.17C20.13 9.78 18.33 7.8 16.28 7.8Z" />
                        </svg>
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">LinkedIn</span>
                        <span className={`block text-xs ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>
                          linkedin.com/in/gobishankar-rathinam
                        </span>
                      </span>
                    </span>
                    <span className={`text-sm ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>Open</span>
                  </a>

                  <a
                    href="https://github.com/Gobi-96"
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full inline-flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                      theme === "light"
                        ? "bg-white border-gray-300 hover:bg-gray-50"
                        : "bg-[#101114] border-gray-700 hover:bg-[#17181d]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                          theme === "light" ? "bg-gray-900 text-white" : "bg-white text-gray-900"
                        }`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.59 2 12.25C2 16.78 4.87 20.62 8.84 21.98C9.34 22.08 9.52 21.76 9.52 21.49C9.52 21.25 9.51 20.46 9.5 19.42C6.73 20.04 6.14 18.2 6.14 18.2C5.68 17 5.03 16.68 5.03 16.68C4.12 16.04 5.1 16.06 5.1 16.06C6.1 16.13 6.63 17.11 6.63 17.11C7.52 18.68 8.97 18.23 9.54 17.96C9.63 17.3 9.89 16.85 10.18 16.59C7.97 16.33 5.65 15.44 5.65 11.47C5.65 10.34 6.04 9.42 6.68 8.69C6.58 8.43 6.24 7.38 6.78 5.96C6.78 5.96 7.62 5.68 9.5 6.99C10.3 6.76 11.15 6.64 12 6.64C12.85 6.64 13.7 6.76 14.5 6.99C16.38 5.68 17.22 5.96 17.22 5.96C17.76 7.38 17.42 8.43 17.32 8.69C17.96 9.42 18.35 10.34 18.35 11.47C18.35 15.45 16.02 16.33 13.8 16.58C14.17 16.92 14.5 17.58 14.5 18.6C14.5 20.06 14.49 21.14 14.49 21.49C14.49 21.76 14.67 22.09 15.18 21.98C19.14 20.62 22 16.78 22 12.25C22 6.59 17.52 2 12 2Z" />
                        </svg>
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">GitHub</span>
                        <span className={`block text-xs ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>
                          github.com/Gobi-96
                        </span>
                      </span>
                    </span>
                    <span className={`text-sm ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>Open</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {showSearchModal && (
            <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div
                className={`w-full max-w-2xl rounded-2xl border p-5 ${
                  theme === "light"
                    ? "bg-white border-gray-200 text-gray-900"
                    : "bg-[#15161b] border-gray-700 text-gray-100"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-2xl font-semibold">Search chats</div>
                  <button
                    type="button"
                    onClick={() => setShowSearchModal(false)}
                    className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-700"
                        : "bg-[#101114] border-gray-700 text-gray-200"
                    }`}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div
                  className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 border ${
                    theme === "light"
                      ? "bg-white border-gray-300 text-gray-700"
                      : "bg-[#101114] border-gray-700 text-gray-300"
                  }`}
                >
                  <Search size={14} />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type a chat title..."
                    className="w-full bg-transparent outline-none text-sm"
                  />
                </div>
                <div className="max-h-[45vh] overflow-y-auto space-y-1">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        void openConversation(c.id);
                        setShowSearchModal(false);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                        theme === "light"
                          ? "hover:bg-gray-100 text-gray-900"
                          : "hover:bg-[#1a1b20] text-gray-100"
                      }`}
                    >
                      {c.title || "Untitled chat"}
                    </button>
                  ))}
                  {searchResults.length === 0 && (
                    <div className="text-sm opacity-70 px-2 py-3">No chats found.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {renameTarget && (
            <div className="fixed inset-0 z-[92] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div
                className={`w-full max-w-md rounded-2xl border p-5 ${
                  theme === "light"
                    ? "bg-white border-gray-200 text-gray-900"
                    : "bg-[#15161b] border-gray-700 text-gray-100"
                }`}
              >
                <div className="text-xl font-semibold mb-3">
                  {renameTarget.type === "project" ? "Rename project" : "Rename chat"}
                </div>
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border outline-none ${
                    theme === "light"
                      ? "bg-white border-gray-300 text-gray-900"
                      : "bg-[#101114] border-gray-700 text-gray-100"
                  }`}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRenameTarget(null)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-700"
                        : "bg-[#101114] border-gray-700 text-gray-200"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!renameDraft.trim()}
                    onClick={async () => {
                      if (!renameTarget) return;
                      const name = renameDraft.trim();
                      if (!name) return;
                      if (renameTarget.type === "project") {
                        await renameProjectFolder(renameTarget.id, name);
                      } else {
                        await renameConversationById(renameTarget.id, name);
                      }
                      setRenameTarget(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-[93] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div
                className={`w-full max-w-md rounded-2xl border p-5 ${
                  theme === "light"
                    ? "bg-white border-gray-200 text-gray-900"
                    : "bg-[#15161b] border-gray-700 text-gray-100"
                }`}
              >
                <div className="text-xl font-semibold mb-2">
                  {deleteTarget.type === "project" ? "Delete project" : "Delete chat"}
                </div>
                <p className="text-sm opacity-80">
                  Are you sure you want to delete{" "}
                  <span className="font-medium">"{deleteTarget.title}"</span>?
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-700"
                        : "bg-[#101114] border-gray-700 text-gray-200"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const target = deleteTarget;
                      if (!target) return;
                      if (target.type === "project") {
                        await deleteProjectFolder(target.id);
                      } else {
                        await deleteConversationById(target.id);
                      }
                      setDeleteTarget(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          <section aria-label="Chat workspace" className={`chat-stage ${isEmpty ? "is-empty" : ""} flex-1 transition-all duration-200 ${desktopSidebarExpanded ? "md:ml-[300px]" : "md:ml-[64px]"}`}>
            <div
              ref={scrollRef}
              className="chat-scroll"
            >
              {isEmpty ? (
                <EmptyChatScreen askExample={(example) => { setQuestion(""); void handleAsk(example, onlineMode); }}>{composer}</EmptyChatScreen>
              ) : (
                <div className="chat-thread">
                  <div className="flex flex-col gap-6">
                    {messages.slice(0, -1).map((msg, i) => (
                      <ChatMessages
                        key={i}
                        messages={[msg]}
                        thinking={false}
                        isTyping={false}
                      />
                    ))}
                  </div>

                  {messages.length > 0 && (
                    <>
                      <ChatMessages
                        messages={[messages[messages.length - 1]]}
                        thinking={thinking}
                        isTyping={isTyping}
                        thinkingLabel={thinkingLabel}
                        hideAnswer={isEditingLast}
                      />

                      {isEditingLast && (
                        <div
                          className={`rounded-xl border p-3 mb-3 ${
                            theme === "light"
                              ? "border-gray-300 bg-gray-50"
                              : "border-gray-700 bg-[#151515]"
                          }`}
                        >
                          <input
                            aria-label="Edit prompt"
                            maxLength={500}
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            placeholder="Edit prompt"
                            className={`w-full rounded-lg px-3 py-2 border outline-none ${
                              theme === "light"
                                ? "bg-white border-gray-300 text-gray-900"
                                : "bg-[#111] border-gray-700 text-gray-100"
                            }`}
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={thinking || !editDraft.trim()}
                              onClick={() => {
                                const edited = editDraft.trim();
                                if (!edited) return;
                                setIsEditingLast(false);
                                setEditDraft("");
                                void editLastMessage(edited);
                              }}
                              className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={thinking}
                              onClick={() => {
                                setIsEditingLast(false);
                                setEditDraft("");
                              }}
                              className={`px-3 py-1.5 rounded-lg text-sm border ${
                                theme === "light"
                                  ? "border-gray-300 bg-white text-gray-800"
                                  : "border-gray-700 bg-[#161616] text-gray-200"
                              }`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="chat-response-actions mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={thinking}
                          onClick={() => regenerateLastMessage()}
                          title="Regenerate"
                          aria-label="Retry answer"
                          className={`h-8 w-8 inline-flex items-center justify-center rounded-full border transition ${
                            theme === "light"
                              ? "bg-white border-gray-300 text-gray-800"
                              : "bg-[#161616] border-gray-700 text-gray-200"
                          }`}
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={thinking}
                          onClick={() => {
                            const last = messages[messages.length - 1];
                            if (!last) return;
                            setEditDraft(last.question);
                            setIsEditingLast(true);
                          }}
                          title="Edit prompt"
                          className={`h-8 w-8 inline-flex items-center justify-center rounded-full border transition ${
                            theme === "light"
                              ? "bg-white border-gray-300 text-gray-800"
                              : "bg-[#161616] border-gray-700 text-gray-200"
                          }`}
                        >
                          <Pencil size={14} />
                        </button>

                        {messages[messages.length - 1].answerHistory?.length > 1 && (
                          <>
                            <button
                              type="button"
                              disabled={thinking || messages[messages.length - 1].answerIndex <= 0}
                              onClick={() => viewLastResponseVariant("prev")}
                              title="Previous response"
                              className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                                theme === "light"
                                  ? "bg-white border-gray-300 text-gray-800 disabled:opacity-40"
                                  : "bg-[#161616] border-gray-700 text-gray-200 disabled:opacity-40"
                              }`}
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <div className="text-xs opacity-70 min-w-[56px] text-center">
                              {messages[messages.length - 1].answerIndex + 1}/
                              {messages[messages.length - 1].answerHistory.length}
                            </div>
                            <button
                              type="button"
                              disabled={
                                thinking ||
                                messages[messages.length - 1].answerIndex >=
                                  messages[messages.length - 1].answerHistory.length - 1
                              }
                              onClick={() => viewLastResponseVariant("next")}
                              title="Next response"
                              className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                                theme === "light"
                                  ? "bg-white border-gray-300 text-gray-800 disabled:opacity-40"
                                  : "bg-[#161616] border-gray-700 text-gray-200 disabled:opacity-40"
                              }`}
                            >
                              <ChevronRight size={14} />
                            </button>
                          </>
                        )}

                        {isEditingLast && (
                          <button
                            type="button"
                            disabled={thinking}
                            onClick={() => {
                              setIsEditingLast(false);
                              setEditDraft("");
                            }}
                            title="Cancel edit"
                            className={`h-8 w-8 inline-flex items-center justify-center rounded-full border ${
                              theme === "light"
                                ? "bg-white border-gray-300 text-gray-800"
                                : "bg-[#161616] border-gray-700 text-gray-200"
                            }`}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {!isEmpty && <div className="chat-dock">{composer}</div>}
            <footer className="chat-footer"><span>AI can make mistakes. Stay curious, check the facts.</span><Link href="/">Back to surprises ↗</Link></footer>
          </section>
        </>
    </main>
  );
}
