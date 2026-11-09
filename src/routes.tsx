import { Activity, BookOpenCheck, Building, Building2, ClipboardList, Eye, FolderKanban, LifeBuoy, MessagesSquare, Settings2, Tent, UsersRound } from "lucide-react";
import { Navigate, Outlet } from "react-router";

import { defineAppRoutes } from "@nocobase/portal-sdk/routing";

// The bundled Registry routes are examples; the strategy consulting platform defines
// its own navigation below. Providers, adapters and /dev showcases stay available.
export const registryRoutesEnabled = false;

// 运营管理 is for ops and consulting admins (root passes every role check).
const OPS_ACCESS = { roles: { anyOf: ["dz_ops", "dz_consult_admin"] } };

export const appRoutes = defineAppRoutes([
  {
    name: "projects",
    path: "/projects",
    lazy: () => import("@/pages/projects/list"),
    resource: {
      meta: {
        label: "我的项目",
        priority: 1,
        icon: <FolderKanban />,
      },
    },
  },
  {
    // Project workspace: rendered full-width with its own project navigation
    // (see Layout), so it is not a sidebar menu item.
    name: "project",
    path: "/projects/:projectId",
    lazy: () => import("@/pages/projects/project-layout"),
    outlet: "manual",
    children: [
      { name: "project.index", index: true, element: <Navigate to="overview" replace /> },
      { name: "project.overview", path: "overview", lazy: () => import("@/pages/projects/overview") },
      { name: "project.workspace", path: "workspace", lazy: () => import("@/pages/projects/workspace") },
      { name: "project.workspace.artifact", path: "workspace/:code", lazy: () => import("@/pages/projects/workspace") },
      { name: "project.materials", path: "materials", lazy: () => import("@/pages/projects/materials") },
      { name: "project.results", path: "results", lazy: () => import("@/pages/projects/results") },
      // 「成果与定版」和「导出」合并为「成果」；旧链接（通知、书签）跳到对应页签。
      { name: "project.artifacts", path: "artifacts", element: <Navigate to="../results" replace /> },
      { name: "project.delivery", path: "delivery", element: <Navigate to="../results" replace /> },
      { name: "project.expert", path: "expert", lazy: () => import("@/pages/projects/expert") },
    ],
  },
  {
    // 示例项目：虚构企业的完整一套表，只读，填表时对照着看。
    name: "sample",
    path: "/sample",
    lazy: () => import("@/pages/sample"),
    resource: {
      meta: { label: "示例项目", priority: 1.5, icon: <Eye /> },
    },
  },
  { name: "sample.table", path: "/sample/:code", lazy: () => import("@/pages/sample") },
  {
    name: "help",
    path: "/help",
    lazy: () => import("@/pages/help"),
    resource: {
      meta: { label: "使用指南", priority: 6, icon: <LifeBuoy /> },
    },
  },
  {
    name: "board",
    path: "/board",
    lazy: () => import("@/pages/board"),
    access: { roles: { anyOf: ["dz_consultant", "dz_consult_admin"] } },
    resource: {
      meta: {
        label: "咨询师工作台",
        priority: 0,
        icon: <ClipboardList />,
      },
    },
  },
  {
    name: "my-enterprise",
    path: "/enterprise",
    lazy: () => import("@/pages/enterprise"),
    access: { roles: { anyOf: ["dz_ent_admin"] } },
    resource: {
      meta: {
        label: "本企业",
        priority: 2,
        icon: <Building />,
      },
    },
  },
  {
    name: "expert",
    path: "/expert",
    lazy: () => import("@/pages/expert/list"),
    resource: {
      meta: { label: "专家咨询", priority: 5, icon: <MessagesSquare /> },
    },
  },
  { name: "expert.detail", path: "/expert/:requestId", lazy: () => import("@/pages/expert/detail") },
  { name: "settings", path: "/settings", lazy: () => import("@/pages/settings") },
  {
    name: "ops",
    path: "/ops",
    element: <Outlet />,
    access: OPS_ACCESS,
    resource: {
      meta: { label: "运营管理", priority: 10, icon: <Settings2 /> },
    },
    children: [
      { name: "ops.index", index: true, element: <Navigate to="board" replace /> },
      {
        name: "ops.board",
        path: "board",
        lazy: () => import("@/pages/ops/board"),
        resource: {
          meta: { label: "运营看板", priority: 0, icon: <Activity /> },
        },
      },
      {
        name: "ops.enterprises",
        path: "enterprises",
        lazy: () => import("@/pages/ops/enterprises"),
        resource: {
          meta: { label: "企业与开通", priority: 1, icon: <Building2 /> },
        },
      },
      { name: "ops.enterprise", path: "enterprises/:enterpriseId", lazy: () => import("@/pages/ops/enterprise-detail") },
      {
        name: "ops.camps",
        path: "camps",
        lazy: () => import("@/pages/ops/camps"),
        resource: {
          meta: { label: "训练营批次", priority: 1.5, icon: <Tent /> },
        },
      },
      { name: "ops.camp", path: "camps/:campId", lazy: () => import("@/pages/ops/camp-detail") },
      {
        name: "ops.team",
        path: "team",
        lazy: () => import("@/pages/ops/team"),
        resource: {
          meta: { label: "咨询团队", priority: 2, icon: <UsersRound /> },
        },
      },
      {
        name: "ops.methods",
        path: "methods",
        lazy: () => import("@/pages/ops/methods"),
        resource: {
          meta: { label: "方法与规则包", priority: 3, icon: <BookOpenCheck /> },
        },
      },
    ],
  },
]);
