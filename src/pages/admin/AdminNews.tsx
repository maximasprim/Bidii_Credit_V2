import { useEffect, useState } from "react";
import { AlertCircle, Pencil, Trash2, Check, X, Plus, ImagePlus } from "lucide-react";
import { adminGet, adminPost, adminPatch, adminDelete, adminPostForm, API_BASE_URL } from "../../lib/adminApi";
import { usePageMeta } from "../../lib/usePageMeta";
import StatusBadge from "../../components/admin/StatusBadge";

type Article = {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string[];
  image_urls: string[];
  is_published: boolean;
  published_at: string;
};

const CATEGORIES = ["Financial Literacy", "Product Updates", "Company News", "Customer Stories"];

/** Builds the public URL for an image path returned by the upload endpoint (e.g. "news/<uuid>_cover.jpg"). */
function newsImageUrl(path: string) {
  return `${API_BASE_URL}/api/news/images/${path}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" });
}

type FormState = {
  title: string;
  category: string;
  excerpt: string;
  body: string;
  image_urls: string[];
  is_published: boolean;
};

const emptyForm: FormState = { title: "", category: CATEGORIES[0], excerpt: "", body: "", image_urls: [], is_published: true };

/**
 * Upload control shared by the create and edit forms — uploads one or more
 * images via POST /api/admin/news/upload-image (one request per file) and
 * reports the resulting list of stored paths back via onChange. Each
 * instance manages its own uploading/error state, so the create and edit
 * forms don't interfere with each other.
 */
function NewsImageUploader({ imageUrls, onChange }: { imageUrls: string[]; onChange: (urls: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // lets the same file be picked again later if removed
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("image", file);
        const result = await adminPostForm<{ url: string }>("/api/admin/news/upload-image", form);
        uploaded.push(result.url);
      }
      onChange([...imageUrls, ...uploaded]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't upload image.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    onChange(imageUrls.filter((u) => u !== url));
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm text-ink-500">Images</label>
      {imageUrls.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {imageUrls.map((url) => (
            <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-mist-200">
              <img src={newsImageUrl(url)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                title="Remove image"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-mist-200 px-4 py-2.5 text-sm text-ink-500 hover:bg-mist-50">
        <ImagePlus size={15} />
        {uploading ? "Uploading…" : "Add image(s)"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={onFilesSelected}
        />
      </label>
      {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
    </div>
  );
}

export default function AdminNews() {
  usePageMeta("Manage News");
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [loadedTrigger, setLoadedTrigger] = useState(-1);
  const loading = loadedTrigger !== reloadTrigger;

  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminGet<{ items: Article[] }>("/api/admin/news?page_size=100")
      .then((data) => {
        if (cancelled) return;
        setArticles(data.items);
        setError(null);
        setLoadedTrigger(reloadTrigger);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? "Couldn't load articles.");
        setLoadedTrigger(reloadTrigger);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadTrigger]);

  function reload() {
    setReloadTrigger((n) => n + 1);
  }

  function bodyToParagraphs(text: string) {
    return text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const paragraphs = bodyToParagraphs(createForm.body);
      if (paragraphs.length === 0) throw new Error("Add at least one paragraph of body text.");
      await adminPost("/api/admin/news", {
        title: createForm.title,
        category: createForm.category,
        excerpt: createForm.excerpt,
        body: paragraphs,
        image_urls: createForm.image_urls,
        is_published: createForm.is_published,
      });
      setCreateForm(emptyForm);
      reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't create article.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(article: Article) {
    setEditingId(article.id);
    setEditForm({
      title: article.title,
      category: article.category,
      excerpt: article.excerpt,
      body: article.body.join("\n\n"),
      image_urls: article.image_urls,
      is_published: article.is_published,
    });
    setEditError(null);
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    setEditError(null);
    try {
      const paragraphs = bodyToParagraphs(editForm.body);
      if (paragraphs.length === 0) throw new Error("Add at least one paragraph of body text.");
      await adminPatch(`/api/admin/news/${id}`, {
        title: editForm.title,
        category: editForm.category,
        excerpt: editForm.excerpt,
        body: paragraphs,
        image_urls: editForm.image_urls,
        is_published: editForm.is_published,
      });
      setEditingId(null);
      reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this article? This can't be undone.")) return;
    try {
      await adminDelete(`/api/admin/news/${id}`);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete article.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
          Add a new article
        </h2>
        {createError && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
            <AlertCircle size={16} />
            {createError}
          </div>
        )}
        <form onSubmit={onCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-ink-500">Title</label>
              <input
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                required
                minLength={3}
                className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-ink-500">Category</label>
              <select
                value={createForm.category}
                onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-ink-500">Excerpt</label>
            <input
              value={createForm.excerpt}
              onChange={(e) => setCreateForm({ ...createForm, excerpt: e.target.value })}
              required
              minLength={10}
              className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-ink-500">Body (separate paragraphs with a blank line)</label>
            <textarea
              value={createForm.body}
              onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
              required
              rows={6}
              className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
            />
          </div>
          <NewsImageUploader
            imageUrls={createForm.image_urls}
            onChange={(image_urls) => setCreateForm({ ...createForm, image_urls })}
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={createForm.is_published}
              onChange={(e) => setCreateForm({ ...createForm, is_published: e.target.checked })}
            />
            Publish immediately
          </label>
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
            style={{ backgroundColor: "var(--color-ember-500)" }}
          >
            <Plus size={15} />
            {creating ? "Creating…" : "Create Article"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-mist-200 bg-surface p-5">
        <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
          All articles
        </h2>

        {error && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-ink-500">Loading…</p>
        ) : articles.length === 0 ? (
          <p className="text-sm text-ink-500">No articles yet.</p>
        ) : (
          <div className="space-y-3">
            {articles.map((a) => {
              const isEditing = editingId === a.id;
              return (
                <div key={a.id} className="rounded-xl border border-mist-200 p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      {editError && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                          <AlertCircle size={14} />
                          {editError}
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
                          placeholder="Title"
                        />
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700 focus:outline-none"
                        >
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <input
                        value={editForm.excerpt}
                        onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })}
                        className="w-full rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
                        placeholder="Excerpt"
                      />
                      <textarea
                        value={editForm.body}
                        onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                        rows={5}
                        className="w-full rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
                      />
                      <NewsImageUploader
                        imageUrls={editForm.image_urls}
                        onChange={(image_urls) => setEditForm({ ...editForm, image_urls })}
                      />
                      <label className="flex items-center gap-2 text-sm text-ink-700">
                        <input
                          type="checkbox"
                          checked={editForm.is_published}
                          onChange={(e) => setEditForm({ ...editForm, is_published: e.target.checked })}
                        />
                        Published
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(a.id)}
                          disabled={savingEdit}
                          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          style={{ backgroundColor: "var(--color-ember-500)" }}
                        >
                          <Check size={13} />
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1.5 rounded-full border border-mist-200 px-4 py-2 text-xs font-semibold text-ink-700"
                        >
                          <X size={13} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {a.image_urls[0] && (
                          <img
                            src={newsImageUrl(a.image_urls[0])}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-lg border border-mist-200 object-cover"
                          />
                        )}
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>{a.title}</p>
                            <StatusBadge status={a.is_published ? "active" : "inactive"} label={a.is_published ? "published" : "draft"} />
                          </div>
                          <p className="mt-1 text-xs text-ink-500">{a.category} · {fmtDate(a.published_at)}</p>
                          <p className="mt-1.5 text-sm text-ink-700">{a.excerpt}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => startEdit(a)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => onDelete(a.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


// import { useEffect, useState } from "react";
// import { AlertCircle, Pencil, Trash2, Check, X, Plus } from "lucide-react";
// import { adminGet, adminPost, adminPatch, adminDelete } from "../../lib/adminApi";
// import { usePageMeta } from "../../lib/usePageMeta";
// import StatusBadge from "../../components/admin/StatusBadge";

// type Article = {
//   id: string;
//   slug: string;
//   title: string;
//   category: string;
//   excerpt: string;
//   body: string[];
//   is_published: boolean;
//   published_at: string;
// };

// const CATEGORIES = ["Financial Literacy", "Product Updates", "Company News", "Customer Stories"];

// function fmtDate(iso: string) {
//   return new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" });
// }

// type FormState = {
//   title: string;
//   category: string;
//   excerpt: string;
//   body: string;
//   is_published: boolean;
// };

// const emptyForm: FormState = { title: "", category: CATEGORIES[0], excerpt: "", body: "", is_published: true };

// export default function AdminNews() {
//   usePageMeta("Manage News");
//   const [articles, setArticles] = useState<Article[]>([]);
//   const [error, setError] = useState<string | null>(null);
//   const [reloadTrigger, setReloadTrigger] = useState(0);
//   const [loadedTrigger, setLoadedTrigger] = useState(-1);
//   const loading = loadedTrigger !== reloadTrigger;

//   const [createForm, setCreateForm] = useState<FormState>(emptyForm);
//   const [createError, setCreateError] = useState<string | null>(null);
//   const [creating, setCreating] = useState(false);

//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editForm, setEditForm] = useState<FormState>(emptyForm);
//   const [editError, setEditError] = useState<string | null>(null);
//   const [savingEdit, setSavingEdit] = useState(false);

//   useEffect(() => {
//     let cancelled = false;
//     adminGet<{ items: Article[] }>("/api/admin/news?page_size=100")
//       .then((data) => {
//         if (cancelled) return;
//         setArticles(data.items);
//         setError(null);
//         setLoadedTrigger(reloadTrigger);
//       })
//       .catch((err) => {
//         if (cancelled) return;
//         setError(err.message ?? "Couldn't load articles.");
//         setLoadedTrigger(reloadTrigger);
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, [reloadTrigger]);

//   function reload() {
//     setReloadTrigger((n) => n + 1);
//   }

//   function bodyToParagraphs(text: string) {
//     return text
//       .split(/\n\s*\n/)
//       .map((p) => p.trim())
//       .filter(Boolean);
//   }

//   async function onCreate(e: React.FormEvent) {
//     e.preventDefault();
//     setCreateError(null);
//     setCreating(true);
//     try {
//       const paragraphs = bodyToParagraphs(createForm.body);
//       if (paragraphs.length === 0) throw new Error("Add at least one paragraph of body text.");
//       await adminPost("/api/admin/news", {
//         title: createForm.title,
//         category: createForm.category,
//         excerpt: createForm.excerpt,
//         body: paragraphs,
//         is_published: createForm.is_published,
//       });
//       setCreateForm(emptyForm);
//       reload();
//     } catch (err) {
//       setCreateError(err instanceof Error ? err.message : "Couldn't create article.");
//     } finally {
//       setCreating(false);
//     }
//   }

//   function startEdit(article: Article) {
//     setEditingId(article.id);
//     setEditForm({
//       title: article.title,
//       category: article.category,
//       excerpt: article.excerpt,
//       body: article.body.join("\n\n"),
//       is_published: article.is_published,
//     });
//     setEditError(null);
//   }

//   async function saveEdit(id: string) {
//     setSavingEdit(true);
//     setEditError(null);
//     try {
//       const paragraphs = bodyToParagraphs(editForm.body);
//       if (paragraphs.length === 0) throw new Error("Add at least one paragraph of body text.");
//       await adminPatch(`/api/admin/news/${id}`, {
//         title: editForm.title,
//         category: editForm.category,
//         excerpt: editForm.excerpt,
//         body: paragraphs,
//         is_published: editForm.is_published,
//       });
//       setEditingId(null);
//       reload();
//     } catch (err) {
//       setEditError(err instanceof Error ? err.message : "Couldn't save changes.");
//     } finally {
//       setSavingEdit(false);
//     }
//   }

//   async function onDelete(id: string) {
//     if (!confirm("Delete this article? This can't be undone.")) return;
//     try {
//       await adminDelete(`/api/admin/news/${id}`);
//       reload();
//     } catch (err) {
//       alert(err instanceof Error ? err.message : "Couldn't delete article.");
//     }
//   }

//   return (
//     <div className="space-y-6">
//       <div className="rounded-2xl border border-mist-200 bg-surface p-5">
//         <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
//           Add a new article
//         </h2>
//         {createError && (
//           <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
//             <AlertCircle size={16} />
//             {createError}
//           </div>
//         )}
//         <form onSubmit={onCreate} className="space-y-4">
//           <div className="grid gap-4 sm:grid-cols-2">
//             <div>
//               <label className="mb-1.5 block text-sm text-ink-500">Title</label>
//               <input
//                 value={createForm.title}
//                 onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
//                 required
//                 minLength={3}
//                 className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
//               />
//             </div>
//             <div>
//               <label className="mb-1.5 block text-sm text-ink-500">Category</label>
//               <select
//                 value={createForm.category}
//                 onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
//                 className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
//               >
//                 {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
//               </select>
//             </div>
//           </div>
//           <div>
//             <label className="mb-1.5 block text-sm text-ink-500">Excerpt</label>
//             <input
//               value={createForm.excerpt}
//               onChange={(e) => setCreateForm({ ...createForm, excerpt: e.target.value })}
//               required
//               minLength={10}
//               className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
//             />
//           </div>
//           <div>
//             <label className="mb-1.5 block text-sm text-ink-500">Body (separate paragraphs with a blank line)</label>
//             <textarea
//               value={createForm.body}
//               onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
//               required
//               rows={6}
//               className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
//             />
//           </div>
//           <label className="flex items-center gap-2 text-sm text-ink-700">
//             <input
//               type="checkbox"
//               checked={createForm.is_published}
//               onChange={(e) => setCreateForm({ ...createForm, is_published: e.target.checked })}
//             />
//             Publish immediately
//           </label>
//           <button
//             type="submit"
//             disabled={creating}
//             className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
//             style={{ backgroundColor: "var(--color-ember-500)" }}
//           >
//             <Plus size={15} />
//             {creating ? "Creating…" : "Create Article"}
//           </button>
//         </form>
//       </div>

//       <div className="rounded-2xl border border-mist-200 bg-surface p-5">
//         <h2 className="mb-4 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
//           All articles
//         </h2>

//         {error && (
//           <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-600">
//             <AlertCircle size={16} />
//             {error}
//           </div>
//         )}

//         {loading ? (
//           <p className="text-sm text-ink-500">Loading…</p>
//         ) : articles.length === 0 ? (
//           <p className="text-sm text-ink-500">No articles yet.</p>
//         ) : (
//           <div className="space-y-3">
//             {articles.map((a) => {
//               const isEditing = editingId === a.id;
//               return (
//                 <div key={a.id} className="rounded-xl border border-mist-200 p-4">
//                   {isEditing ? (
//                     <div className="space-y-3">
//                       {editError && (
//                         <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
//                           <AlertCircle size={14} />
//                           {editError}
//                         </div>
//                       )}
//                       <div className="grid gap-3 sm:grid-cols-2">
//                         <input
//                           value={editForm.title}
//                           onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
//                           className="rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
//                           placeholder="Title"
//                         />
//                         <select
//                           value={editForm.category}
//                           onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
//                           className="rounded-lg border border-mist-200 px-3 py-2 text-sm text-ink-700 focus:outline-none"
//                         >
//                           {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
//                         </select>
//                       </div>
//                       <input
//                         value={editForm.excerpt}
//                         onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })}
//                         className="w-full rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
//                         placeholder="Excerpt"
//                       />
//                       <textarea
//                         value={editForm.body}
//                         onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
//                         rows={5}
//                         className="w-full rounded-lg border border-mist-200 px-3 py-2 text-sm focus:outline-none"
//                       />
//                       <label className="flex items-center gap-2 text-sm text-ink-700">
//                         <input
//                           type="checkbox"
//                           checked={editForm.is_published}
//                           onChange={(e) => setEditForm({ ...editForm, is_published: e.target.checked })}
//                         />
//                         Published
//                       </label>
//                       <div className="flex gap-2">
//                         <button
//                           onClick={() => saveEdit(a.id)}
//                           disabled={savingEdit}
//                           className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
//                           style={{ backgroundColor: "var(--color-ember-500)" }}
//                         >
//                           <Check size={13} />
//                           Save
//                         </button>
//                         <button
//                           onClick={() => setEditingId(null)}
//                           className="flex items-center gap-1.5 rounded-full border border-mist-200 px-4 py-2 text-xs font-semibold text-ink-700"
//                         >
//                           <X size={13} />
//                           Cancel
//                         </button>
//                       </div>
//                     </div>
//                   ) : (
//                     <div className="flex items-start justify-between gap-4">
//                       <div>
//                         <div className="flex flex-wrap items-center gap-2">
//                           <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>{a.title}</p>
//                           <StatusBadge status={a.is_published ? "active" : "inactive"} label={a.is_published ? "published" : "draft"} />
//                         </div>
//                         <p className="mt-1 text-xs text-ink-500">{a.category} · {fmtDate(a.published_at)}</p>
//                         <p className="mt-1.5 text-sm text-ink-700">{a.excerpt}</p>
//                       </div>
//                       <div className="flex shrink-0 gap-2">
//                         <button
//                           onClick={() => startEdit(a)}
//                           className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
//                         >
//                           <Pencil size={13} />
//                         </button>
//                         <button
//                           onClick={() => onDelete(a.id)}
//                           className="flex h-8 w-8 items-center justify-center rounded-full border border-mist-200 text-ink-700 hover:bg-mist-50"
//                         >
//                           <Trash2 size={13} />
//                         </button>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
