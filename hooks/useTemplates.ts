'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { templatesApi } from '@/lib/api/templates';
import type { Permission, TaskTemplate, TemplateSummary, TemplateTask } from '@/types';

type TemplateIndex = { owned: TemplateSummary[]; shared: TemplateSummary[] };
type TemplateDetail = { template: TaskTemplate; isOwner: boolean; permission: Permission | null };

const indexKey = ['templates'] as const;
const templateKey = (id: string) => ['templates', id] as const;

/** See hooks/useTasks for why these writes patch the cache instead of refetching. */
async function patchIndex(
  queryClient: QueryClient,
  patch: (index: TemplateIndex) => TemplateIndex,
): Promise<{ previous: TemplateIndex | undefined }> {
  // `exact`, or this also cancels every ['templates', id] detail query.
  await queryClient.cancelQueries({ queryKey: indexKey, exact: true });
  const previous = queryClient.getQueryData<TemplateIndex>(indexKey);
  if (previous) queryClient.setQueryData(indexKey, patch(previous));
  return { previous };
}

async function patchDetail(
  queryClient: QueryClient,
  templateId: string,
  patch: (detail: TemplateDetail) => TemplateDetail,
): Promise<{ previous: TemplateDetail | undefined }> {
  await queryClient.cancelQueries({ queryKey: templateKey(templateId) });
  const previous = queryClient.getQueryData<TemplateDetail>(templateKey(templateId));
  if (previous) queryClient.setQueryData(templateKey(templateId), patch(previous));
  return { previous };
}

function rollbackDetail(
  queryClient: QueryClient,
  templateId: string,
  context?: { previous: TemplateDetail | undefined },
) {
  if (context?.previous) queryClient.setQueryData(templateKey(templateId), context.previous);
}

function insertTemplateTask(detail: TemplateDetail, task: TemplateTask): TemplateDetail {
  const tasks = detail.template.tasks ?? [];
  if (!task.parentId) {
    return { ...detail, template: { ...detail.template, tasks: [...tasks, task] } };
  }
  return {
    ...detail,
    template: {
      ...detail.template,
      tasks: tasks.map((t) => (t.id === task.parentId ? { ...t, subtasks: [...(t.subtasks ?? []), task] } : t)),
    },
  };
}

function replaceTemplateTask(detail: TemplateDetail, taskId: string, task: TemplateTask): TemplateDetail {
  const tasks = (detail.template.tasks ?? []).map((t) => {
    if (t.id === taskId) return { ...task, subtasks: t.subtasks ?? [] };
    const subtasks = t.subtasks ?? [];
    if (!subtasks.some((s) => s.id === taskId)) return t;
    return { ...t, subtasks: subtasks.map((s) => (s.id === taskId ? task : s)) };
  });
  return { ...detail, template: { ...detail.template, tasks } };
}

function patchTemplateTask(
  detail: TemplateDetail,
  taskId: string,
  data: { title?: string; description?: string },
): TemplateDetail {
  const tasks = (detail.template.tasks ?? []).map((t) => {
    if (t.id === taskId) return { ...t, ...data };
    const subtasks = t.subtasks ?? [];
    if (!subtasks.some((s) => s.id === taskId)) return t;
    return { ...t, subtasks: subtasks.map((s) => (s.id === taskId ? { ...s, ...data } : s)) };
  });
  return { ...detail, template: { ...detail.template, tasks } };
}

function removeTemplateTask(detail: TemplateDetail, taskId: string): TemplateDetail {
  const tasks = (detail.template.tasks ?? [])
    .filter((t) => t.id !== taskId)
    .map((t) => ({ ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== taskId) }));
  return { ...detail, template: { ...detail.template, tasks } };
}

/** Mirrors moveTemplateTask: a promoted subtask lands after its former parent. */
function moveTemplateTaskInDetail(
  detail: TemplateDetail,
  taskId: string,
  newParentId: string | null,
): TemplateDetail {
  const tasks = detail.template.tasks ?? [];
  let moving: TemplateTask | undefined;
  const remaining: TemplateTask[] = [];

  for (const task of tasks) {
    if (task.id === taskId) {
      moving = task;
      continue;
    }
    const subtasks = task.subtasks ?? [];
    const found = subtasks.find((s) => s.id === taskId);
    if (found) {
      moving = found;
      remaining.push({ ...task, subtasks: subtasks.filter((s) => s.id !== taskId) });
    } else {
      remaining.push(task);
    }
  }

  if (!moving) return detail;

  if (newParentId) {
    const demoted: TemplateTask = { ...moving, parentId: newParentId, subtasks: [] };
    return {
      ...detail,
      template: {
        ...detail.template,
        tasks: remaining.map((t) =>
          t.id === newParentId ? { ...t, subtasks: [...(t.subtasks ?? []), demoted] } : t,
        ),
      },
    };
  }

  const promoted: TemplateTask = { ...moving, parentId: null, subtasks: [] };
  const formerParentIndex = remaining.findIndex((t) => t.id === moving?.parentId);
  const next = [...remaining];
  next.splice(formerParentIndex >= 0 ? formerParentIndex + 1 : next.length, 0, promoted);
  return { ...detail, template: { ...detail.template, tasks: next } };
}

