/**
 * Sistema Centralizado de Invalidação de Cache
 * 
 * Garante consistência em todas as operações CRUD
 * Elimina problemas de cache desatualizado
 * 
 * @author Softgen AI
 * @date 2026-01-02
 */

export enum CacheKey {
  LEADS = "leads_cache",
  PROPERTIES = "properties_cache",
  CONTACTS = "contacts_cache",
  TASKS = "tasks_cache",
  CALENDAR_EVENTS = "calendar_events_cache",
  NOTIFICATIONS = "notifications_cache",
  INTERACTIONS = "interactions_cache",
  DOCUMENTS = "documents_cache",
  TEMPLATES = "templates_cache",
  SUBSCRIPTIONS = "subscriptions_cache",
  PROFILE = "profile_cache",
}

/**
 * Gerenciador Central de Cache
 * 
 * Uso:
 * ```typescript
 * import { CacheManager, CacheKey } from '@/lib/cacheInvalidation';
 * 
 * // Invalidar cache específico
 * CacheManager.invalidate(CacheKey.LEADS);
 * 
 * // Invalidar múltiplos caches
 * CacheManager.invalidate([CacheKey.LEADS, CacheKey.TASKS]);
 * 
 * // Invalidar todos os caches relacionados com leads
 * CacheManager.invalidateLeadsRelated();
 * ```
 */
export class CacheManager {
  /**
   * Invalida um ou múltiplos caches específicos
   * 
   * @param key - CacheKey ou array de CacheKeys a invalidar
   */
  static invalidate(key: CacheKey | CacheKey[]): void {
    const keys = Array.isArray(key) ? key : [key];
    keys.forEach((k) => {
      try {
        if (typeof window === 'undefined') {
          return;
        }
        localStorage.removeItem(k);
        console.log(`🗑️ Cache invalidated: ${k}`);
      } catch (error) {
        console.warn(`⚠️ Failed to invalidate cache: ${k}`, error);
      }
    });
  }

  /**
   * Invalida todos os caches relacionados com leads
   * 
   * Útil após operações CRUD em leads:
   * - Create lead
   * - Update lead
   * - Delete lead
   * - Assign lead
   * - Change lead status
   */
  static invalidateLeadsRelated(): void {
    this.invalidate([
      CacheKey.LEADS,
      CacheKey.TASKS,
      CacheKey.CALENDAR_EVENTS,
      CacheKey.NOTIFICATIONS,
      CacheKey.INTERACTIONS,
      CacheKey.DOCUMENTS,
    ]);
    console.log("🔄 Leads-related caches invalidated");
  }

  /**
   * Invalida todos os caches relacionados com propriedades
   * 
   * Útil após operações CRUD em properties:
   * - Create property
   * - Update property
   * - Delete property
   * - Change property status
   */
  static invalidatePropertiesRelated(): void {
    this.invalidate([
      CacheKey.PROPERTIES,
      CacheKey.TASKS,
      CacheKey.CALENDAR_EVENTS,
      CacheKey.INTERACTIONS,
      CacheKey.DOCUMENTS,
    ]);
    console.log("🔄 Properties-related caches invalidated");
  }

  /**
   * Invalida todos os caches relacionados com contactos
   * 
   * Útil após operações CRUD em contacts:
   * - Create contact
   * - Update contact
   * - Delete contact
   */
  static invalidateContactsRelated(): void {
    this.invalidate([
      CacheKey.CONTACTS,
      CacheKey.LEADS,
      CacheKey.INTERACTIONS,
    ]);
    console.log("🔄 Contacts-related caches invalidated");
  }

  /**
   * Invalida todos os caches relacionados com tarefas
   * 
   * Útil após operações CRUD em tasks:
   * - Create task
   * - Update task
   * - Complete task
   * - Delete task
   */
  static invalidateTasksRelated(): void {
    this.invalidate([
      CacheKey.TASKS,
      CacheKey.NOTIFICATIONS,
    ]);
    console.log("🔄 Tasks-related caches invalidated");
  }

  /**
   * Invalida cache de perfil do utilizador
   */
  static invalidateProfile(userId: string): void {
    this.invalidate(CacheKey.PROFILE);
    console.log(`👤 Profile cache invalidated for ${userId}`);
  }

