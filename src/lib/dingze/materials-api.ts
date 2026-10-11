import { nocobaseClient } from "@nocobase/portal-sdk/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProfileItem } from "@dingze/shared";

import { type ProjectSummary, spaceHeaders } from "./api";

export type MaterialSummary = { id: number; title: string; kind: "file" | "note"; fileName: string; size: number; chars: number; hasFile: boolean; at: string; by: string; byId: number };
export type MaterialDetail = { id: number; title: string; fileName: string; hasFile: boolean; chars: number; offset: number; text: string };
export type ProfileRecord = { items: ProfileItem[]; rev: number; updatedAt: string | null; updatedBy: string };

const keys = {
  materials: (projectId: number) => ["dingze", "materials", projectId] as const,
  material: (projectId: number, id: number) => ["dingze", "material", projectId, id] as const,
  profile: (projectId: number) => ["dingze", "profile", projectId] as const,
};

const get = <T>(project: ProjectSummary, action: string, query: Record<string, unknown> = {}) =>
  nocobaseClient.action<T>("dingze", action, { method: "GET", query: { projectId: project.id, ...query }, headers: spaceHeaders(project.spaceName) });
const post = <T>(project: ProjectSummary, action: string, body: Record<string, unknown>) =>
  nocobaseClient.action<T>("dingze", action, { body: { projectId: project.id, ...body }, headers: spaceHeaders(project.spaceName) });

/** Upload the original file (kept on the instance's storage, readable only through the project). */
export async function uploadOriginal(file: File): Promise<{ id: number }> {
  const form = new FormData();
  form.append("file", file, file.name);
  return nocobaseClient.action<{ id: number }>("dz_material_files", "create", { body: form });
}

/** Download a material's original through the project-checked endpoint. */
export async function downloadOriginal(project: ProjectSummary, material: { id: number; fileName: string; title: string }) {
  const url = nocobaseClient.buildUrl("dingze:downloadMaterial", { projectId: project.id, id: material.id });
  const response = await fetch(url, { headers: nocobaseClient.getHeaders({ headers: spaceHeaders(project.spaceName) }), credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.errors?.[0]?.message ?? payload?.data?.errors?.[0]?.message ?? `下载失败（${response.status}）`);
  }
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = material.fileName || material.title;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export const readMaterial = (project: ProjectSummary, id: number, offset = 0) => get<MaterialDetail>(project, "getMaterial", { id, offset });

export function useMaterials(project: ProjectSummary) {
  return useQuery({ queryKey: keys.materials(project.id), queryFn: () => get<MaterialSummary[]>(project, "listMaterials") });
}

export function useMaterial(project: ProjectSummary, id: number | null) {
  return useQuery({ queryKey: keys.material(project.id, id ?? 0), queryFn: () => readMaterial(project, id!), enabled: !!id });
}

export function useAddMaterial(project: ProjectSummary) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: { title: string; kind: "file" | "note"; fileName?: string; size?: number; text: string; fileId?: number }) =>
      post<{ id: number; truncated: boolean; searchable: boolean }>(project, "addMaterial", values),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.materials(project.id) }),
  });
}

export function useDeleteMaterial(project: ProjectSummary) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => post(project, "deleteMaterial", { id }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.materials(project.id) }),
  });
}

export function useProfile(project: ProjectSummary) {
  return useQuery({ queryKey: keys.profile(project.id), queryFn: () => get<ProfileRecord>(project, "getProfile") });
}

export function useSaveProfile(project: ProjectSummary) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: { items: ProfileItem[]; baseRev: number }) => post<{ rev: number; items: ProfileItem[] }>(project, "saveProfile", values),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.profile(project.id) }),
  });
}
