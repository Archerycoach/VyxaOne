import { 
  Lead, 
  Property, 
  Task, 
  CalendarEvent, 
  Interaction, 
  Contact, 
  MessageTemplate, 
  PipelineStage, 
  Team,
  Notification,
  LeadScore,
  Automation,
  PropertyMatch,
  MarketData,
  Commission,
  Goal,
  Document as AppDocument,
  ChatMessage,
  ClientPortalAccess,
  PortalIntegration
} from "@/types";

export type UserRole = "admin" | "manager" | "agent";
export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

// User interface defined locally
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  teamId?: string; 
  status: "active" | "inactive";
  lastActive: string;
  performance: {
    leads: number;
    deals: number;
    pipelineValue: number;
  };
}

const STORAGE_KEYS = {
  LEADS: "crm_leads",
  PROPERTIES: "crm_properties",
  TASKS: "crm_tasks",
  EVENTS: "crm_events",
  INTERACTIONS: "crm_interactions",
  CONTACTS: "crm_contacts",
  TEMPLATES: "crm_templates",
  PIPELINE_STAGES: "crm_pipeline_stages",
  USERS: "crm_users",
  TEAMS: "crm_teams",
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Generic storage functions
export const getFromStorage = <T>(key: string): T[] => {
  if (typeof window === "undefined") return [];
  try {
    const item = localStorage.getItem(key);
    if (!item) return [];
    return JSON.parse(item);
  } catch (error) {
    console.error(`❌ Error reading from localStorage (key: ${key}):`, error);
    return [];
  }
};

export const saveToStorage = <T>(key: string, data: T[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
};

export const setItem = <T>(key: string, value: T, ttl?: number): void => {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const item = {
      value,
      expiresAt: ttl ? Date.now() + ttl : null,
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error(`Error setting item ${key}:`, error);
  }
};

export const getItem = <T>(key: string): T | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const parsed = JSON.parse(item);
    
    // Check if item has expired
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      removeItem(key);
      return null;
    }

    return parsed.value;
  } catch (error) {
    console.error(`Error getting item ${key}:`, error);
    return null;
  }
};