function reorderInTemplate(detail: TemplateDetail, orderedIds: string[], parentId?: string | null): TemplateDetail {
  const pos = new Map(orderedIds.map((id, i) => [id, i]));
  const sortByIds = <T extends { id: string }>(arr: T[]): T[] =>
    [...arr].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));

  if (!parentId) {
    return { ...detail, template: { ...detail.template, tasks: sortByIds(detail.template.tasks ?? []) } };
  }
  const tasks = (detail.template.tasks ?? []).map((t) =>
    t.id === parentId ? { ...t, subtasks: sortByIds(t.subtasks ?? []) } : t,
  );
  return { ...detail, template: { ...detail.template, tasks } };
}

/** See hooks/useTasks for why dependent writes must be serialised. */
const templateScope = (templateId: string) => ({ id: `template-${templateId}` });
const indexScope = { id: 'templates' };

export function useTemplates(enabled = true) {
  return useQuery({
    queryKey: indexKey,
    queryFn: () => templatesApi.getAll(),
    // Gated like useShares: the apply sheet is mounted on every task list, and
    // this would otherwise fetch on every list open whether or not it is shown.
    enabled,
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: templateKey(id),
    queryFn: () => templatesApi.getById(id),
    enabled: !!id,
    staleTime: 2000,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: indexScope,
    mutationFn: ({ name, id }: { name: string; id: string }) => templatesApi.create(name, id),
    onMutate: async ({ name, id: newId }) => {
      const now = new Date().toISOString();
      const { previous } = await patchIndex(queryClient, (index) => ({
        ...index,
        owned: [
          ...index.owned,
          {
            id: newId,
            name,
            ownerId: '',
            createdAt: now,
            updatedAt: now,
            role: 'owner' as const,
            _count: { tasks: 0 },
          },
        ],
      }));
      return { previous, newId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(indexKey, context.previous);
    },
    onSuccess: (result, _vars, context) => {
      const previous = queryClient.getQueryData<TemplateIndex>(indexKey);
      if (!previous || !context?.newId) return;
      queryClient.setQueryData(indexKey, {
        ...previous,
        owned: previous.owned.map((t) =>
          t.id === context.newId ? { ...result.template, role: 'owner' as const, _count: { tasks: 0 } } : t,
        ),
      });
    },
  });
}

export function useRenameTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: indexScope,
    mutationFn: ({ id, name }: { id: string; name: string }) => templatesApi.rename(id, name),
    onMutate: async ({ id, name }) => {
      const rename = <T extends { id: string; name: string }>(t: T) => (t.id === id ? { ...t, name } : t);
      const { previous } = await patchIndex(queryClient, (index) => ({
        owned: index.owned.map(rename),
        shared: index.shared.map(rename),
      }));
      const { previous: previousDetail } = await patchDetail(queryClient, id, (detail) => ({
        ...detail,
        template: { ...detail.template, name },
      }));
      return { previous, previousDetail };
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) queryClient.setQueryData(indexKey, context.previous);
      if (context?.previousDetail) queryClient.setQueryData(templateKey(id), context.previousDetail);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: indexScope,
    mutationFn: (id: string) => templatesApi.delete(id),
    onMutate: (id) =>
      patchIndex(queryClient, (index) => ({
        owned: index.owned.filter((t) => t.id !== id),
        shared: index.shared.filter((t) => t.id !== id),
      })),
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(indexKey, context.previous);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: templateKey(id) });
    },
  });
}

export function useCreateTemplateTask(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: templateScope(templateId),
    mutationFn: (data: { id: string; title: string; description?: string; parentId?: string }) =>
      templatesApi.createTask(templateId, data),
    onMutate: async (data) => {
      // The server uses this id — see lib/ids.ts.
      const newId = data.id;
      const { previous } = await patchDetail(queryClient, templateId, (detail) => {
        const siblings = data.parentId
          ? ((detail.template.tasks ?? []).find((t) => t.id === data.parentId)?.subtasks ?? [])
          : (detail.template.tasks ?? []);
        const optimistic: TemplateTask = {
          id: data.id,
          title: data.title,
          description: data.description?.trim() ? data.description : null,
          order: siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1,
          templateId,
          parentId: data.parentId ?? null,
          subtasks: [],
        };
        return insertTemplateTask(detail, optimistic);
      });
      return { previous, newId };
    },
    onError: (_err, _vars, context) => rollbackDetail(queryClient, templateId, context),
    onSuccess: (result, _vars, context) => {
      if (!context?.newId) return;
      const previous = queryClient.getQueryData<TemplateDetail>(templateKey(templateId));
      if (previous) {
        queryClient.setQueryData(
          templateKey(templateId),
          replaceTemplateTask(previous, context.newId, result.task),
        );
      }
    },
  });
}

