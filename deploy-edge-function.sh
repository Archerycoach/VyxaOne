#!/bin/bash

# 🚀 Script de Deploy Automático - Google Calendar Auto-Sync Edge Function
# Este script faz o deploy da Edge Function otimizada para o Supabase

echo "🚀 Iniciando deploy da Edge Function google-calendar-auto-sync..."
echo ""

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado!"
    echo ""
    echo "📦 Instale o Supabase CLI com um destes comandos:"
    echo ""
    echo "   npm install -g supabase"
    echo "   ou"
    echo "   brew install supabase/tap/supabase  (macOS)"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI encontrado"
echo ""

# Verificar se o projeto está linkado
if [ ! -f .supabase/config.toml ]; then
    echo "⚠️  Projeto não está linkado ao Supabase"
    echo ""
    echo "🔗 Vamos linkar agora..."
    echo ""
    
    # Login (se necessário)
    echo "1️⃣  Fazendo login no Supabase..."
    supabase login
    
    if [ $? -ne 0 ]; then
        echo "❌ Falha no login. Tente novamente."
        exit 1
    fi
    
    echo ""
    echo "2️⃣  Linkando projeto..."
    echo ""
    echo "📋 Você vai precisar do PROJECT_REF do seu projeto"
    echo "   Encontre em: https://supabase.com/dashboard/project/_/settings/general"
    echo "   (É o código na URL do projeto, ex: abcdefghijklmnop)"
    echo ""
    
    supabase link
    
    if [ $? -ne 0 ]; then
        echo "❌ Falha ao linkar projeto. Verifique o PROJECT_REF."
        exit 1
    fi
fi

echo "✅ Projeto linkado"
echo ""

# Fazer deploy da função
echo "3️⃣  Fazendo deploy da Edge Function..."
echo ""

supabase functions deploy google-calendar-auto-sync --no-verify-jwt

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Falha no deploy!"
    echo ""
    echo "💡 Possíveis soluções:"
    echo "   1. Verifique se está na pasta raiz do projeto"
    echo "   2. Verifique sua conexão com a internet"
    echo "   3. Tente fazer login novamente: supabase login"
    echo ""
    exit 1
fi

echo ""
echo "✅ Deploy concluído com sucesso!"
echo ""

# Configurar secrets (opcional mas recomendado)
echo "4️⃣  Configurando secrets..."
echo ""

# Ler variáveis do .env.local
if [ -f .env.local ]; then
    SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d '=' -f2)
    SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2)
    
    if [ ! -z "$SUPABASE_URL" ] && [ ! -z "$SERVICE_ROLE_KEY" ]; then
        echo "   Configurando SUPABASE_URL..."
        supabase secrets set SUPABASE_URL="$SUPABASE_URL" --project-ref $(supabase status | grep "Project ID:" | cut -d ':' -f2 | xargs)
        
        echo "   Configurando SUPABASE_SERVICE_ROLE_KEY..."
        supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" --project-ref $(supabase status | grep "Project ID:" | cut -d ':' -f2 | xargs)
        
        echo "   ✅ Secrets configurados"
    else
        echo "   ⚠️  Não foi possível ler secrets do .env.local"
        echo "   📝 Configure manualmente com:"
        echo ""
        echo "   supabase secrets set SUPABASE_URL=https://seu-projeto.supabase.co"
        echo "   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key"
    fi
else
    echo "   ⚠️  Arquivo .env.local não encontrado"
    echo "   📝 Configure os secrets manualmente:"
    echo ""
    echo "   supabase secrets set SUPABASE_URL=https://seu-projeto.supabase.co"
    echo "   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key"
fi

echo ""
echo "🎉 TUDO PRONTO!"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Verifique o Cron Job no Dashboard do Supabase:"
echo "   https://supabase.com/dashboard/project/_/database/cron"
echo ""
echo "2. O Cron Job 'google-calendar-hourly-sync' deve executar sem erros"
echo ""
echo "3. Para testar manualmente a função:"
echo "   curl -X POST 'https://seu-projeto.supabase.co/functions/v1/google-calendar-auto-sync' \\"
echo "        -H 'Authorization: Bearer SUA_ANON_KEY'"
echo ""
echo "✨ A sincronização automática está configurada para executar a cada hora!"
echo ""