export const removeItem = (key: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing item ${key}:`, error);
  }
};

export const clear = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.clear();
  } catch (error) {
    console.error("Error clearing storage:", error);
  }
};

export const getAllKeys = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  
  try {
    return Object.keys(localStorage);
  } catch (error) {
    console.error("Error getting all keys:", error);
    return [];
  }
};

// Leads
export const getLeads = (): Lead[] => {
  const data = getFromStorage<Lead>(STORAGE_KEYS.LEADS);
  return data.map(lead => ({
    ...lead,
    status: lead.status === "negotiation" ? "negotiation" : lead.status, 
    lead_type: lead.lead_type || "buyer"
  } as Lead));
};

export const saveLeads = (leads: Lead[]): void => saveToStorage(STORAGE_KEYS.LEADS, leads);

export const addLead = (lead: Lead): void => {
  const leads = getLeads();
  saveLeads([...leads, lead]);
};

export const updateLead = (updatedLead: Lead): void => {
  const leads = getLeads();
  const index = leads.findIndex((l) => l.id === updatedLead.id);
  if (index !== -1) {
    leads[index] = updatedLead;
    saveLeads(leads);
  }
};

export const deleteLead = (id: string): void => {
  const leads = getLeads();
  saveLeads(leads.filter((l) => l.id !== id));
};

// Properties
export const getProperties = (): Property[] => getFromStorage<Property>(STORAGE_KEYS.PROPERTIES);
export const saveProperties = (properties: Property[]): void => saveToStorage(STORAGE_KEYS.PROPERTIES, properties);

export const addProperty = (property: Property): void => {
  const properties = getProperties();
  saveProperties([...properties, property]);
};

export const updateProperty = (updatedProperty: Property): void => {
  const properties = getProperties();
  const index = properties.findIndex((p) => p.id === updatedProperty.id);
  if (index !== -1) {
    properties[index] = updatedProperty;
    saveProperties(properties);
  }
};

export const deleteProperty = (id: string): void => {
  const properties = getProperties();
  saveProperties(properties.filter((p) => p.id !== id));
};

// Tasks
export const getTasks = (): Task[] => getFromStorage<Task>(STORAGE_KEYS.TASKS);
export const saveTasks = (tasks: Task[]): void => saveToStorage(STORAGE_KEYS.TASKS, tasks);

export const addTask = (task: Task): void => {
  const tasks = getTasks();
  saveTasks([...tasks, task]);
};

export const updateTask = (updatedTask: Task): void => {
  const tasks = getTasks();
  const index = tasks.findIndex((t) => t.id === updatedTask.id);
  if (index !== -1) {
    tasks[index] = updatedTask;
    saveTasks(tasks);
  }
};

export const deleteTask = (id: string): void => {
  const tasks = getTasks();
  saveTasks(tasks.filter((t) => t.id !== id));
};

// Events
export const getEvents = (): CalendarEvent[] => getFromStorage<CalendarEvent>(STORAGE_KEYS.EVENTS);
export const saveEvents = (events: CalendarEvent[]): void => saveToStorage(STORAGE_KEYS.EVENTS, events);

export const addEvent = (event: CalendarEvent): void => {
  const events = getEvents();
  saveEvents([...events, event]);
};

export const updateEvent = (updatedEvent: CalendarEvent): void => {
  const events = getEvents();
  const index = events.findIndex((e) => e.id === updatedEvent.id);
  if (index !== -1) {
    events[index] = updatedEvent;
    saveEvents(events);
  }
};

export const deleteEvent = (id: string): void => {
  const events = getEvents();
  saveEvents(events.filter((e) => e.id !== id));
};

// Interactions
export const getInteractions = (): Interaction[] => getFromStorage<Interaction>(STORAGE_KEYS.INTERACTIONS);
export const saveInteractions = (interactions: Interaction[]): void => saveToStorage(STORAGE_KEYS.INTERACTIONS, interactions);

export const addInteraction = (interaction: Interaction): void => {
  const interactions = getInteractions();
  saveInteractions([...interactions, interaction]);
};

// Cache utilities
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

// Initialize demo data
export const initializeDemoData = (): void => {
  if (getLeads().length === 0) {
    const demoLeads: Lead[] = [
      {
        id: "1",
        name: "João Silva",
        lead_type: "buyer",
        status: "qualified",
        email: "joao@email.com",
        phone: "+351 912 345 678",
        budget: 250000,
        location_preference: "Lisboa", 
        tags: ["urgente", "pré-aprovado"],
        source: "Website",
        notes: "Cliente interessado em zona de Lisboa. Contactar via WhatsApp.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: "demo-user",
        probability: 60,
        lastInteraction: "Hoje"
      },
      {
        id: "2",
        name: "Maria Santos",
        lead_type: "seller",
        status: "negotiation", 
        email: "maria@email.com",
        phone: "+351 913 456 789",
        tags: ["proprietária"],
        source: "Referência",
        notes: "Quer vender apartamento no Porto",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: "demo-user",
        probability: 80,
        lastInteraction: "Ontem"
      },
    ];
    saveLeads(demoLeads);
  }

  if (getProperties().length === 0) {
    const demoProperties: Property[] = [
      {
        id: "1",
        title: "Apartamento T3 Lisboa",
        property_type: "apartment",
        status: "available",
        price: 350000,
        address: "Av. da Liberdade",
        city: "Lisboa",
        bedrooms: 3,
        bathrooms: 2,
        area: 120,
        description: "Apartamento renovado no centro",
        images: [],
        features: ["Varanda", "Elevador"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: "demo-user",
      }
    ];
    saveProperties(demoProperties);
  }
};