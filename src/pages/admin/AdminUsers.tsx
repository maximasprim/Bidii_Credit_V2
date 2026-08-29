import { useEffect, useState } from "react";
import { AlertCircle, Pencil, Trash2, RotateCcw, Check, X, Eye, EyeOff } from "lucide-react";
import { adminGet, adminPost, adminPatch, adminDelete, getCurrentAdminId } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import StatusBadge from "../../components/admin/StatusBadge";
import { ADMIN_ROLES, roleLabel, type AdminRole } from "../../lib/roleAccess";
import { getAllBranches } from "../../lib/branchesApi";
import type { Branch } from "../../lib/useBranches";

type AdminUser = {
  id: string;
  username: string;
  role: AdminRole;
  is_active: boolean;
  branch_id: string | null;
  managed_branch_ids: string[] | null;
  created_at: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" });
}

export default function AdminUsers() {
  usePageMeta("Admin Users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [loadedTrigger, setLoadedTrigger] = useState(-1);
  const loading = loadedTrigger !== reloadTrigger;
  const currentId = getCurrentAdminId();

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newRole, setNewRole] = useState<AdminRole>("admin");
  const [newBranchId, setNewBranchId] = useState("");
  const [newManagedBranchIds, setNewManagedBranchIds] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editRole, setEditRole] = useState<AdminRole>("admin");
  const [editBranchId, setEditBranchId] = useState("");
  const [editManagedBranchIds, setEditManagedBranchIds] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    getAllBranches()
      .then((data) => setBranches(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminGet<{ items: AdminUser[] }>("/api/admin/users")
      .then((data) => {
        if (cancelled) return;
        setUsers(data.items);
        setListError(null);
        setLoadedTrigger(reloadTrigger);
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(err.message ?? "Couldn't load admin users.");
        setLoadedTrigger(reloadTrigger);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTrigger]);

  function reload() {
    setReloadTrigger((n) => n + 1);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await adminPost("/api/admin/users", {
        username: newUsername,
        password: newPassword,
        role: newRole,
        branch_id: newRole === "loan_officer" ? newBranchId || null : null,
        managed_branch_ids: newRole === "regional_manager" ? newManagedBranchIds : null,
      });
      setNewUsername("");
      setNewPassword("");
      setNewRole("admin");
      setNewBranchId("");
      setNewManagedBranchIds([]);
      reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't create admin.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setEditUsername(user.username);
    setEditPassword("");
    setEditRole(user.role);
    setEditBranchId(user.branch_id ?? "");
    setEditManagedBranchIds(user.managed_branch_ids ?? []);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = { username: editUsername, role: editRole };
      if (editPassword) body.password = editPassword;
      if (editRole === "loan_officer") body.branch_id = editBranchId || null;
      if (editRole === "regional_manager") body.managed_branch_ids = editManagedBranchIds;
      await adminPatch(`/api/admin/users/${id}`, body);
      setEditingId(null);
      reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(user: AdminUser) {
    const action = user.is_active ? "deactivate" : "reactivate";
    if (user.is_active && !confirm(`Deactivate ${user.username}? They'll lose dashboard access immediately.`)) return;
    try {
      if (user.is_active) {
        await adminDelete(`/api/admin/users/${user.id}`);
      } else {
        await adminPatch(`/api/admin/users/${user.id}`, { is_active: true });
      }
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Couldn't ${action} this admin.`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
          Add a new admin or loan officer
        </h2>
        {createError && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
            <AlertCircle size={16} />
            {createError}
          </div>
        )}
        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1.5 block text-sm text-ink-500">Username</label>
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              minLength={3}
              required
              className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1.5 block text-sm text-ink-500">Password</label>
            {/* <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            /> */}
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
                className="w-full rounded-xl border border-mist-200 px-4 py-2.5 pr-10 text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-500 hover:text-ink-700"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1.5 block text-sm text-ink-500">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminRole)}
              className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            >
              {ADMIN_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {newRole === "loan_officer" && (
            <div className="min-w-[160px]">
              <label className="mb-1.5 block text-sm text-ink-500">Home branch</label>
              <select
                value={newBranchId}
                onChange={(e) => setNewBranchId(e.target.value)}
                required
                className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
              >
                <option value="">Select a branch…</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          {newRole === "regional_manager" && (
            <div className="min-w-[220px]">
              <label className="mb-1.5 block text-sm text-ink-500">Managed branches</label>
              <select
                multiple
                value={newManagedBranchIds}
                onChange={(e) => setNewManagedBranchIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="w-full rounded-xl border border-mist-200 px-3 py-2 text-sm focus:outline-none"
                size={Math.min(4, branches.length || 1)}
              >
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-ink-400">Ctrl/Cmd-click to select more than one.</p>
            </div>
          )}
          <button
            type="submit"
            disabled={creating}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
            style={{ backgroundColor: "var(--color-ember-500)" }}
          >
            {creating ? "Creating…" : "Create User"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
          Existing admins & loan officers
        </h2>

        {listError && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
            <AlertCircle size={16} />
            {listError}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-ink-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-ink-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Username</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Created</th>
                  <th className="px-3 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist-200">
                {users.map((u) => {
                  const isSelf = u.id === currentId;
                  const isEditing = editingId === u.id;
                  return (
                    <tr key={u.id}>
                      {isEditing ? (
                        <>
                          <td className="px-3 py-2.5" colSpan={2}>
                            <input
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className="mb-1.5 w-full rounded-lg border border-mist-200 px-3 py-1.5 text-sm focus:outline-none"
                              placeholder="Username"
                            />
                            {/* <input
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              className="mb-1.5 w-full rounded-lg border border-mist-200 px-3 py-1.5 text-sm focus:outline-none"
                              placeholder="New password (leave blank to keep current)"
                            /> */}
                            <div className="relative mb-1.5">
                              <input
                                type={showEditPassword ? "text" : "password"}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className="w-full rounded-lg border border-mist-200 px-3 py-1.5 pr-9 text-sm focus:outline-none"
                                placeholder="New password (leave blank to keep current)"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditPassword((v) => !v)}
                                tabIndex={-1}
                                aria-label={showEditPassword ? "Hide password" : "Show password"}
                                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-ink-500 hover:text-ink-700"
                              >
                                {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as AdminRole)}
                              className="w-full rounded-lg border border-mist-200 px-3 py-1.5 text-sm focus:outline-none"
                            >
                              {ADMIN_ROLES.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                            {editRole === "loan_officer" && (
                              <select
                                value={editBranchId}
                                onChange={(e) => setEditBranchId(e.target.value)}
                                className="mt-1.5 w-full rounded-lg border border-mist-200 px-3 py-1.5 text-sm focus:outline-none"
                              >
                                <option value="">Select a branch…</option>
                                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                            )}
                            {editRole === "regional_manager" && (
                              <select
                                multiple
                                value={editManagedBranchIds}
                                onChange={(e) => setEditManagedBranchIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                                size={Math.min(4, branches.length || 1)}
                                className="mt-1.5 w-full rounded-lg border border-mist-200 px-3 py-1.5 text-sm focus:outline-none"
                              >
                                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                            )}
                            {editError && <p className="mt-1 text-xs text-red-500">{editError}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-ink-500">{fmtDate(u.created_at)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(u.id)}
                                disabled={savingEdit}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-white disabled:opacity-60"
                                style={{ backgroundColor: "var(--color-ember-500)" }}
                                title="Save"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-mist-200 text-ink-700"
                                title="Cancel"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--color-ink-900)" }}>
                            {u.username}
                            {isSelf && <span className="ml-2 text-xs font-normal text-ink-500">(you)</span>}
                          </td>
                          <td className="px-3 py-2.5 text-ink-500">{roleLabel(u.role)}</td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={u.is_active ? "active" : "inactive"} />
                          </td>
                          <td className="px-3 py-2.5 text-ink-500">{fmtDate(u.created_at)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEdit(u)}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                                title="Edit"
                              >
                                <Pencil size={13} />
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => toggleActive(u)}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                                  title={u.is_active ? "Deactivate" : "Reactivate"}
                                >
                                  {u.is_active ? <Trash2 size={13} /> : <RotateCcw size={13} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// import { useEffect, useState } from "react";
// import { AlertCircle, Pencil, Trash2, RotateCcw, Check, X } from "lucide-react";
// import { adminGet, adminPost, adminPatch, adminDelete, getCurrentAdminId } from "../../lib/adminApi";
// import { usePageMeta } from "../../lib/usePageMeta";
// import StatusBadge from "../../components/admin/StatusBadge";

// type AdminUser = {
//   id: string;
//   username: string;
//   is_active: boolean;
//   created_at: string;
// };

// function fmtDate(iso: string) {
//   return new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" });
// }

// export default function AdminUsers() {
//   usePageMeta("Admin Users");
//   const [users, setUsers] = useState<AdminUser[]>([]);
//   const [listError, setListError] = useState<string | null>(null);
//   const [reloadTrigger, setReloadTrigger] = useState(0);
//   const [loadedTrigger, setLoadedTrigger] = useState(-1);
//   const loading = loadedTrigger !== reloadTrigger;
//   const currentId = getCurrentAdminId();

//   const [newUsername, setNewUsername] = useState("");
//   const [newPassword, setNewPassword] = useState("");
//   const [createError, setCreateError] = useState<string | null>(null);
//   const [creating, setCreating] = useState(false);

//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editUsername, setEditUsername] = useState("");
//   const [editPassword, setEditPassword] = useState("");
//   const [editError, setEditError] = useState<string | null>(null);
//   const [savingEdit, setSavingEdit] = useState(false);

//   useEffect(() => {
//     let cancelled = false;
//     adminGet<{ items: AdminUser[] }>("/api/admin/users")
//       .then((data) => {
//         if (cancelled) return;
//         setUsers(data.items);
//         setListError(null);
//         setLoadedTrigger(reloadTrigger);
//       })
//       .catch((err) => {
//         if (cancelled) return;
//         setListError(err.message ?? "Couldn't load admin users.");
//         setLoadedTrigger(reloadTrigger);
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, [reloadTrigger]);

//   function reload() {
//     setReloadTrigger((n) => n + 1);
//   }

//   async function onCreate(e: React.FormEvent) {
//     e.preventDefault();
//     setCreateError(null);
//     setCreating(true);
//     try {
//       await adminPost("/api/admin/users", { username: newUsername, password: newPassword });
//       setNewUsername("");
//       setNewPassword("");
//       reload();
//     } catch (err) {
//       setCreateError(err instanceof Error ? err.message : "Couldn't create admin.");
//     } finally {
//       setCreating(false);
//     }
//   }

//   function startEdit(user: AdminUser) {
//     setEditingId(user.id);
//     setEditUsername(user.username);
//     setEditPassword("");
//     setEditError(null);
//   }

//   function cancelEdit() {
//     setEditingId(null);
//     setEditError(null);
//   }

//   async function saveEdit(id: string) {
//     setSavingEdit(true);
//     setEditError(null);
//     try {
//       const body: Record<string, string> = { username: editUsername };
//       if (editPassword) body.password = editPassword;
//       await adminPatch(`/api/admin/users/${id}`, body);
//       setEditingId(null);
//       reload();
//     } catch (err) {
//       setEditError(err instanceof Error ? err.message : "Couldn't save changes.");
//     } finally {
//       setSavingEdit(false);
//     }
//   }

//   async function toggleActive(user: AdminUser) {
//     const action = user.is_active ? "deactivate" : "reactivate";
//     if (user.is_active && !confirm(`Deactivate ${user.username}? They'll lose dashboard access immediately.`)) return;
//     try {
//       if (user.is_active) {
//         await adminDelete(`/api/admin/users/${user.id}`);
//       } else {
//         await adminPatch(`/api/admin/users/${user.id}`, { is_active: true });
//       }
//       reload();
//     } catch (err) {
//       alert(err instanceof Error ? err.message : `Couldn't ${action} this admin.`);
//     }
//   }

//   return (
//     <div className="space-y-6">
//       <div className="rounded-2xl border border-mist-200 bg-surface p-5">
//         <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
//           Add a new admin
//         </h2>
//         {createError && (
//           <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
//             <AlertCircle size={16} />
//             {createError}
//           </div>
//         )}
//         <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
//           <div className="min-w-[160px] flex-1">
//             <label className="mb-1.5 block text-sm text-ink-500">Username</label>
//             <input
//               value={newUsername}
//               onChange={(e) => setNewUsername(e.target.value)}
//               minLength={3}
//               required
//               className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
//             />
//           </div>
//           <div className="min-w-[160px] flex-1">
//             <label className="mb-1.5 block text-sm text-ink-500">Password</label>
//             <input
//               type="password"
//               value={newPassword}
//               onChange={(e) => setNewPassword(e.target.value)}
//               minLength={8}
//               required
//               className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
//             />
//           </div>
//           <button
//             type="submit"
//             disabled={creating}
//             className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
//             style={{ backgroundColor: "var(--color-ember-500)" }}
//           >
//             {creating ? "Creating…" : "Create Admin"}
//           </button>
//         </form>
//       </div>

//       <div className="rounded-2xl border border-mist-200 bg-surface p-5">
//         <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
//           Existing admins
//         </h2>

//         {listError && (
//           <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
//             <AlertCircle size={16} />
//             {listError}
//           </div>
//         )}

//         {loading ? (
//           <p className="text-sm text-ink-500">Loading…</p>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full min-w-[560px] text-left text-sm">
//               <thead className="text-xs text-ink-500">
//                 <tr>
//                   <th className="px-3 py-2.5 font-medium">Username</th>
//                   <th className="px-3 py-2.5 font-medium">Status</th>
//                   <th className="px-3 py-2.5 font-medium">Created</th>
//                   <th className="px-3 py-2.5 font-medium"></th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-mist-200">
//                 {users.map((u) => {
//                   const isSelf = u.id === currentId;
//                   const isEditing = editingId === u.id;
//                   return (
//                     <tr key={u.id}>
//                       {isEditing ? (
//                         <>
//                           <td className="px-3 py-2.5" colSpan={2}>
//                             <input
//                               value={editUsername}
//                               onChange={(e) => setEditUsername(e.target.value)}
//                               className="mb-1.5 w-full rounded-lg border border-mist-200 px-3 py-1.5 text-sm focus:outline-none"
//                               placeholder="Username"
//                             />
//                             <input
//                               type="password"
//                               value={editPassword}
//                               onChange={(e) => setEditPassword(e.target.value)}
//                               className="w-full rounded-lg border border-mist-200 px-3 py-1.5 text-sm focus:outline-none"
//                               placeholder="New password (leave blank to keep current)"
//                             />
//                             {editError && <p className="mt-1 text-xs text-red-500">{editError}</p>}
//                           </td>
//                           <td className="px-3 py-2.5 text-ink-500">{fmtDate(u.created_at)}</td>
//                           <td className="px-3 py-2.5">
//                             <div className="flex gap-2">
//                               <button
//                                 onClick={() => saveEdit(u.id)}
//                                 disabled={savingEdit}
//                                 className="flex h-7 w-7 items-center justify-center rounded-full text-white disabled:opacity-60"
//                                 style={{ backgroundColor: "var(--color-ember-500)" }}
//                                 title="Save"
//                               >
//                                 <Check size={13} />
//                               </button>
//                               <button
//                                 onClick={cancelEdit}
//                                 className="flex h-7 w-7 items-center justify-center rounded-full border border-mist-200 text-ink-700"
//                                 title="Cancel"
//                               >
//                                 <X size={13} />
//                               </button>
//                             </div>
//                           </td>
//                         </>
//                       ) : (
//                         <>
//                           <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--color-ink-900)" }}>
//                             {u.username}
//                             {isSelf && <span className="ml-2 text-xs font-normal text-ink-500">(you)</span>}
//                           </td>
//                           <td className="px-3 py-2.5">
//                             <StatusBadge status={u.is_active ? "active" : "inactive"} />
//                           </td>
//                           <td className="px-3 py-2.5 text-ink-500">{fmtDate(u.created_at)}</td>
//                           <td className="px-3 py-2.5">
//                             <div className="flex gap-2">
//                               <button
//                                 onClick={() => startEdit(u)}
//                                 className="flex h-7 w-7 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
//                                 title="Edit"
//                               >
//                                 <Pencil size={13} />
//                               </button>
//                               {!isSelf && (
//                                 <button
//                                   onClick={() => toggleActive(u)}
//                                   className="flex h-7 w-7 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
//                                   title={u.is_active ? "Deactivate" : "Reactivate"}
//                                 >
//                                   {u.is_active ? <Trash2 size={13} /> : <RotateCcw size={13} />}
//                                 </button>
//                               )}
//                             </div>
//                           </td>
//                         </>
//                       )}
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
