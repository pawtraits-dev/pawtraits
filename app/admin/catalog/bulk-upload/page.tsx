'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, FolderOpen, ImagePlus, Loader2, AlertTriangle, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { nearestAllowedRatio } from '@/lib/print/print-geometry';

/**
 * Admin → Catalogue → Bulk upload
 * Pick images (or a whole folder). Each is analysed (Claude, two at a time), then reviewed here:
 * check the breed, coat, format, description and tags, approve, and save the approved ones.
 * Saving uses the same endpoint as the single upload, so the results are identical.
 * Everything is held in this tab until saved: leaving the page loses unsaved work (you're warned).
 */

type Subject = {
  subjectOrder: number;
  isPrimary: boolean;
  breedId?: string;
  coatId?: string;
  outfitId?: string;
  position: string;
  sizeProminence?: string;
  poseDescription: string;
  gazeDirection?: string;
  expression?: string;
  identifiedByAI?: boolean;
  aiConfidence?: number;
  suggestedBreed?: { id: string; name: string; confidence: number };
  suggestedCoat?: { id: string; name: string; confidence: number };
};

type Status = 'queued' | 'analysing' | 'ready' | 'saving' | 'saved' | 'error';

type Item = {
  key: string;
  file: File;
  name: string;
  thumb: string;
  width: number;
  height: number;
  ratioWarning: string | null;
  formatId: string;
  status: Status;
  error: string | null;
  // From the analysis
  compositionAnalysis: string;
  compositionMetadata: any;
  variationPromptTemplate: string;
  confidence: number | null;
  // Editable
  description: string;
  subjects: Subject[];
  themeId: string;
  styleId: string;
  tags: string[];
  isPublic: boolean;
  isFeatured: boolean;
  approved: boolean;
  savedId?: string;
  expanded: boolean;
};

type Filter = 'all' | 'check' | 'approved' | 'saved' | 'error';

const CONCURRENCY = 2;
const LOW_CONFIDENCE = 0.7;
const MAX_SAVE_BYTES = 3.9 * 1024 * 1024; // the save endpoint takes up to 4 MB

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image'));
    img.src = URL.createObjectURL(file);
  });
}

