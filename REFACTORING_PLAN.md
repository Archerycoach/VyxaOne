# 🏗️ Plano de Refatoração - Isolamento de Funcionalidades

## 📊 Análise Atual

### Problemas Identificados:
1. **Componentes Monolíticos** - Ficheiros com 500-1300 linhas
2. **Lógica de Negócio Misturada com UI** - Dificulta testes e manutenção
3. **Dependências Cruzadas** - Alterações afetam múltiplas funcionalidades
4. **Services Sobrecarregados** - Ficheiros com múltiplas responsabilidades

---

## 🎯 Objetivos da Refatoração

1. ✅ **Isolamento de Funcionalidades** - Cada módulo independente
2. ✅ **Reutilização de Código** - Componentes e hooks partilhados
3. ✅ **Testabilidade** - Unidades pequenas e testáveis
4. ✅ **Manutenibilidade** - Fácil localização e alteração de código
5. ✅ **Escalabilidade** - Preparado para novas funcionalidades

---

## 📁 Estrutura Proposta (Feature-Based)

```
src/
├── features/                    # NOVO - Módulos por funcionalidade
│   ├── leads/
│   │   ├── components/
│   │   │   ├── LeadsList/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── LeadItem.tsx
│   │   │   │   ├── LeadFilters.tsx
│   │   │   │   ├── LeadActions.tsx
│   │   │   │   └── styles.module.css
│   │   │   ├── LeadForm/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── BasicInfo.tsx
│   │   │   │   ├── ContactInfo.tsx
│   │   │   │   ├── PropertyPreferences.tsx
│   │   │   │   └── useLeadForm.ts
│   │   │   └── LeadCard/
│   │   ├── hooks/
│   │   │   ├── useLeads.ts
│   │   │   ├── useLeadFilters.ts
│   │   │   ├── useLeadMutations.ts
│   │   │   └── useLeadScore.ts
│   │   ├── services/
│   │   │   ├── leadsApi.ts
│   │   │   ├── leadValidation.ts
│   │   │   └── leadTransforms.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── utils/
│   │       └── leadHelpers.ts
│   │
│   ├── calendar/
│   │   ├── components/
│   │   │   ├── CalendarView/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── DayView.tsx
│   │   │   │   ├── WeekView.tsx
│   │   │   │   ├── MonthView.tsx
│   │   │   │   └── EventCard.tsx
│   │   │   ├── QuickEvent/
│   │   │   │   ├── QuickEventDialog.tsx
│   │   │   │   └── QuickEventForm.tsx
│   │   │   └── GoogleCalendarSync/
│   │   ├── hooks/
│   │   │   ├── useCalendarEvents.ts
│   │   │   ├── useEventMutations.ts
│   │   │   ├── useGoogleCalendar.ts
│   │   │   └── useCalendarFilters.ts
│   │   ├── services/
│   │   │   ├── calendarApi.ts
│   │   │   ├── googleCalendarApi.ts
│   │   │   └── eventValidation.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── contacts/
│   │   ├── components/
│   │   │   ├── ContactsList/
│   │   │   ├── ContactForm/
│   │   │   └── ContactCard/
│   │   ├── hooks/
│   │   │   ├── useContacts.ts
│   │   │   └── useContactMutations.ts
│   │   ├── services/
│   │   │   └── contactsApi.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── tasks/
│   │   ├── components/
│   │   │   ├── TasksList/
│   │   │   ├── TaskForm/
│   │   │   └── QuickTask/
│   │   ├── hooks/
│   │   │   ├── useTasks.ts
│   │   │   └── useTaskMutations.ts
│   │   ├── services/
│   │   │   └── tasksApi.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── properties/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── interactions/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── notifications/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── subscriptions/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   │
│   └── admin/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       └── types/
│
├── shared/                      # Componentes e utilitários partilhados
│   ├── components/
│   │   ├── ui/                  # Mantém shadcn/ui
│   │   ├── Layout/
│   │   ├── Navigation/
│   │   ├── ProtectedRoute/
│   │   └── SEO/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useDebounce.ts
│   │   ├── useOptimizedQuery.ts
│   │   └── use-mobile.tsx
│   ├── services/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   └── retry.ts
│   │   └── integrations/
│   │       ├── stripe.ts
│   │       ├── eupago.ts
│   │       └── gmail.ts
│   ├── utils/
│   │   ├── cache/
│   │   ├── error/
│   │   ├── validation/
│   │   └── formatting/
│   └── types/
│       └── global.ts
│
├── pages/                       # Mantém estrutura Next.js
│   ├── api/                     # API routes
│   ├── admin/
│   ├── leads.tsx
│   ├── calendar.tsx
│   ├── contacts.tsx
│   └── ...
│
└── contexts/                    # Contextos globais
    └── ThemeProvider.tsx
```

