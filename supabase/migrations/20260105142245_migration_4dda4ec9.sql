-- ============================================
-- REMOVER POLÍTICA PERMISSIVA QUE PERMITE TODOS VEREM TODAS AS LEADS
-- ============================================

DROP POLICY IF EXISTS "authenticated_users_select_all_leads" ON leads;

-- ============================================
-- VERIFICAR SE HÁ OUTRAS POLÍTICAS PERMISSIVAS
-- ============================================

-- Garantir que apenas existem as políticas corretas:
-- 1. Admins veem tudo ✓
-- 2. Team leads veem leads da sua equipa ✓
-- 3. Agentes veem apenas suas leads atribuídas ✓
-- 4. Criadores podem criar leads ✓