/** Re-encode as JPEG within maxDim, stepping quality/size down until it is under maxBytes */
async function shrink(file: File, maxDim: number, maxBytes: number): Promise<File> {
  const img = await loadImage(file);
  try {
    return await encodeUnder(file, img, maxDim, maxBytes);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

async function encodeUnder(file: File, img: HTMLImageElement, maxDim: number, maxBytes: number): Promise<File> {
  let dim = Math.min(maxDim, Math.max(img.naturalWidth, img.naturalHeight));
  let quality = 0.92;
  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = dim / Math.max(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (blob && blob.size <= maxBytes) {
      return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    }
    if (quality > 0.8) quality -= 0.04; else dim = Math.round(dim * 0.85);
  }
  throw new Error('Could not make this image small enough to upload');
}

/** The file to save: the original when it fits, otherwise a high-quality re-encode */
async function fileForSaving(file: File): Promise<File> {
  if (file.size <= MAX_SAVE_BYTES && /image\/(jpeg|png|webp)/.test(file.type)) return file;
  return shrink(file, 4096, MAX_SAVE_BYTES);
}

/** Every image file in a dropped folder (recursively) */
async function filesFromEntry(entry: any): Promise<File[]> {
  if (!entry) return [];
  if (entry.isFile) return new Promise((resolve) => entry.file((f: File) => resolve([f]), () => resolve([])));
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const all: any[] = [];
    // readEntries returns batches until empty
    for (;;) {
      const batch: any[] = await new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
      if (!batch.length) break;
      all.push(...batch);
    }
    return (await Promise.all(all.map(filesFromEntry))).flat();
  }
  return [];
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function BulkCatalogUploadPage() {
  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const running = useRef(0);

  const [themes, setThemes] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [formats, setFormats] = useState<any[]>([]);
  const [breeds, setBreeds] = useState<any[]>([]);
  const [coats, setCoats] = useState<any[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // Defaults for newly added images
  const [defaultTheme, setDefaultTheme] = useState('');
  const [defaultStyle, setDefaultStyle] = useState('');
  const [defaultPublic, setDefaultPublic] = useState(true);

  const [filter, setFilter] = useState<Filter>('all');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [t, s, f, b, bc] = await Promise.all(['/api/themes', '/api/styles', '/api/formats', '/api/breeds', '/api/breed-coats'].map((u) => fetch(u).then((r) => r.json())));
        setThemes(t.filter((x: any) => x.is_active));
        setStyles(s.filter((x: any) => x.is_active));
        setFormats(f.filter((x: any) => x.is_active));
        setBreeds(b.filter((x: any) => x.is_active).sort((a: any, z: any) => a.name.localeCompare(z.name)));
        setCoats(bc.filter((x: any) => x.coats).map((x: any) => ({ id: x.coats.id, breed_id: x.breed_id, name: x.coats.display_name || x.coats.name, is_common: x.is_common })));
      } catch {
        setNotice('Could not load breeds, formats and themes. Refresh to try again.');
      } finally {
        setOptionsLoaded(true);
      }
    })();
  }, []);

  // Warn before leaving with analysed but unsaved images
  const unsaved = items.filter((i) => i.status !== 'saved').length;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const update = useCallback((key: string, patch: Partial<Item> | ((i: Item) => Partial<Item>)) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...(typeof patch === 'function' ? patch(i) : patch) } : i)));
  }, []);

  const breedName = useCallback((id?: string) => breeds.find((b) => b.id === id)?.name as string | undefined, [breeds]);

  // ---- Analysis queue (two at a time) ----
  const analyse = useCallback(async (item: Item) => {
    try {
      const small = await shrink(item.file, 1600, 3 * 1024 * 1024);
      const fd = new FormData();
      fd.append('image', small);
      if (item.themeId) fd.append('themeId', item.themeId);
      if (item.styleId) fd.append('styleId', item.styleId);
      const res = await fetch('/api/admin/analyze-composition', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Analysis failed (${res.status})`);
      const subjects: Subject[] = (data.subjects || []).map((s: Subject) => ({
        ...s,
        breedId: s.breedId || s.suggestedBreed?.id,
        coatId: s.coatId || s.suggestedCoat?.id,
      }));
      update(item.key, (cur) => ({
        status: 'ready',
        error: null,
        description: data.marketingDescription || '',
        compositionAnalysis: data.compositionAnalysis || '',
        compositionMetadata: data.compositionMetadata ?? null,
        variationPromptTemplate: data.variationPromptTemplate || '',
        confidence: typeof data.confidence?.overall === 'number' ? data.confidence.overall : null,
        subjects,
        tags: Array.from(new Set([...cur.tags, ...(data.tags || [])])).slice(0, 10),
      }));
    } catch (e: any) {
      update(item.key, { status: 'error', error: e.message || 'Analysis failed' });
    }
  }, [update]);

  const pump = useCallback(() => {
    while (running.current < CONCURRENCY) {
      const next = itemsRef.current.find((i) => i.status === 'queued');
      if (!next) return;
      running.current++;
      next.status = 'analysing'; // claim it now so the loop doesn't pick it twice
      update(next.key, { status: 'analysing' });
      analyse(next).finally(() => { running.current--; pump(); });
    }
  }, [analyse, update]);

  useEffect(() => { if (optionsLoaded) pump(); }, [items, optionsLoaded, pump]);

  // ---- Adding images ----
  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name) || /image\/(jpeg|png|webp)/.test(f.type))
      .filter((f) => !f.name.startsWith('.'));
    const skipped = files.length - images.length;
    const existing = new Set(itemsRef.current.map((i) => `${i.name}:${i.file.size}`));
    const fresh = images.filter((f) => !existing.has(`${f.name}:${f.size}`));
    const dupes = images.length - fresh.length;
    const added: Item[] = [];
    for (const file of fresh) {
      let width = 0, height = 0, thumb = '';
      try {
        const img = await loadImage(file);
        width = img.naturalWidth; height = img.naturalHeight; thumb = img.src;
      } catch { /* shown as an error below */ }
      let ratioWarning: string | null = null;
      let formatId = '';
      if (width && height) {
        const { ratio, offBy } = nearestAllowedRatio(width, height);
        const accepted = offBy <= 0.03 || (ratio === '2:1' && offBy <= 0.2);
        const match = accepted ? formats.find((f) => f.aspect_ratio === ratio) : null;
        if (!accepted) ratioWarning = `${width}×${height} isn't an allowed shape (nearest ${ratio}, ${Math.round(offBy * 100)}% off). Re-export it at ${ratio}.`;
        else if (!match) ratioWarning = `No active ${ratio} format. Pick one.`;
        else if (ratio === '2:1' && offBy > 0.03) ratioWarning = 'Wide image: centre-cropped to 2:1 for mugs.';
        formatId = match?.id ?? '';
      }
      added.push({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file, name: file.name, thumb, width, height, ratioWarning, formatId,
        status: thumb ? 'queued' : 'error', error: thumb ? null : 'Could not read this image',
        compositionAnalysis: '', compositionMetadata: null, variationPromptTemplate: '', confidence: null,
        description: '', subjects: [], themeId: defaultTheme, styleId: defaultStyle, tags: [],
        isPublic: defaultPublic, isFeatured: false, approved: false, expanded: false,
      });
    }
    setItems((prev) => [...prev, ...added]);
    const notes = [`Added ${added.length} image${added.length === 1 ? '' : 's'}`];
    if (dupes) notes.push(`${dupes} already in the list`);
    if (skipped) notes.push(`${skipped} non-image file${skipped === 1 ? '' : 's'} skipped`);
    setNotice(notes.join(' · '));
  }, [formats, defaultTheme, defaultStyle, defaultPublic]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const entries = Array.from(e.dataTransfer.items || []).map((it) => (it as any).webkitGetAsEntry?.()).filter(Boolean);
    const files = entries.length ? (await Promise.all(entries.map(filesFromEntry))).flat() : Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  // ---- Editing ----
  function setBreed(item: Item, index: number, breedId: string) {
    const oldName = breedName(item.subjects[index]?.breedId);
    const newName = breedName(breedId);
    const subjects = item.subjects.map((s, i) => {
      if (i !== index) return s;
      const coatOk = coats.some((c) => c.breed_id === breedId && c.id === s.coatId);
      return { ...s, breedId, coatId: coatOk ? s.coatId : undefined };
    });
    // Keep the description in step: swap the old breed name for the new one
    let description = item.description;
    if (oldName && newName && oldName !== newName) {
      description = description.replace(new RegExp(`\\b${escapeRegExp(oldName)}\\b`, 'gi'), newName);
    }
    update(item.key, { subjects, description, approved: false });
  }

  function setCoat(item: Item, index: number, coatId: string) {
    update(item.key, { subjects: item.subjects.map((s, i) => (i === index ? { ...s, coatId: coatId || undefined } : s)) });
  }

  function needsCheck(i: Item): string[] {
    const reasons: string[] = [];
    if (i.status !== 'ready') return reasons;
    if (!i.formatId) reasons.push('No format');
    if (!i.subjects[0]?.breedId) reasons.push('No breed');
    const low = i.subjects.some((s) => s.breedId && s.breedId === s.suggestedBreed?.id && (s.suggestedBreed?.confidence ?? 1) < LOW_CONFIDENCE);
    if (low) reasons.push('Low breed confidence');
    if (i.ratioWarning && !i.ratioWarning.startsWith('Wide image')) reasons.push('Shape');
    if (!i.description.trim()) reasons.push('No description');
    return reasons;
  }

  const canApprove = (i: Item) => i.status === 'ready' && !!i.formatId && !!i.subjects[0]?.breedId && !!i.description.trim();

  // ---- Saving ----
  async function saveApproved() {
    const queue = itemsRef.current.filter((i) => i.approved && i.status === 'ready');
    if (!queue.length) return;
    setSaving(true);
    let ok = 0, failed = 0;
    for (const item of queue) {
      update(item.key, { status: 'saving', error: null });
      try {
        const file = await fileForSaving(item.file);
        const fd = new FormData();
        fd.append('image', file);
        fd.append('filename', item.name);
        fd.append('marketingDescription', item.description);
        fd.append('compositionAnalysis', item.compositionAnalysis);
        fd.append('isMultiSubject', String(item.subjects.length > 1));
        fd.append('subjects', JSON.stringify(item.subjects));
        if (item.themeId) fd.append('themeId', item.themeId);
        if (item.styleId) fd.append('styleId', item.styleId);
        fd.append('formatId', item.formatId);
        fd.append('tags', JSON.stringify(item.tags));
        fd.append('isFeatured', String(item.isFeatured));
        fd.append('isPublic', String(item.isPublic));
        fd.append('variationPromptTemplate', item.variationPromptTemplate);
        fd.append('compositionMetadata', JSON.stringify(item.compositionMetadata));
        const res = await fetch('/api/admin/catalog/save', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || `Save failed (${res.status})`);
        update(item.key, { status: 'saved', savedId: data.imageId, expanded: false });
        ok++;
      } catch (e: any) {
        update(item.key, { status: 'ready', error: e.message || 'Save failed' });
        failed++;
      }
    }
    setSaving(false);
    setNotice(`Saved ${ok}${failed ? ` · ${failed} failed (see the cards)` : ''}`);
  }

  // ---- Bulk actions ----
  const approveAllReady = () => setItems((prev) => prev.map((i) => (canApprove(i) && !needsCheck(i).length ? { ...i, approved: true } : i)));
  const applyDefaults = () => setItems((prev) => prev.map((i) => (i.status === 'saved' ? i : { ...i, themeId: defaultTheme, styleId: defaultStyle, isPublic: defaultPublic })));
  const clearSaved = () => setItems((prev) => prev.filter((i) => i.status !== 'saved'));
  const retryFailed = () => setItems((prev) => prev.map((i) => (i.status === 'error' && i.thumb ? { ...i, status: 'queued', error: null } : i)));
  const remove = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const counts = useMemo(() => ({
    all: items.length,
    check: items.filter((i) => needsCheck(i).length > 0).length,
    approved: items.filter((i) => i.approved && i.status !== 'saved').length,
    saved: items.filter((i) => i.status === 'saved').length,
    error: items.filter((i) => i.status === 'error').length,
    analysing: items.filter((i) => i.status === 'queued' || i.status === 'analysing').length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items]);

  const visible = items.filter((i) => {
    if (filter === 'check') return needsCheck(i).length > 0;
    if (filter === 'approved') return i.approved && i.status !== 'saved';
    if (filter === 'saved') return i.status === 'saved';
    if (filter === 'error') return i.status === 'error';
    return true;
  });

  const breedsByType = useMemo(() => ({
    dog: breeds.filter((b) => b.animal_type !== 'cat'),
    cat: breeds.filter((b) => b.animal_type === 'cat'),
  }), [breeds]);

  const folderProps = { webkitdirectory: '', directory: '' } as any;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/catalog" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4 mr-1" /> Catalogue</Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bulk upload</h1>
            <p className="text-gray-600 mt-1 text-sm">Add images or a folder. Each is analysed, then you check the breed and details, approve, and save.</p>
          </div>
        </div>
        <Link href="/admin/catalog/upload" className="text-sm text-purple-700 hover:underline">Single upload (with variation preview)</Link>
      </div>

      {/* Defaults + drop zone */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`lg:col-span-2 rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-3 text-center ${dragOver ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-white'}`}
        >
          <ImagePlus className="w-10 h-10 text-purple-500" />
          <p className="font-semibold text-gray-900">Drop images or a folder here</p>
          <p className="text-xs text-gray-500">JPEG, PNG or WebP. Shapes: 1:1, 2:3, 3:2, 2:1. Large files are re-encoded to fit the 4 MB upload limit.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} disabled={!optionsLoaded}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><ImagePlus className="w-4 h-4" /> Choose images</button>
            <button type="button" onClick={() => folderInput.current?.click()} disabled={!optionsLoaded}
              className="inline-flex items-center gap-2 rounded-lg border border-purple-300 px-4 py-2 text-sm font-semibold text-purple-800 disabled:opacity-50"><FolderOpen className="w-4 h-4" /> Choose folder</button>
          </div>
          <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; addFiles(f); }} />
          <input ref={folderInput} type="file" multiple className="hidden" {...folderProps}
            onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; addFiles(f); }} />
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <p className="font-semibold text-gray-900 text-sm">Defaults for new images</p>
          <label className="block text-xs text-gray-600">Theme (optional, helps the analysis)
            <select value={defaultTheme} onChange={(e) => setDefaultTheme(e.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm text-gray-900">
              <option value="">None</option>
              {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="block text-xs text-gray-600">Style (optional)
            <select value={defaultStyle} onChange={(e) => setDefaultStyle(e.target.value)} className="mt-1 h-9 w-full rounded-md border px-2 text-sm text-gray-900">
              <option value="">None</option>
              {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={defaultPublic} onChange={(e) => setDefaultPublic(e.target.checked)} /> Public once saved
          </label>
          {items.length > 0 && <button type="button" onClick={applyDefaults} className="text-xs text-purple-700 hover:underline">Apply to all unsaved images</button>}
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {items.length > 0 && (
        <div className="sticky top-0 z-20 rounded-xl border bg-white/95 backdrop-blur px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
          <div className="flex flex-wrap gap-1">
            {([['all', 'All'], ['check', 'Needs a look'], ['approved', 'Approved'], ['saved', 'Saved'], ['error', 'Failed']] as [Filter, string][]).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${filter === k ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {label} ({counts[k]})
              </button>
            ))}
          </div>
          {counts.analysing > 0 && <span className="inline-flex items-center gap-1 text-xs text-gray-600"><Loader2 className="w-3 h-3 animate-spin" /> Analysing {counts.analysing}…</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            {counts.error > 0 && <button type="button" onClick={retryFailed} className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700">Retry failed</button>}
            {counts.saved > 0 && <button type="button" onClick={clearSaved} className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-700">Clear saved</button>}
            <button type="button" onClick={approveAllReady} className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-800">Approve all without issues</button>
            <button type="button" onClick={saveApproved} disabled={saving || counts.approved === 0}
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Save approved ({counts.approved})
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => {
          const issues = needsCheck(item);
          const busy = item.status === 'queued' || item.status === 'analysing' || item.status === 'saving';
          const locked = item.status === 'saved' || item.status === 'saving';
          return (
            <div key={item.key} className={`rounded-xl border bg-white overflow-hidden flex flex-col ${item.approved && item.status !== 'saved' ? 'ring-2 ring-green-500' : ''} ${item.status === 'saved' ? 'opacity-70' : ''}`}>
              <div className="relative bg-gray-100 aspect-[4/3]">
                {item.thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={item.thumb} alt={item.name} className="w-full h-full object-contain" />
                  : <div className="w-full h-full grid place-items-center text-gray-400 text-sm">No preview</div>}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  <StatusPill status={item.status} />
                  {item.confidence !== null && item.status !== 'saved' && <span className="rounded-full bg-black/60 text-white text-[11px] px-2 py-0.5">AI {Math.round(item.confidence * 100)}%</span>}
                </div>
                {!locked && <button type="button" onClick={() => remove(item.key)} title="Remove" className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 text-gray-600 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="p-3 space-y-2 flex-1 flex flex-col">
                <p className="text-xs text-gray-500 truncate" title={item.name}>{item.name} · {item.width}×{item.height}</p>
                {item.error && <p className="text-xs text-red-700">{item.error}</p>}
                {item.ratioWarning && <p className="text-xs text-amber-700">{item.ratioWarning}</p>}
                {issues.length > 0 && <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {issues.join(' · ')}</p>}
                {item.status === 'saved' && (
                  <p className="text-xs text-green-700">Saved to the catalogue{item.savedId ? ` · ${item.savedId.slice(0, 8)}` : ''}</p>
                )}

                {busy && item.status !== 'saving' && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {item.status === 'queued' ? 'Waiting to analyse' : 'Analysing…'}</p>}

                {(item.status === 'ready' || item.status === 'saving' || item.status === 'saved') && (
                  <>
                    {item.subjects.map((s, idx) => {
                      const breedCoats = coats.filter((c) => c.breed_id === s.breedId);
                      const changed = s.suggestedBreed && s.breedId !== s.suggestedBreed.id;
                      return (
                        <div key={idx} className="rounded-lg bg-gray-50 p-2 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span>{item.subjects.length > 1 ? `Subject ${idx + 1}${s.isPrimary ? ' (main)' : ''}` : 'Subject'}</span>
                            {s.suggestedBreed && (
                              <span className={(s.suggestedBreed.confidence < LOW_CONFIDENCE && !changed) ? 'text-amber-700' : ''}>
                                AI: {s.suggestedBreed.name} {Math.round(s.suggestedBreed.confidence * 100)}%{changed ? ' (changed)' : ''}
                              </span>
                            )}
                          </div>
                          <select value={s.breedId || ''} disabled={locked} onChange={(e) => setBreed(item, idx, e.target.value)}
                            className={`h-9 w-full rounded-md border px-2 text-sm text-gray-900 ${!s.breedId ? 'border-amber-400' : ''}`}>
                            <option value="">Choose breed…</option>
                            <optgroup label="Dogs">{breedsByType.dog.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
                            <optgroup label="Cats">{breedsByType.cat.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
                          </select>
                          <select value={s.coatId || ''} disabled={locked || !s.breedId} onChange={(e) => setCoat(item, idx, e.target.value)}
                            className="h-9 w-full rounded-md border px-2 text-sm text-gray-900 disabled:bg-gray-100">
                            <option value="">{breedCoats.length ? 'Coat (optional)…' : 'No coats set up for this breed'}</option>
                            {breedCoats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_common ? '' : ' (uncommon)'}</option>)}
                          </select>
                        </div>
                      );
                    })}

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-gray-500">Format
                        <select value={item.formatId} disabled={locked} onChange={(e) => update(item.key, { formatId: e.target.value })}
                          className={`mt-0.5 h-9 w-full rounded-md border px-2 text-sm text-gray-900 ${!item.formatId ? 'border-amber-400' : ''}`}>
                          <option value="">Choose…</option>
                          {formats.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.aspect_ratio})</option>)}
                        </select>
                      </label>
                      <label className="text-[11px] text-gray-500">Theme
                        <select value={item.themeId} disabled={locked} onChange={(e) => update(item.key, { themeId: e.target.value })}
                          className="mt-0.5 h-9 w-full rounded-md border px-2 text-sm text-gray-900">
                          <option value="">None</option>
                          {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </label>
                    </div>

                    <button type="button" onClick={() => update(item.key, { expanded: !item.expanded })}
                      className="flex items-center gap-1 text-xs text-purple-700 hover:underline self-start">
                      {item.expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Description, tags and options
                    </button>
                    {!item.expanded && <p className="text-xs text-gray-600 line-clamp-3">{item.description}</p>}
                    {item.expanded && (
                      <div className="space-y-2">
                        <textarea value={item.description} disabled={locked} rows={5} onChange={(e) => update(item.key, { description: e.target.value })}
                          className="w-full rounded-md border px-2 py-1.5 text-sm text-gray-900" />
                        <TagEditor tags={item.tags} disabled={locked} onChange={(tags) => update(item.key, { tags })} />
                        <label className="block text-[11px] text-gray-500">Style
                          <select value={item.styleId} disabled={locked} onChange={(e) => update(item.key, { styleId: e.target.value })}
                            className="mt-0.5 h-9 w-full rounded-md border px-2 text-sm text-gray-900">
                            <option value="">None</option>
                            {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </label>
                        <div className="flex gap-4 text-sm text-gray-700">
                          <label className="flex items-center gap-1.5"><input type="checkbox" disabled={locked} checked={item.isPublic} onChange={(e) => update(item.key, { isPublic: e.target.checked })} /> Public</label>
                          <label className="flex items-center gap-1.5"><input type="checkbox" disabled={locked} checked={item.isFeatured} onChange={(e) => update(item.key, { isFeatured: e.target.checked })} /> Featured</label>
                        </div>
                      </div>
                    )}

                    {item.status === 'ready' && (
                      <div className="mt-auto pt-2">
                        <button type="button" disabled={!canApprove(item)} onClick={() => update(item.key, { approved: !item.approved })}
                          className={`w-full rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 ${item.approved ? 'bg-green-600 text-white' : 'border border-green-400 text-green-800 hover:bg-green-50'}`}>
                          {item.approved ? '✓ Approved' : 'Approve'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {items.length > 0 && visible.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Nothing here.</p>}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, [string, string]> = {
    queued: ['Queued', 'bg-gray-700'],
    analysing: ['Analysing', 'bg-blue-600'],
    ready: ['Ready to review', 'bg-purple-600'],
    saving: ['Saving', 'bg-blue-600'],
    saved: ['Saved', 'bg-green-600'],
    error: ['Failed', 'bg-red-600'],
  };
  const [label, cls] = map[status];
  return <span className={`rounded-full text-white text-[11px] px-2 py-0.5 ${cls}`}>{label}</span>;
}

function TagEditor({ tags, disabled, onChange }: { tags: string[]; disabled: boolean; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-800 text-xs px-2 py-0.5">
            {t}
            {!disabled && <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}><X className="w-3 h-3" /></button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add a tag and press Enter"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className="h-8 w-full rounded-md border px-2 text-xs text-gray-900" />
      )}
    </div>
  );
}