---

## 🔄 Estratégia de Migração (Fase por Fase)

### **Fase 1: Preparação (Não-Breaking)**
- [ ] Criar nova estrutura de pastas `features/`
- [ ] Criar estrutura de pastas `shared/`
- [ ] Documentar dependências atuais

### **Fase 2: Leads (Piloto)**
**Por que começar com Leads?**
- É a funcionalidade mais complexa (1300 linhas)
- Maior impacto na performance
- Mais dependências para identificar padrões

**Ações:**
1. Criar `features/leads/` com nova estrutura
2. Extrair hooks de `LeadsList.tsx`:
   - `useLeads.ts` - Fetching e cache
   - `useLeadFilters.ts` - Filtros e ordenação
   - `useLeadMutations.ts` - Create/Update/Delete
3. Dividir `LeadsList.tsx` em:
   - `LeadsList/index.tsx` (container - 100 linhas)
   - `LeadsList/LeadItem.tsx` (item individual - 80 linhas)
   - `LeadsList/LeadFilters.tsx` (filtros - 100 linhas)
   - `LeadsList/LeadActions.tsx` (ações batch - 80 linhas)
4. Dividir `LeadForm.tsx` em:
   - `LeadForm/index.tsx` (orquestração - 80 linhas)
   - `LeadForm/BasicInfo.tsx` (campos básicos - 100 linhas)
   - `LeadForm/ContactInfo.tsx` (contacto - 80 linhas)
   - `LeadForm/PropertyPreferences.tsx` (preferências - 100 linhas)
5. Refatorar `leadsService.ts`:
   - `leadsApi.ts` - Chamadas Supabase puras
   - `leadValidation.ts` - Validação de dados
   - `leadTransforms.ts` - Transformações de dados
6. Criar testes unitários para cada módulo
7. Atualizar `pages/leads.tsx` para usar nova estrutura
8. Verificar que tudo funciona
9. Eliminar ficheiros antigos

**Resultado Esperado:**
- ✅ LeadsList: 1300 linhas → 5 ficheiros de ~80-100 linhas
- ✅ LeadForm: 453 linhas → 4 ficheiros de ~80-100 linhas
- ✅ leadsService: 365 linhas → 3 ficheiros de ~120 linhas
- ✅ Código testável e isolado

### **Fase 3: Calendar**
1. Migrar `calendar.tsx` (1285 linhas)
2. Dividir em componentes:
   - CalendarView (container)
   - DayView, WeekView, MonthView
   - EventCard, QuickEvent
3. Extrair hooks:
   - useCalendarEvents
   - useEventMutations
   - useGoogleCalendar
4. Refatorar serviços

### **Fase 4: Contacts**
1. Migrar `contacts.tsx` (1076 linhas)
2. Seguir padrão estabelecido

### **Fase 5: Admin Pages**
1. Migrar páginas admin (1000+ linhas cada)
2. Criar componentes partilhados admin

### **Fase 6: Remaining Features**
1. Tasks
2. Properties
3. Interactions
4. Workflows
5. Etc.

### **Fase 7: Shared Modules**
1. Migrar componentes partilhados para `shared/`
2. Consolidar serviços comuns
3. Criar biblioteca de utilitários

---

## 🎨 Padrões de Design a Seguir

### **1. Container/Presenter Pattern**
```tsx
// Container (lógica)
export function LeadsListContainer() {
  const { leads, isLoading } = useLeads();
  const { filters, setFilters } = useLeadFilters();
  const { deleteLead } = useLeadMutations();
  
  return (
    <LeadsListPresenter 
      leads={leads}
      isLoading={isLoading}
      filters={filters}
      onFilterChange={setFilters}
      onDelete={deleteLead}
    />
  );
}

// Presenter (UI pura)
export function LeadsListPresenter({ leads, isLoading, filters, onFilterChange, onDelete }) {
  return (
    <div>
      <LeadFilters filters={filters} onChange={onFilterChange} />
      <LeadsList leads={leads} onDelete={onDelete} />
    </div>
  );
}
```

