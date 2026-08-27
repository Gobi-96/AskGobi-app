"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { consumeAnswer } from "@/lib/ndjson";
import {
  AUTH_CHANGED_EVENT,
  fetchSupabaseUser,
  getStoredToken,
  hasSupabaseConfig,
} from "@/lib/supabaseAuth";
import {
  createConversation,
  createProject,
  deleteProject,
  deleteConversation,
  insertMessages,
  listConversations,
  listMessages,
  listProjects,
  renameProject,
  renameConversation,
  setConversationProject,
  touchConversation,
  type ConversationRow,
  type MessageRow,
  type ProjectRow,
} from "@/lib/supabaseHistory";

interface Message {
  question: string;
  answer: string;
  answerHistory: string[];
  answerIndex: number;
  status?: "complete" | "error" | "stopped";
  notice?: string;
}

function toTitleFromPrompt(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  return cleaned.length > 80 ? `${cleaned.slice(0, 80)}...` : cleaned;
}

function groupRows(rows: MessageRow[]): Message[] {
  const grouped: Message[] = [];
  for (const row of rows) {
    if (row.role === "user") {
      grouped.push({
        question: row.content,
        answer: "",
        answerHistory: [],
        answerIndex: 0,
      });
      continue;
    }

    if (!grouped.length) continue;
    const last = grouped[grouped.length - 1];
    if (!last.answer) {
      last.answer = row.content;
      last.answerHistory = [row.content];
      last.answerIndex = 0;
    } else {
      last.answerHistory.push(row.content);
      last.answer = row.content;
      last.answerIndex = last.answerHistory.length - 1;
    }
  }
  return grouped;
}

