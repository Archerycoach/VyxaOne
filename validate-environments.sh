#!/bin/bash

echo "🔍 VALIDAÇÃO DE AMBIENTES - Imogest"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check current repository
echo "📍 1. REPOSITÓRIO GIT ATUAL"
echo "----------------------------"
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)
if [[ $CURRENT_REMOTE == *"Imogest-Testes"* ]]; then
    echo -e "${GREEN}✅ Repositório de TESTES detectado${NC}"
    echo "   URL: $CURRENT_REMOTE"
else
    echo -e "${YELLOW}⚠️  Repositório: $CURRENT_REMOTE${NC}"
    echo "   (Verifique se é o esperado)"
fi
echo ""

# Check database configuration
echo "🗄️  2. BASE DE DADOS CONFIGURADA"
echo "--------------------------------"
if [ -f .env.local ]; then
    DB_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d'=' -f2)
    if [[ $DB_URL == *"suckzuqzlemoyvyysfwg"* ]]; then
        echo -e "${GREEN}✅ Base de Dados de TESTES configurada${NC}"
        echo "   URL: $DB_URL"
    else
        echo -e "${RED}❌ Base de Dados: $DB_URL${NC}"
        echo "   (Não é a BD de testes esperada!)"
    fi
else
    echo -e "${RED}❌ Arquivo .env.local não encontrado${NC}"
fi
echo ""

# Check recent commits
echo "📝 3. ÚLTIMOS COMMITS"
echo "---------------------"
git log --oneline -3
echo ""

# Check if production remote exists
echo "🏭 4. VERIFICAÇÃO DO AMBIENTE DE PRODUÇÃO"
echo "------------------------------------------"
PROD_REMOTE=$(git remote get-url production 2>/dev/null)
if [ -z "$PROD_REMOTE" ]; then
    echo -e "${GREEN}✅ Nenhum remote 'production' configurado${NC}"
    echo "   (Ambientes estão isolados)"
else
    echo -e "${YELLOW}⚠️  Remote 'production' encontrado: $PROD_REMOTE${NC}"
    echo "   Verificando se produção foi alterada..."
    
    git fetch production 2>/dev/null
    PROD_COMMITS=$(git log production/main --oneline -3 2>/dev/null)
    if [[ $PROD_COMMITS == *"Testing environment"* ]] || [[ $PROD_COMMITS == *"ambiente de testes"* ]]; then
        echo -e "${RED}❌ ALERTA: Produção pode ter sido alterada!${NC}"
        echo "   Commits recentes na produção:"
        echo "$PROD_COMMITS"
    else
        echo -e "${GREEN}✅ Produção não foi alterada${NC}"
    fi
fi
echo ""

# Final summary
echo "📊 RESUMO DA VALIDAÇÃO"
echo "======================"
echo ""

VALIDATION_PASSED=true

if [[ $CURRENT_REMOTE == *"Imogest-Testes"* ]]; then
    echo -e "${GREEN}✅ Repositório correto (Testes)${NC}"
else
    echo -e "${YELLOW}⚠️  Repositório precisa de verificação${NC}"
    VALIDATION_PASSED=false
fi

if [[ $DB_URL == *"suckzuqzlemoyvyysfwg"* ]]; then
    echo -e "${GREEN}✅ Base de Dados correta (Testes)${NC}"
else
    echo -e "${RED}❌ Base de Dados incorreta${NC}"
    VALIDATION_PASSED=false
fi

if [ -z "$PROD_REMOTE" ]; then
    echo -e "${GREEN}✅ Ambientes isolados${NC}"
else
    if [[ $PROD_COMMITS != *"Testing environment"* ]] && [[ $PROD_COMMITS != *"ambiente de testes"* ]]; then
        echo -e "${GREEN}✅ Produção não foi afetada${NC}"
    else
        echo -e "${RED}❌ Produção pode ter sido afetada${NC}"
        VALIDATION_PASSED=false
    fi
fi

echo ""
if [ "$VALIDATION_PASSED" = true ]; then
    echo -e "${GREEN}🎉 VALIDAÇÃO COMPLETA - Tudo correto!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. Executar: ./push-to-github.sh"
    echo "2. Configurar BD no Supabase (dev-tools/production-schema.sql)"
    echo "3. Iniciar desenvolvimento: npm run dev"
else
    echo -e "${RED}⚠️  VALIDAÇÃO FALHOU - Verifique os problemas acima${NC}"
    echo ""
    echo "Consulte PUSH_AND_VALIDATE.md para instruções de correção"
fi
echo ""