// Lead Types
export type LeadType = "buyer" | "seller" | "both";
export type LeadTemperature = "cold" | "warm" | "hot";
// Aligned with DB enums
export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type LeadSource = string;

// User/Agent Types
export type UserRole = "admin" | "team_lead" | "consultant";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "user";
  team_id?: string;
  created_at: string;
  avatar_url?: string;
  phone?: string;
  subscription_status?: "active" | "canceled" | "expired" | null;
  trial_ends_at?: string | null;
  subscription_end_date?: string | null;
  // Legacy mappings for compatibility
  name?: string;
  photo?: string;
  active?: boolean;
  createdAt?: string;
}

export interface Team {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  color: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export type ContactAlertOpportunityType = "property" | "development" | "both";
export type ContactAlertNotificationChannel = "ia" | "agenda" | "both";
export type ContactAlertUrgency = "low" | "medium" | "high" | "urgent";
export type ContactOpportunityMatchStatus = "new" | "task_created" | "contacted" | "dismissed";

export interface ContactAlertRequest {
  id: string;
  user_id: string;
  contact_id?: string;
  lead_id?: string;
  name: string;
  opportunity_type: ContactAlertOpportunityType;
  preferred_cities: string[];
  preferred_districts: string[];
  property_types: string[];
  typologies: string[];
  min_price?: number | null;
  max_price?: number | null;
  min_bedrooms?: number | null;
  urgency: ContactAlertUrgency;
  notification_channel: ContactAlertNotificationChannel;
  is_active: boolean;
  notes?: string | null;
  auto_send_email?: boolean;
  send_cc?: boolean;
  email_subject?: string;
  email_body?: string;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactOpportunityMatch {
  id: string;
  user_id: string;
  request_id: string;
  contact_id?: string;
  lead_id?: string;
  property_id?: string | null;
  development_id?: string | null;
  opportunity_type: "property" | "development";
  match_score: number;
  match_reasons: string[];
  status: ContactOpportunityMatchStatus;
  notification_channel: ContactAlertNotificationChannel;
  task_id?: string | null;
  opportunity_title: string;
  opportunity_location?: string | null;
  opportunity_price_label?: string | null;
  request_name?: string | null;
  request_urgency?: ContactAlertUrgency | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  lead_type: LeadType; // Ensure this matches
  status: LeadStatus;
  probability?: number; // Added probability
  source?: string;
  notes?: string;
  budget?: number;
  location_preference?: string;
  contact_id?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  lastInteraction?: string; // Keep for UI/Storage compatibility
  is_development?: boolean;
  development_name?: string;
  has_property_to_sell?: boolean;
  buy_purpose?: string;
  purchase_timeline?: string | null;
  temperature?: LeadTemperature | null;
  follow_up_state?: "new" | "first_contact" | "in_conversation" | "qualified" | "no_reply" | "reengagement" | "archived" | "opt_out";
  archive_reason?: string | null;
  reactivation_attempts?: number;
  consent_token?: string | null;
  email_opt_out?: boolean;
  email_opted_out_at?: string | null;
  email_unsub_token?: string | null;
}

// Property Types
export type PropertyType = "apartment" | "house" | "commercial" | "land" | "penthouse";
export type PropertyStatus = "available" | "reserved" | "sold" | "rented";

export interface Property {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  property_type: "apartment" | "house" | "commercial" | "land" | "other" | "office" | "warehouse";
  status: "available" | "reserved" | "sold" | "rented" | "off_market";
  price: number;
  area: number;
  city: string;
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  features?: string[];
  images?: string[];
  created_at: string;
  updated_at: string;
  listed_at?: string | null;
  rental_price?: number;
  district?: string;
  postal_code?: string;
  lead_id?: string | null;
  contact_id?: string | null;
  typology?: string;
  energy_rating?: string;
}

export type DevelopmentStatus = "draft" | "published" | "under_construction" | "completed" | "sold_out";

export interface Development {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  status: DevelopmentStatus;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  postal_code?: string | null;
  developer_name?: string | null;
  price_from?: number | null;
  price_to?: number | null;
  typologies?: string[] | null;
  total_units?: number | null;
  available_units?: number | null;
  delivery_date?: string | null;
  published_at?: string | null;
  highlights?: string[] | null;
  images?: string[] | null;
  main_image_url?: string | null;
  reference_code?: string | null;
  created_at: string;
  updated_at: string;
}

// Interaction Types
export type InteractionType = "call" | "email" | "whatsapp" | "meeting" | "visit" | "note" | "task";

export interface Interaction {
  id: string;
  leadId: string;
  type: InteractionType;
  notes: string;
  outcome?: string;
  nextAction?: string;
  timestamp: string;
}

// Note type for lead notes
export interface Note {
  id: string;
  title: string;
  content: string;
  lead_id?: string | null;
  created_at: string;
  updated_at?: string;
  created_by: string;
}

// Task Types
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface Task {
  id: string;
  title: string;
  description: string;
  notes?: string;
  leadId?: string;
  relatedLeadId?: string; // Compatibilidade com frontend
  relatedLeadName?: string; // Nome da lead associada
  propertyId?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  assignedTo: string;
  completed: boolean;
  createdAt: string;
  googleEventId?: string;
  isSynced?: boolean;
}

export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

// Calendar Event Types
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees: string[];
  leadId?: string;
  leadName?: string; // Nome da lead associada
  propertyId?: string;
  contactId?: string; // Add contactId
  googleEventId?: string;
  googleSynced?: boolean;
  eventType?: string;
  createdAt: string;
  userId?: string;
}

// Pipeline Stage Types
export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

// App Settings
export interface AppSettings {
  logo?: string;
  companyName: string;
  enabledModules: {
    compare: boolean;
    market: boolean;
    documents: boolean;
  };
}

// Message Template Types
export interface MessageTemplate {
  id: string;
  name: string;
  type: "whatsapp" | "email" | "sms";
  subject?: string;
  content: string;
  tags: string[];
  createdAt: string;
}

// Dashboard Stats Types
export interface DashboardStats {
  totalLeads: number;
  activeLeads: number;
  convertedLeads: number;
  totalProperties: number;
  availableProperties: number;
  pendingTasks: number;
  upcomingEvents: number;
  revenueThisMonth: number;
}

// Notification Types
export type NotificationType = "lead_inactive" | "task_overdue" | "new_lead" | "lead_match" | "message" | "reminder";
export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  leadId?: string;
  propertyId?: string;
  taskId?: string;
  userId: string;
  read: boolean;
  createdAt: string;
}