export function useAskGobi() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("Thinking…");
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  useEffect(() => () => abortController?.abort(), [abortController]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  const activeConversationIdRef = useRef<string | null>(null);
  const selectedProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);
  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  const loadHistory = useCallback(async () => {
    if (!hasSupabaseConfig()) return;
    const token = getStoredToken();
    if (!token) {
      setIsAuthed(false);
      setCurrentUserEmail("");
      setProjects([]);
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    const user = await fetchSupabaseUser(token);
    if (!user) {
      setIsAuthed(false);
      setCurrentUserEmail("");
      setProjects([]);
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    setIsAuthed(true);
    setCurrentUserEmail(user.email || "");
    setHistoryLoading(true);
    try {
      const projs = await listProjects(token);
      setProjects(projs);
      const convs = await listConversations(token, 30);
      setConversations(convs);
      // Always land on a fresh new-chat view on app load.
      activeConversationIdRef.current = null;
      setActiveConversationId(null);
      setSelectedProjectId(null);
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    const onAuthChanged = () => {
      void loadHistory();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, [loadHistory]);

  async function openConversation(conversationId: string) {
    if (thinking) return;
    const token = getStoredToken();
    if (!token) return;
    setHistoryLoading(true);
    try {
      const rows = await listMessages(token, conversationId, 300);
      const current = conversations.find((c) => c.id === conversationId);
      if (current) {
        setSelectedProjectId(current.project_id || null);
      }
      activeConversationIdRef.current = conversationId;
      setActiveConversationId(conversationId);
      setMessages(groupRows(rows));
    } finally {
      setHistoryLoading(false);
    }
  }

  function startNewConversation(projectId?: string | null) {
    if (thinking) return;
    if (typeof projectId !== "undefined") {
      setSelectedProjectId(projectId);
    }
    activeConversationIdRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
  }

  async function persistExchange(params: {
    query: string;
    answer: string;
    replaceLast: boolean;
    preserveLastHistory: boolean;
  }) {
    const token = getStoredToken();
    if (!token) return;

    let conversationId = activeConversationIdRef.current;
    if (!conversationId) {
      const created = await createConversation(
        token,
        toTitleFromPrompt(params.query),
        selectedProjectIdRef.current
      );
      if (!created) return;
      conversationId = created.id;
      activeConversationIdRef.current = conversationId;
      setActiveConversationId(conversationId);
      setConversations((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    } else {
      await touchConversation(token, conversationId);
      setConversations((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((c) => c.id === conversationId);
        if (idx > -1) {
          const current = updated[idx];
          updated.splice(idx, 1);
          updated.unshift({ ...current, updated_at: new Date().toISOString() });
          return updated;
        }
        return updated;
      });
    }

    if (params.replaceLast && params.preserveLastHistory) {
      await insertMessages(token, conversationId, [{ role: "assistant", content: params.answer }]);
      return;
    }

    await insertMessages(token, conversationId, [
      { role: "user", content: params.query },
      { role: "assistant", content: params.answer },
    ]);
  }

  async function runAsk(
    query: string,
    onlineMode: boolean = false,
    opts: { replaceLast?: boolean; preserveLastHistory?: boolean } = {}
  ) {
    if (!query.trim() || thinking) return;

    const replaceLast = Boolean(opts.replaceLast);
    const preserveLastHistory = Boolean(opts.preserveLastHistory);
    const isFirstQuestion = !replaceLast && messages.length === 0;
    const context = (replaceLast ? messages.slice(0, -1) : messages).slice(-3).map((message) => ({
      question: message.question.slice(0, 500), answer: message.answer.slice(0, 4000),
    }));
    const previous = replaceLast ? messages[messages.length - 1] : null;
    const previousHistory = preserveLastHistory
      ? previous?.answerHistory?.length
        ? previous.answerHistory
        : previous?.answer
          ? [previous.answer]
          : []
      : [];

    const newMessage: Message = {
      question: query,
      answer: "",
      answerHistory: previousHistory,
      answerIndex: previousHistory.length,
    };

    setMessages((prev) =>
      replaceLast
        ? prev.length > 0
          ? [...prev.slice(0, -1), newMessage]
          : [newMessage]
        : [...prev, newMessage]
    );
    setThinking(true);
    setIsTyping(false);

    const controller = new AbortController();
    let phaseTimer: ReturnType<typeof setTimeout> | null = null;
    setAbortController(controller);

    try {
      setThinkingLabel("Thinking…");
      if (isFirstQuestion) {
        phaseTimer = setTimeout(() => {
          setThinkingLabel("Still working on your question…");
        }, 3000);
      }

      await new Promise((r) => setTimeout(r, 500));

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ query, context, onlineMode }),
      });

      if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson?.error) errMsg = String(errJson.error);
        } catch {}
        throw new Error(errMsg);
      }

      const finalText = await consumeAnswer(res, (partial) => {
        if (phaseTimer) { clearTimeout(phaseTimer); phaseTimer = null; }
        setIsTyping(true);
        setMessages((prev) => prev.map((m, i) => i === prev.length - 1 ? { ...m, answer: partial } : m));
      });
      const finalCleaned = finalText;

      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? {
                ...m,
                answer: finalCleaned,
                status: "complete",
                answerHistory: [...m.answerHistory, finalCleaned],
                answerIndex: m.answerHistory.length,
              }
            : m
        )
      );

      try {
        await persistExchange({ query, answer: finalCleaned, replaceLast, preserveLastHistory });
      } catch {
        setMessages((prev) => prev.map((m, i) => i === prev.length - 1
          ? { ...m, notice: "Your answer is here, but we couldn’t save it to your history." } : m));
      }
    } catch (err: any) {
      const msg =
        err?.name === "AbortError"
          ? "Stopped by user."
          : err?.message || "Request failed. Check Ollama connection and model.";

      setMessages((prev) => prev.map((m, i) => (i === prev.length - 1
        ? { ...m, status: err?.name === "AbortError" ? "stopped" : "error", notice: msg }
        : m)));
      console.error(err);
    } finally {
      if (phaseTimer) clearTimeout(phaseTimer);
      setThinking(false);
      setIsTyping(false);
      setThinkingLabel("Thinking…");
      setAbortController(null);
    }
  }

  async function handleAsk(query: string, onlineMode: boolean = false) {
    return runAsk(query, onlineMode);
  }

  async function regenerateLastMessage(onlineMode: boolean = false) {
    const last = messages[messages.length - 1];
    if (!last) return;
    return runAsk(last.question, onlineMode, {
      replaceLast: true,
      preserveLastHistory: true,
    });
  }

  async function editLastMessage(newQuestion: string, onlineMode: boolean = false) {
    return runAsk(newQuestion, onlineMode, {
      replaceLast: true,
      preserveLastHistory: false,
    });
  }

  function viewLastResponseVariant(direction: "prev" | "next") {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const lastIdx = prev.length - 1;
      const last = prev[lastIdx];
      if (!last.answerHistory.length) return prev;

      const nextIndex =
        direction === "prev"
          ? Math.max(0, last.answerIndex - 1)
          : Math.min(last.answerHistory.length - 1, last.answerIndex + 1);
      if (nextIndex === last.answerIndex) return prev;

      const next = [...prev];
      next[lastIdx] = {
        ...last,
        answerIndex: nextIndex,
        answer: last.answerHistory[nextIndex],
        status: "complete",
        notice: undefined,
      };
      return next;
    });
  }

  async function createProjectFolder(name: string): Promise<boolean> {
    const token = getStoredToken();
    if (!token || !name.trim()) return false;
    const created = await createProject(token, name.trim());
    if (!created) return false;
    setProjects((prev) => [...prev, created]);
    setSelectedProjectId(created.id);
    await loadHistory();
    return true;
  }

  async function renameActiveConversation(title: string) {
    const token = getStoredToken();
    const id = activeConversationIdRef.current;
    if (!token || !id || !title.trim()) return;
    const ok = await renameConversation(token, id, title.trim());
    if (!ok) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title.trim() } : c))
    );
  }

  async function renameConversationById(conversationId: string, title: string): Promise<boolean> {
    const token = getStoredToken();
    if (!token || !conversationId || !title.trim()) return false;
    const ok = await renameConversation(token, conversationId, title.trim());
    if (!ok) return false;
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, title: title.trim() } : c))
    );
    return true;
  }

  async function deleteConversationById(conversationId: string): Promise<boolean> {
    const token = getStoredToken();
    if (!token || !conversationId) return false;
    const ok = await deleteConversation(token, conversationId);
    if (!ok) return false;
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (activeConversationIdRef.current === conversationId) {
      activeConversationIdRef.current = null;
      setActiveConversationId(null);
      setMessages([]);
    }
    return true;
  }

  async function renameProjectFolder(projectId: string, name: string): Promise<boolean> {
    const token = getStoredToken();
    if (!token || !projectId || !name.trim()) return false;
    const ok = await renameProject(token, projectId, name.trim());
    if (!ok) return false;
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, name: name.trim() } : p)));
    return true;
  }

  async function deleteProjectFolder(projectId: string): Promise<boolean> {
    const token = getStoredToken();
    if (!token || !projectId) return false;
    const ok = await deleteProject(token, projectId);
    if (!ok) return false;
    if (selectedProjectIdRef.current === projectId) {
      selectedProjectIdRef.current = null;
      setSelectedProjectId(null);
      activeConversationIdRef.current = null;
      setActiveConversationId(null);
      setMessages([]);
    }
    await loadHistory();
    return true;
  }

  async function moveActiveConversationToProject(projectId: string | null) {
    const token = getStoredToken();
    const id = activeConversationIdRef.current;
    if (!token || !id) return;
    const ok = await setConversationProject(token, id, projectId);
    if (!ok) return;
    setSelectedProjectId(projectId);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, project_id: projectId } : c))
    );
  }

  return {
    messages,
    setMessages,
    thinking,
    setThinking,
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
    renameActiveConversation,
    renameConversationById,
    deleteConversationById,
    moveActiveConversationToProject,
    reloadHistory: loadHistory,
  };
}
