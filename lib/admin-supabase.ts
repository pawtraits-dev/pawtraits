import type {
  Media, MediaCreate, MediaUpdate,
  Product, ProductCreate, ProductUpdate,
  Format,
  MugColour,
  MugCatalogEntry, MugCatalogCreate, MugCatalogUpdate,
  MugGeneration,
  StockLocation, StockLocationCreate, StockLocationUpdate,
  ImageQrInfo, StickerImage, StickerSheetRequest, QrReport, AppSettingsMap,
  FulfilmentQueue, FulfilmentOrder, FulfilmentActionRequest,
  CatalogueProduct, CatalogueProductInput
} from './product-types';

/**
 * Result wrapper for admin methods whose callers must show the server's reason to the
 * user (validation errors, "code already exists", "run the migration"...). Existing
 * methods keep the null/[] convention; new stock/QR/settings methods use this.
 */
export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

async function adminRequest<T>(url: string, init?: RequestInit): Promise<AdminResult<T>> {
  try {
    const response = await fetch(url, { credentials: 'include', ...init });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: body?.error || `Request failed (${response.status})`, status: response.status };
    }
    return { ok: true, data: body as T };
  } catch (error) {
    console.error(`Admin request failed: ${url}`, error);
    return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Admin-specific Supabase service that uses API endpoints with service role
export class AdminSupabaseService {
  // ===== MEDIA METHODS =====
  async getMedia(activeOnly: boolean = false): Promise<Media[]> {
    try {
      const response = await fetch(`/api/admin/media?activeOnly=${activeOnly}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting media:', error);
      return [];
    }
  }

  async getMediaById(id: string): Promise<Media | null> {
    try {
      const response = await fetch(`/api/admin/media?id=${id}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('Error getting media by id:', error);
      return null;
    }
  }

  async createMedia(mediaData: MediaCreate): Promise<Media | null> {
    try {
      const response = await fetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaData)
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating media:', error);
      return null;
    }
  }

  async updateMedia(mediaData: MediaUpdate): Promise<Media | null> {
    try {
      const response = await fetch('/api/admin/media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaData)
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating media:', error);
      return null;
    }
  }

  async deleteMedia(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/admin/media?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error deleting media:', error);
      return false;
    }
  }

  // ===== PRODUCT METHODS =====
  async getProducts(filters?: {
    activeOnly?: boolean;
    featuredOnly?: boolean;
    mediumId?: string;
    formatId?: string;
  }): Promise<Product[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.activeOnly !== undefined) {
        params.set('activeOnly', filters.activeOnly.toString());
      }
      if (filters?.featuredOnly) {
        params.set('featuredOnly', 'true');
      }
      if (filters?.mediumId) {
        params.set('mediumId', filters.mediumId);
      }
      if (filters?.formatId) {
        params.set('formatId', filters.formatId);
      }

      const response = await fetch(`/api/admin/products?${params.toString()}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }

  async getProduct(id: string): Promise<Product | null> {
    try {
      const response = await fetch(`/api/admin/products?id=${id}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('Error getting product by id:', error);
      return null;
    }
  }

  async getProductByIdOrSku(idOrSku: string): Promise<Product | null> {
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(idOrSku)}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting product by id or sku:', error);
      return null;
    }
  }

  async createProduct(productData: ProductCreate): Promise<Product | null> {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating product:', error);
      return null;
    }
  }

  async updateProduct(id: string, productData: any): Promise<Product | null> {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...productData })
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating product:', error);
      return null;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/admin/products?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      return false;
    }
  }

  // ===== FORMAT METHODS =====
  async getFormats(): Promise<Format[]> {
    try {
      const response = await fetch('/api/admin/formats');
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting formats:', error);
      return [];
    }
  }

  async getFormatById(id: string): Promise<Format | null> {
    try {
      const response = await fetch(`/api/admin/formats?id=${id}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting format by id:', error);
      return null;
    }
  }

  // ===== PRICING METHODS =====
  async getAllProductPricing(): Promise<any[]> {
    try {
      const response = await fetch('/api/admin/pricing');
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting all product pricing:', error);
      return [];
    }
  }

  async getProductPricing(productId: string, countryCode?: string): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.set('productId', productId);
      if (countryCode) {
        params.set('countryCode', countryCode);
      }

      const response = await fetch(`/api/admin/pricing?${params.toString()}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting product pricing:', error);
      return [];
    }
  }

  async createProductPricing(pricingData: any): Promise<any> {
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricingData)
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating pricing:', error);
      return null;
    }
  }

  async updateProductPricing(id: string, updates: any): Promise<any> {
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating pricing:', error);
      return null;
    }
  }

  async deleteProductPricing(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/admin/pricing?id=${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error deleting pricing:', error);
      return false;
    }
  }

  // ===== COUNTRY METHODS =====
  async getCountries(supportedOnly: boolean = true): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (!supportedOnly) {
        params.set('supportedOnly', 'false');
      }

      const response = await fetch(`/api/admin/countries?${params.toString()}`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting countries:', error);
      return [];
    }
  }

  async updateCountry(countryCode: string, updates: any): Promise<any> {
    try {
      const response = await fetch(`/api/admin/countries/${countryCode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update country: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating country:', error);
      throw error;
    }
  }

  // ===== MESSAGE TEMPLATE METHODS =====
  async getTemplates(): Promise<any[]> {
    try {
      const response = await fetch('/api/admin/templates');
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting templates:', error);
      return [];
    }
  }

  async getTemplate(templateKey: string): Promise<any | null> {
    try {
      const response = await fetch(`/api/admin/templates?templateKey=${encodeURIComponent(templateKey)}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting template:', error);
      return null;
    }
  }

  async updateTemplate(id: string, updates: any): Promise<any | null> {
    try {
      const response = await fetch('/api/admin/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating template:', error);
      return null;
    }
  }

  // ===== MUG CATALOG METHODS =====

  async getMugCatalog(activeOnly: boolean = false): Promise<MugCatalogEntry[]> {
    try {
      const response = await fetch(`/api/admin/mugs/catalog?activeOnly=${activeOnly}`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Error getting mug catalog:', error);
      return [];
    }
  }

  async getMugCatalogEntry(id: string): Promise<MugCatalogEntry | null> {
    try {
      const response = await fetch(`/api/admin/mugs/catalog?id=${id}`);
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error('Error getting mug catalog entry:', error);
      return null;
    }
  }

  async createMugCatalogEntry(data: MugCatalogCreate): Promise<MugCatalogEntry | null> {
    try {
      const response = await fetch('/api/admin/mugs/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error creating mug catalog entry:', error);
      return null;
    }
  }

  async updateMugCatalogEntry(data: MugCatalogUpdate): Promise<MugCatalogEntry | null> {
    try {
      const response = await fetch('/api/admin/mugs/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error updating mug catalog entry:', error);
      return null;
    }
  }

  async deleteMugCatalogEntry(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/admin/mugs/catalog?id=${id}`, {
        method: 'DELETE'
      });
      return response.ok;
    } catch (error) {
      console.error('Error deleting mug catalog entry:', error);
      return false;
    }
  }

  // ===== MUG COLOURS METHODS =====

  async getMugColours(activeOnly: boolean = true): Promise<MugColour[]> {
    try {
      const response = await fetch(`/api/admin/mugs/colours?activeOnly=${activeOnly}`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Error getting mug colours:', error);
      return [];
    }
  }

  // ===== MUG GENERATIONS METHODS =====

  async getMugGenerations(filters?: {
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<MugGeneration[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.type) params.set('type', filters.type);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const response = await fetch(`/api/admin/mugs/generations?${params.toString()}`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Error getting mug generations:', error);
      return [];
    }
  }

  // ===== STOCK LOCATION METHODS (docs/specs/qr-stickers.md) =====

  async getStockLocations(activeOnly: boolean = false): Promise<AdminResult<StockLocation[]>> {
    return adminRequest<StockLocation[]>(`/api/admin/stock/locations${activeOnly ? '?activeOnly=true' : ''}`);
  }

  async createStockLocation(data: StockLocationCreate): Promise<AdminResult<StockLocation>> {
    return adminRequest<StockLocation>('/api/admin/stock/locations', jsonInit('POST', data));
  }

  async updateStockLocation(data: StockLocationUpdate): Promise<AdminResult<StockLocation>> {
    return adminRequest<StockLocation>('/api/admin/stock/locations', jsonInit('PATCH', data));
  }

  // ===== QUIZ METHODS (Admin → Quizzes; spec docs/specs/pawsonality-quiz.md) =====

  async getQuizzes(): Promise<AdminResult<any[]>> {
    return adminRequest<any[]>('/api/admin/quizzes');
  }

  async getQuiz(id: string): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${id}`);
  }

  async updateQuiz(id: string, data: { status?: 'live' | 'paused'; title?: string }): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${id}`, jsonInit('PATCH', data));
  }

  async publishQuiz(id: string): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${id}/publish`, { method: 'POST' });
  }

  async createQuizQuestion(quizId: string, data: Record<string, unknown>): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${quizId}/questions`, jsonInit('POST', data));
  }

  async updateQuizQuestion(quizId: string, questionId: string, data: Record<string, unknown>): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${quizId}/questions/${questionId}`, jsonInit('PATCH', data));
  }

  async deleteQuizQuestion(quizId: string, questionId: string): Promise<AdminResult<{ ok: true }>> {
    return adminRequest<{ ok: true }>(`/api/admin/quizzes/${quizId}/questions/${questionId}`, { method: 'DELETE' });
  }

  async uploadQuizQuestionImage(quizId: string, questionId: string, file: File): Promise<AdminResult<any>> {
    const form = new FormData();
    form.append('file', file);
    return adminRequest<any>(`/api/admin/quizzes/${quizId}/questions/${questionId}/image`, { method: 'POST', body: form });
  }

  async removeQuizQuestionImage(quizId: string, questionId: string): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${quizId}/questions/${questionId}/image`, { method: 'DELETE' });
  }

  async updateQuizResultType(quizId: string, code: string, data: Record<string, unknown>): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${quizId}/types/${code}`, jsonInit('PATCH', data));
  }

  async getQuizResults(quizId: string, days = 30): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${quizId}/results?days=${days}`);
  }

  async getQuizBreedImages(quizId: string, top = 20): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${quizId}/breed-images?top=${top}`);
  }

  async makeQuizBreedImage(quizId: string, code: string, breedId: string): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/quizzes/${quizId}/breed-images`, jsonInit('POST', { code, breedId }));
  }

  async getPawsonalityDesigns(animal: 'dog' | 'cat'): Promise<AdminResult<{ theme: string | null; designs: { id: string; description: string | null; breed: string | null }[] }>> {
    return adminRequest(`/api/admin/quizzes/designs?animal=${animal}`);
  }

  // ===== STICKER QR METHODS =====

  async getImageQrInfo(imageId: string, opts: { size?: string; locationCode?: string } = {}): Promise<AdminResult<ImageQrInfo>> {
    return adminRequest<ImageQrInfo>(this.getImageQrUrl(imageId, { ...opts, format: 'json' }));
  }

  /** URL of the QR image itself (for <img src> / download links — the browser fetches it with the admin cookie). */
  getImageQrUrl(imageId: string, opts: { format: 'svg' | 'png' | 'json'; size?: string; locationCode?: string; download?: boolean }): string {
    const params = new URLSearchParams({ format: opts.format });
    if (opts.size) params.set('size', opts.size);
    if (opts.locationCode) params.set('loc', opts.locationCode);
    if (opts.download) params.set('download', '1');
    return `/api/admin/qr/${encodeURIComponent(imageId)}?${params.toString()}`;
  }

  async findStickerImages(query: { refs?: number[]; ids?: string[] }): Promise<AdminResult<StickerImage[]>> {
    const params = new URLSearchParams();
    if (query.refs?.length) params.set('refs', query.refs.join(','));
    if (query.ids?.length) params.set('ids', query.ids.join(','));
    return adminRequest<StickerImage[]>(`/api/admin/stock/stickers?${params.toString()}`);
  }

  /** Builds the A4 sticker sheet PDF. Returns the file and its suggested name. */
  async generateStickerSheet(request: StickerSheetRequest): Promise<AdminResult<{ blob: Blob; filename: string }>> {
    try {
      const response = await fetch('/api/admin/stock/stickers', { credentials: 'include', ...jsonInit('POST', request) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return { ok: false, error: body?.error || `Failed to generate sticker sheet (${response.status})`, status: response.status };
      }
      const filename = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'stickers.pdf';
      return { ok: true, data: { blob: await response.blob(), filename } };
    } catch (error) {
      console.error('Error generating sticker sheet:', error);
      return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  async getQrReport(from: string, to: string): Promise<AdminResult<QrReport>> {
    return adminRequest<QrReport>(`/api/admin/stock/qr-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  // ===== APP SETTINGS METHODS (guest previews, stall pricing) =====

  async getAppSettings(): Promise<AdminResult<AppSettingsMap>> {
    return adminRequest<AppSettingsMap>('/api/admin/settings/app');
  }

  async updateAppSetting(key: string, value: unknown): Promise<AdminResult<{ ok: true }>> {
    return adminRequest<{ ok: true }>('/api/admin/settings/app', jsonInit('PATCH', { key, value }));
  }

  // ===== COLLECTIONS (Admin → Collections) =====

  async getCollections(): Promise<AdminResult<any>> {
    return adminRequest<any>('/api/admin/collections');
  }

  async createCollection(body: { parent_id: string; name: string; slug?: string; description?: string }): Promise<AdminResult<{ id: string; path: string }>> {
    return adminRequest<{ id: string; path: string }>('/api/admin/collections', jsonInit('POST', body));
  }

  async updateCollection(id: string, body: Record<string, unknown>): Promise<AdminResult<{ ok: true }>> {
    return adminRequest<{ ok: true }>(`/api/admin/collections/${id}`, jsonInit('PATCH', body));
  }

  async setThemeCollection(themeId: string, collectionId: string | null): Promise<AdminResult<{ ok: true; added: number }>> {
    return adminRequest<{ ok: true; added: number }>(`/api/admin/collections/themes/${themeId}`, jsonInit('PATCH', { collection_id: collectionId }));
  }

  async refileThemeCollections(): Promise<AdminResult<{ ok: true; added: number }>> {
    return adminRequest<{ ok: true; added: number }>('/api/admin/collections/themes/apply-all', jsonInit('POST', {}));
  }

  async getTaggingDesigns(params: { view?: string; collection?: string; q?: string; page?: number }): Promise<AdminResult<any>> {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return adminRequest<any>(`/api/admin/collections/designs?${qs}`);
  }

  async updateDesignTagging(id: string, body: { tags?: string[]; add?: string; remove?: string; retag?: boolean }): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/collections/designs/${id}`, jsonInit('PATCH', body));
  }

  async autoTagBatch(limit = 12, retryFailed = false): Promise<AdminResult<{ tagged: number; failed: number; remaining: number }>> {
    return adminRequest<{ tagged: number; failed: number; remaining: number }>('/api/admin/collections/auto-tag', jsonInit('POST', { limit, retry_failed: retryFailed }));
  }

  async getTeamVersionDesigns(q = '', page = 0): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/collections/team-versions?q=${encodeURIComponent(q)}&page=${page}`);
  }

  async getTeamVersions(id: string): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/collections/team-versions/${id}`);
  }

  async setTeamSwitch(id: string, teamSwitch: 'league' | 'any' | 'off'): Promise<AdminResult<{ ok: true }>> {
    return adminRequest<{ ok: true }>(`/api/admin/collections/team-versions/${id}`, jsonInit('PATCH', { team_switch: teamSwitch }));
  }

  async makeTeamVersion(id: string, team: string): Promise<AdminResult<{ status: string; imageId?: string; error?: string }>> {
    return adminRequest<{ status: string; imageId?: string; error?: string }>(`/api/admin/collections/team-versions/${id}`, jsonInit('POST', { team }));
  }

  // ===== SOCIAL LOOP (Admin → Social) =====

  async getSocial(view = 'all', limit = 50): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/social?view=${encodeURIComponent(view)}&limit=${limit}`);
  }

  async updateSocialItem(id: string, action: 'hide' | 'unhide' | 'approve' | 'recheck' | 'ig_exclude' | 'ig_include' | 'set_hero' | 'clear_hero'): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/social/items/${id}`, jsonInit('PATCH', { action }));
  }

  async updateStallTown(id: string, town: string): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/social/stalls/${id}`, jsonInit('PATCH', { town }));
  }

  async getSocialCarousels(): Promise<AdminResult<any>> {
    return adminRequest<any>('/api/admin/social/carousels');
  }

  async updateSocialCarousel(id: string, body: { caption?: string; action?: 'reset_caption' | 'mark_posted'; permalink?: string }): Promise<AdminResult<any>> {
    return adminRequest<any>(`/api/admin/social/carousels/${id}`, jsonInit('PATCH', body));
  }

  async importSocialPreviews(days = 30): Promise<AdminResult<{ added: number }>> {
    return adminRequest<{ added: number }>('/api/admin/social/import-previews', jsonInit('POST', { days }));
  }

  async retrySocialChecks(): Promise<AdminResult<{ retried: number }>> {
    return adminRequest<{ retried: number }>('/api/admin/social/retry-checks', jsonInit('POST', {}));
  }

  // ===== ORDER FULFILMENT =====

  /** Orders with prints to post, grouped by stage, plus the default provider. */
  async getFulfilmentQueue(): Promise<AdminResult<FulfilmentQueue>> {
    return adminRequest<FulfilmentQueue>('/api/admin/orders/fulfilment', { cache: 'no-store' });
  }

  /** Move an order through self-print, send it to Gelato, etc. Returns the updated order. */
  async updateOrderFulfilment(orderId: string, request: FulfilmentActionRequest): Promise<AdminResult<FulfilmentOrder>> {
    return adminRequest<FulfilmentOrder>(`/api/admin/orders/${encodeURIComponent(orderId)}/fulfilment`, jsonInit('POST', request));
  }

  /** URL of the packing slips PDF (the browser opens it with the admin cookie). */
  getPackingSlipsUrl(orderIds: string[]): string {
    return `/api/admin/orders/fulfilment/packing-slips?ids=${orderIds.map(encodeURIComponent).join(',')}`;
  }

  /** URL of the Royal Mail Click & Drop import CSV. */
  getClickAndDropCsvUrl(orderIds: string[]): string {
    return `/api/admin/orders/fulfilment/click-and-drop?ids=${orderIds.map(encodeURIComponent).join(',')}`;
  }

  // ===== PRODUCT CATALOGUE =====

  /** All products with their UK price, unit costs and margin. */
  async getCatalogueProducts(): Promise<AdminResult<CatalogueProduct[]>> {
    return adminRequest<CatalogueProduct[]>('/api/admin/catalogue/products', { cache: 'no-store' });
  }

  async getCatalogueProduct(id: string): Promise<AdminResult<CatalogueProduct>> {
    return adminRequest<CatalogueProduct>(`/api/admin/catalogue/products/${encodeURIComponent(id)}`, { cache: 'no-store' });
  }

  /** Create (no id) or update a product, including its UK price and costs. */
  async saveCatalogueProduct(input: CatalogueProductInput, id?: string): Promise<AdminResult<CatalogueProduct>> {
    return id
      ? adminRequest<CatalogueProduct>(`/api/admin/catalogue/products/${encodeURIComponent(id)}`, jsonInit('PUT', input))
      : adminRequest<CatalogueProduct>('/api/admin/catalogue/products', jsonInit('POST', input));
  }

  async setCatalogueProductActive(id: string, isActive: boolean): Promise<AdminResult<CatalogueProduct>> {
    return adminRequest<CatalogueProduct>(`/api/admin/catalogue/products/${encodeURIComponent(id)}`, jsonInit('PATCH', { is_active: isActive }));
  }

  /** Deletes the product, or just deactivates it if it has been ordered. */
  async deleteCatalogueProduct(id: string): Promise<AdminResult<{ deleted: boolean; deactivated: boolean }>> {
    return adminRequest<{ deleted: boolean; deactivated: boolean }>(`/api/admin/catalogue/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
