// Script temporário para criar utilizadores de autenticação
// Este script usa a Supabase Admin API para criar contas

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ Ficheiro .env.local não encontrado');
    process.exit(1);
  }

  const envFile = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });

  return envVars;
}

const env = loadEnvFile();

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Credenciais Supabase não encontradas no .env.local');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

console.log('✅ Credenciais carregadas do .env.local');
console.log('   URL:', supabaseUrl);

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUsers() {
  console.log('🚀 Iniciando criação de utilizadores...\n');

  const users = [
    {
      id: '5af5b3a9-1cac-4a29-9c97-7d462831330a',
      email: 'eduardotsantos@remax.pt',
      password: 'Vyxa2026!',
      fullName: 'Eduardo Telles Santos',
      role: 'admin'
    },
    {
      id: '7c525896-f1ed-4224-8bd8-b4f73a188e94',
      email: 'filipesanches@remax.pt',
      password: 'Vyxa2026!',
      fullName: 'Filipe Sanches',
      role: 'agent'
    },
    {
      id: '4dd8679b-dc61-4afd-bb1b-e90ac2f0fe8e',
      email: 'anafaia@remax.pt',
      password: 'Vyxa2026!',
      fullName: 'Ana Faia',
      role: 'agent'
    }
  ];

  for (const user of users) {
    console.log(`\n📝 Criando utilizador: ${user.email}`);
    
    try {
      // Verificar se utilizador já existe no Auth
      const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.log(`❌ Erro ao listar utilizadores: ${listError.message}`);
        continue;
      }

      const existingAuthUser = existingUsers.users?.find(u => u.email === user.email);

      if (existingAuthUser) {
        console.log(`ℹ️  ${user.email} já existe no Supabase Auth`);
        console.log(`   ID: ${existingAuthUser.id}`);
        
        // Atualizar password do utilizador existente
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingAuthUser.id,
          { 
            password: user.password,
            email_confirm: true
          }
        );

        if (updateError) {
          console.log(`❌ Erro ao atualizar password: ${updateError.message}`);
        } else {
          console.log(`✅ Password atualizada para ${user.email}`);
        }
        continue;
      }

      // Criar novo utilizador no Supabase Auth
      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName
        }
      });

      if (createError) {
        console.log(`❌ Erro ao criar ${user.email}: ${createError.message}`);
        continue;
      }

      if (!authUser.user) {
        console.log(`❌ Falha ao criar utilizador Auth para ${user.email}`);
        continue;
      }

      console.log(`✅ Utilizador criado: ${user.email}`);
      console.log(`   ID: ${authUser.user.id}`);
      console.log(`   Password temporária: ${user.password}`);

      // Atualizar perfil com role (usando o ID gerado pelo Auth)
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          id: authUser.user.id,
          email: user.email,
          full_name: user.fullName,
          role: user.role,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('email', user.email);

      if (profileError) {
        console.log(`⚠️  Aviso: Erro ao atualizar perfil: ${profileError.message}`);
      } else {
        console.log(`✅ Perfil atualizado com role: ${user.role}`);
      }

    } catch (error) {
      console.error(`❌ Erro inesperado para ${user.email}:`, error.message);
    }
  }

  console.log('\n\n🎉 Processo concluído!\n');
  console.log('=' .repeat(60));
  console.log('📋 CREDENCIAIS TEMPORÁRIAS:');
  console.log('=' .repeat(60));
  users.forEach(user => {
    console.log(`\n📧 Email: ${user.email}`);
    console.log(`🔑 Password: ${user.password}`);
    console.log(`👤 Nome: ${user.fullName}`);
    console.log(`🎭 Role: ${user.role}`);
  });
  console.log('\n' + '='.repeat(60));
  console.log('⚠️  IMPORTANTE: Altere estas passwords após o primeiro login!');
  console.log('=' .repeat(60) + '\n');
}

createUsers()
  .then(() => {
    console.log('✅ Script executado com sucesso');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });