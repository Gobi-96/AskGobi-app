import { getSupabaseRestConfig } from "@/lib/supabaseAuth";

export interface ProjectRow {
  id: string;
  name: string;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  title: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: number;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

function authHeaders(token: string) {
  const { anonKey } = getSupabaseRestConfig();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function listProjects(token: string): Promise<ProjectRow[]> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(`${url}/rest/v1/projects?select=id,name,created_at&order=created_at.asc`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return [];
  return (await res.json()) as ProjectRow[];
}

export async function createProject(token: string, name: string): Promise<ProjectRow | null> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(`${url}/rest/v1/projects`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ name }]),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as ProjectRow[];
  return rows[0] || null;
}

export async function renameProject(token: string, projectId: string, name: string): Promise<boolean> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(`${url}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  return res.ok;
}

export async function deleteProject(token: string, projectId: string): Promise<boolean> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(`${url}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return res.ok;
}

export async function listConversations(token: string, limit: number = 50): Promise<ConversationRow[]> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(
    `${url}/rest/v1/conversations?select=id,title,project_id,created_at,updated_at&order=updated_at.desc&limit=${limit}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) return [];
  return (await res.json()) as ConversationRow[];
}

export async function createConversation(
  token: string,
  title: string,
  projectId?: string | null
): Promise<ConversationRow | null> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(`${url}/rest/v1/conversations`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ title, project_id: projectId || null }]),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as ConversationRow[];
  return rows[0] || null;
}

export async function renameConversation(token: string, conversationId: string, title: string): Promise<boolean> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(`${url}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ title, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

export async function deleteConversation(token: string, conversationId: string): Promise<boolean> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(`${url}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return res.ok;
}

export async function setConversationProject(
  token: string,
  conversationId: string,
  projectId: string | null
): Promise<boolean> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(`${url}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ project_id: projectId, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

export async function touchConversation(token: string, conversationId: string): Promise<void> {
  const { url } = getSupabaseRestConfig();
  await fetch(`${url}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });
}

export async function listMessages(
  token: string,
  conversationId: string,
  limit: number = 300
): Promise<MessageRow[]> {
  const { url } = getSupabaseRestConfig();
  const res = await fetch(
    `${url}/rest/v1/messages?select=id,conversation_id,role,content,created_at&conversation_id=eq.${encodeURIComponent(
      conversationId
    )}&order=created_at.asc&limit=${limit}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) return [];
  return (await res.json()) as MessageRow[];
}

export async function insertMessages(
  token: string,
  conversationId: string,
  rows: Array<{ role: "user" | "assistant"; content: string }>
): Promise<boolean> {
  if (!rows.length) return true;
  const { url } = getSupabaseRestConfig();
  const payload = rows.map((r) => ({
    conversation_id: conversationId,
    role: r.role,
    content: r.content,
  }));
  const res = await fetch(`${url}/rest/v1/messages`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return res.ok;
}