  /**
   * Invalida todos os caches do sistema
   * 
   * ⚠️ USAR COM CUIDADO - Limpa TODOS os caches
   * 
   * Útil em cenários como:
   * - Logout
   * - Mudança de utilizador
   * - Reset do sistema
   * - Debugging
   */
  static invalidateAll(): void {
    Object.values(CacheKey).forEach((key) => {
      try {
        if (typeof window === 'undefined') {
          return;
        }
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`⚠️ Failed to invalidate cache: ${key}`, error);
      }
    });
    console.log("🗑️ All caches cleared");
  }

  /**
   * Obtém estatísticas de todos os caches
   * 
   * Útil para debugging e monitorização
   * 
   * @returns Objeto com estatísticas de cada cache
   */
  static getStats(): Record<CacheKey, { exists: boolean; size: number; age?: number }> {
    const stats = {} as Record<CacheKey, { exists: boolean; size: number; age?: number }>;

    Object.values(CacheKey).forEach((key) => {
      try {
        if (typeof window === 'undefined') {
          return;
        }
        const cached = localStorage.getItem(key);
        const cacheData = cached ? JSON.parse(cached) : null;

        stats[key as CacheKey] = {
          exists: !!cached,
          size: cached ? new Blob([cached]).size : 0,
          age: cacheData?.timestamp
            ? Date.now() - cacheData.timestamp
            : undefined,
        };
      } catch (error) {
        stats[key as CacheKey] = {
          exists: false,
          size: 0,
        };
      }
    });

    return stats;
  }

  /**
   * Verifica se um cache específico existe e é válido
   * 
   * @param key - CacheKey a verificar
   * @param maxAge - Idade máxima em milissegundos (opcional)
   * @returns true se o cache existe e é válido
   */
  static isValid(key: CacheKey, maxAge?: number): boolean {
    try {
      if (typeof window === 'undefined') {
        return false;
      }
      const cached = localStorage.getItem(key);
      if (!cached) return false;

      if (maxAge) {
        const cacheData = JSON.parse(cached);
        const age = Date.now() - (cacheData.timestamp || 0);
        return age < maxAge;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtém o tamanho total de todos os caches em bytes
   * 
   * @returns Tamanho total em bytes
   */
  static getTotalSize(): number {
    let totalSize = 0;

    Object.values(CacheKey).forEach((key) => {
      try {
        if (typeof window === 'undefined') {
          return;
        }
        const cached = localStorage.getItem(key);
        if (cached) {
          totalSize += new Blob([cached]).size;
        }
      } catch (error) {
        // Ignorar erros
      }
    });

    return totalSize;
  }
}

/**
 * Hook React para usar o CacheManager em componentes
 * 
 * Uso:
 * ```typescript
 * import { useCacheManager } from '@/lib/cacheInvalidation';
 * 
 * function MyComponent() {
 *   const { invalidateLeadsRelated, getStats } = useCacheManager();
 *   
 *   const handleUpdate = async () => {
 *     await updateLead(...);
 *     invalidateLeadsRelated(); // Invalidar caches relacionados
 *   };
 * }
 * ```
 */
export const useCacheManager = () => {
  const invalidate = (key: CacheKey | CacheKey[]) => {
    CacheManager.invalidate(key);
  };

  const invalidateLeadsRelated = () => {
    CacheManager.invalidateLeadsRelated();
  };

  const invalidatePropertiesRelated = () => {
    CacheManager.invalidatePropertiesRelated();
  };

  const invalidateContactsRelated = () => {
    CacheManager.invalidateContactsRelated();
  };

  const invalidateTasksRelated = () => {
    CacheManager.invalidateTasksRelated();
  };

  const invalidateAll = () => {
    CacheManager.invalidateAll();
  };

  const getStats = () => {
    return CacheManager.getStats();
  };

  const isValid = (key: CacheKey, maxAge?: number) => {
    return CacheManager.isValid(key, maxAge);
  };

  const getTotalSize = () => {
    return CacheManager.getTotalSize();
  };

  return {
    invalidate,
    invalidateLeadsRelated,
    invalidatePropertiesRelated,
    invalidateContactsRelated,
    invalidateTasksRelated,
    invalidateAll,
    getStats,
    isValid,
    getTotalSize,
  };
};

export function invalidateRelatedCaches(pattern: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error(`Error invalidating caches for pattern ${pattern}:`, error);
  }
}

// Constants
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedData<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    if (now - timestamp < CACHE_DURATION) {
      return data as T;
    }

    localStorage.removeItem(key);
    return null;
  } catch (error) {
    console.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
}

function setCachedData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
  }
}