// Lead Scoring Types
export interface LeadScore {
  leadId: string;
  score: number; // 0-100
  factors: {
    budgetMatch: number;
    engagementLevel: number;
    urgency: number;
    responseTime: number;
    timeInPipeline: number;
  };
  lastCalculated: string;
}

// Automation/Workflow Types
export type AutomationTrigger = "lead_inactive" | "stage_change" | "task_complete" | "new_lead" | "property_match";
export type AutomationAction = "send_email" | "send_whatsapp" | "create_task" | "assign_agent" | "notify";

export interface Automation {
  id: string;
  name: string;
  active: boolean;
  trigger: AutomationTrigger;
  triggerCondition: string; // e.g., "days_since_contact > 7"
  action: AutomationAction;
  actionConfig: Record<string, any>;
  createdAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  lead_id: string;
  user_id: string;
  status: "pending" | "completed" | "failed";
  executed_at: string;
  completed_at?: string;
  error_message?: string;
}

// Property Matching Types
export interface PropertyMatch {
  leadId: string;
  propertyId: string;
  matchScore: number; // 0-100
  matchReasons: string[];
  notificationSent: boolean;
  createdAt: string;
}

// Market Analysis Types
export interface MarketData {
  zone: string;
  averagePrice: number;
  averagePricePerSqm: number;
  averageDaysToSell: number;
  totalProperties: number;
  soldLastMonth: number;
  trend: "up" | "down" | "stable";
  lastUpdated: string;
}

// Commission & Goals Types
export interface Commission {
  id: string;
  agentId: string;
  leadId: string;
  propertyId: string;
  amount: number;
  percentage: number;
  status: "pending" | "paid";
  saleDate: string;
  paidDate?: string;
}

export interface Goal {
  id: string;
  agentId?: string;
  teamId?: string;
  type: "sales" | "revenue" | "leads" | "conversions";
  target: number;
  current: number;
  period: "monthly" | "quarterly" | "yearly";
  startDate: string;
  endDate: string;
}

// Document Library Types
export type DocumentCategory = "contract" | "checklist" | "guide" | "legal" | "template";

export interface Document {
  id: string;
  title: string;
  category: DocumentCategory;
  description: string;
  fileUrl: string;
  uploadedBy: string;
  createdAt: string;
}

// Chat/Messages Types
export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId?: string;
  teamId?: string;
  message: string;
  content: string;
  attachments?: string[];
  read: boolean;
  timestamp: string;
  createdAt: string;
}

// Client Portal Types
export interface ClientPortalAccess {
  id: string;
  leadId: string;
  email: string;
  accessCode: string;
  selectedProperties: string[];
  documentsShared: string[];
  active: boolean;
  createdAt: string;
  lastAccess?: string;
}

// Portal Integration Types
export type PortalName = "idealista" | "imovirtual" | "casa_sapo" | "custom";

export interface PortalIntegration {
  id: string;
  portal: PortalName;
  apiKey?: string;
  active: boolean;
  lastSync?: string;
  leadsImported: number;
  propertiesPublished: number;
}

// External Search Portals (Inbound/MLS API Integrations)
export interface ExternalPropertyPortal {
  id: string;
  user_id: string;
  provider_name: string;
  is_enabled: boolean;
  api_key?: string | null;
  api_secret?: string | null;
  base_url?: string | null;
  custom_settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ExternalProperty {
  id: string;             // ID in the external portal
  provider: string;       // e.g., 'casayes', 'idealista'
  title: string;
  description?: string;
  price: number;
  location: string;
  typology?: string;
  url: string;            // Direct link to the listing
  main_image?: string;
  features?: string[];
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
}

export interface WhatsAppSettings {
  id: string;
  user_id: string;
  phone_number_id?: string;
  business_account_id?: string;
  access_token?: string;
  verify_token?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}