### **2. Custom Hooks Pattern**
```tsx
// useLeads.ts - Fetching e cache
export function useLeads(filters?: LeadFilters) {
  return useOptimizedQuery(['leads', filters], () => 
    leadsApi.fetchLeads(filters)
  );
}

// useLeadMutations.ts - Mutations isoladas
export function useLeadMutations() {
  const queryClient = useQueryClient();
  
  const createLead = useMutation({
    mutationFn: leadsApi.createLead,
    onSuccess: () => queryClient.invalidateQueries(['leads'])
  });
  
  return { createLead, updateLead, deleteLead };
}
```

### **3. Service Layer Pattern**
```tsx
// leadsApi.ts - Supabase calls puras
export const leadsApi = {
  fetchLeads: async (filters?: LeadFilters): Promise<Lead[]> => {
    const query = supabase.from('leads').select('*');
    if (filters?.status) query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  
  createLead: async (lead: CreateLeadInput): Promise<Lead> => {
    const { data, error } = await supabase
      .from('leads')
      .insert(lead)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// leadValidation.ts - Validação isolada
export const leadValidation = {
  validateEmail: (email: string): boolean => { ... },
  validatePhone: (phone: string): boolean => { ... },
  validateLead: (lead: Lead): ValidationResult => { ... }
};
```

### **4. Composition Over Inheritance**
```tsx
// Componentes pequenos e componíveis
<LeadsList>
  <LeadFilters />
  {leads.map(lead => (
    <LeadItem key={lead.id} lead={lead}>
      <LeadActions lead={lead} />
    </LeadItem>
  ))}
</LeadsList>
```

---

## 📏 Regras de Ouro

1. **Tamanho Máximo**: 200 linhas por ficheiro
2. **Single Responsibility**: Uma função, uma responsabilidade
3. **Testabilidade**: Tudo testável unitariamente
4. **Isolamento**: Zero side effects globais
5. **Type Safety**: TypeScript strict mode
6. **Performance**: Memoização e lazy loading
7. **Documentação**: JSDoc em funções públicas

---

## 🧪 Estratégia de Testes

```tsx
// __tests__/features/leads/hooks/useLeads.test.ts
describe('useLeads', () => {
  it('should fetch leads successfully', async () => {
    const { result } = renderHook(() => useLeads());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(10);
  });
});

// __tests__/features/leads/services/leadsApi.test.ts
describe('leadsApi', () => {
  it('should create lead', async () => {
    const lead = await leadsApi.createLead(mockLead);
    expect(lead.id).toBeDefined();
  });
});
```

---

## 📊 Métricas de Sucesso

### **Antes da Refatoração:**
- ❌ LeadsList: 1308 linhas
- ❌ Calendar: 1285 linhas
- ❌ Contacts: 1076 linhas
- ❌ 12+ ficheiros >500 linhas
- ❌ Lógica misturada com UI
- ❌ Difícil de testar
- ❌ Alterações afetam múltiplas áreas

### **Após Refatoração:**
- ✅ Ficheiros <200 linhas
- ✅ Funcionalidades isoladas
- ✅ 80%+ code coverage
- ✅ Componentes reutilizáveis
- ✅ Fácil onboarding
- ✅ Alterações localizadas
- ✅ Performance otimizada

---

## 🚀 Próximos Passos

1. **Decisão**: Aprovar plano de refatoração
2. **Piloto**: Começar com Leads (Fase 2)
3. **Validação**: Testar abordagem
4. **Escala**: Aplicar a todas funcionalidades
5. **Documentação**: Criar guias de contribuição

---

## ⚠️ Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Quebrar funcionalidades existentes | Médio | Alto | Testes automatizados + validação manual |
| Tempo elevado de implementação | Alto | Médio | Implementação faseada + priorização |
| Resistência à mudança | Baixo | Médio | Documentação clara + padrões consistentes |
| Regressões em produção | Baixo | Alto | Feature flags + rollback plan |

---

## 💡 Benefícios Esperados

### **Curto Prazo (1-2 semanas):**
- ✅ Código mais legível
- ✅ Bugs mais fáceis de identificar
- ✅ Onboarding mais rápido

### **Médio Prazo (1-2 meses):**
- ✅ Menos bugs em produção
- ✅ Features mais rápidas de implementar
- ✅ Melhor performance

### **Longo Prazo (3+ meses):**
- ✅ Codebase escalável
- ✅ Time mais produtivo
- ✅ Manutenção reduzida

---

**Decisão Final**: Aprovar implementação? (Sim/Não/Ajustar)