export function useUpdateTemplateTask(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: templateScope(templateId),
    mutationFn: ({ taskId, data }: { taskId: string; data: { title?: string; description?: string } }) =>
      templatesApi.updateTask(templateId, taskId, data),
    onMutate: ({ taskId, data }) => patchDetail(queryClient, templateId, (d) => patchTemplateTask(d, taskId, data)),
    onError: (_err, _vars, context) => rollbackDetail(queryClient, templateId, context),
    onSuccess: (result, { taskId }) => {
      const previous = queryClient.getQueryData<TemplateDetail>(templateKey(templateId));
      if (previous) {
        queryClient.setQueryData(templateKey(templateId), replaceTemplateTask(previous, taskId, result.task));
      }
    },
  });
}

export function useDeleteTemplateTask(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: templateScope(templateId),
    mutationFn: (taskId: string) => templatesApi.deleteTask(templateId, taskId),
    onMutate: (taskId) => patchDetail(queryClient, templateId, (d) => removeTemplateTask(d, taskId)),
    onError: (_err, _vars, context) => rollbackDetail(queryClient, templateId, context),
  });
}

export function useMoveTemplateTask(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: templateScope(templateId),
    mutationFn: ({ taskId, parentId }: { taskId: string; parentId: string | null }) =>
      templatesApi.moveTask(templateId, taskId, parentId),
    onMutate: ({ taskId, parentId }) =>
      patchDetail(queryClient, templateId, (d) => moveTemplateTaskInDetail(d, taskId, parentId)),
    onError: (_err, _vars, context) => rollbackDetail(queryClient, templateId, context),
    // Only the server knows the renumbered orders — see useMoveTask.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKey(templateId) });
    },
  });
}

export function useReorderTemplateTasks(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: templateScope(templateId),
    mutationFn: ({ orderedIds, parentId }: { orderedIds: string[]; parentId?: string | null }) =>
      templatesApi.reorderTasks(templateId, orderedIds, parentId),
    onMutate: ({ orderedIds, parentId }) =>
      patchDetail(queryClient, templateId, (d) => reorderInTemplate(d, orderedIds, parentId)),
    onError: (_err, _vars, context) => rollbackDetail(queryClient, templateId, context),
  });
}

export function useApplyTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, taskListId }: { templateId: string; taskListId: string }) =>
      templatesApi.apply(templateId, taskListId),
    // The target list is somewhere else entirely; nothing to patch locally.
    onSuccess: (_data, { taskListId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', taskListId] });
    },
  });
}

// Sharing hooks
export function useTemplateShares(templateId: string, enabled = true) {
  return useQuery({
    queryKey: ['template-shares', templateId],
    queryFn: () => templatesApi.getShares(templateId).then((r) => r.shares),
    enabled: enabled && !!templateId,
  });
}

export function useCreateTemplateShare(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: templateScope(templateId),
    mutationFn: ({ email, permission }: { email: string; permission: Permission }) =>
      templatesApi.createShare(templateId, email, permission),
    // The server resolves the email to a user, so there is nothing to show
    // optimistically — this one genuinely needs the response.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-shares', templateId] });
      queryClient.invalidateQueries({ queryKey: indexKey, exact: true });
    },
  });
}

export function useUpdateTemplateShare(templateId: string) {
  const queryClient = useQueryClient();
  const key = ['template-shares', templateId] as const;
  return useMutation({
    scope: templateScope(templateId),
    mutationFn: ({ shareId, permission }: { shareId: string; permission: Permission }) =>
      templatesApi.updateShare(templateId, shareId, permission),
    onMutate: async ({ shareId, permission }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ id: string; permission: Permission }[]>(key);
      if (previous) {
        queryClient.setQueryData(
          key,
          previous.map((s) => (s.id === shareId ? { ...s, permission } : s)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteTemplateShare(templateId: string) {
  const queryClient = useQueryClient();
  const key = ['template-shares', templateId] as const;
  return useMutation({
    scope: templateScope(templateId),
    mutationFn: (shareId: string) => templatesApi.deleteShare(templateId, shareId),
    onMutate: async (shareId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ id: string }[]>(key);
      if (previous) {
        queryClient.setQueryData(
          key,
          previous.filter((s) => s.id !== shareId),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: indexKey, exact: true });
    },
  });
}
