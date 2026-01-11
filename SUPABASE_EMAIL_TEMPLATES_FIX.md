# Guia: Corrigir Templates de Email do Supabase

## Problema
Os emails do Supabase (recuperação de password, confirmação de email) estão a redirecionar para o projeto antigo.

## Solução

### 1. Configurar Site URL e Redirect URLs

1. Vai ao **Supabase Dashboard**: https://supabase.com/dashboard
2. Seleciona o teu projeto: `hantkriglxwmddbpddnw`
3. Vai a **Authentication** → **URL Configuration**

**Configurações necessárias:**

```
Site URL: https://seu-dominio-vercel.vercel.app
```
(Substitui pelo teu URL real da Vercel)

**Redirect URLs (adiciona todos estes):**
```
https://seu-dominio-vercel.vercel.app/**
https://seu-dominio-vercel.vercel.app/auth/callback
http://localhost:3000/**
http://localhost:3000/auth/callback
https://3000-9d804bf8-0d80-4823-af0f-2c9bbddb5de7.softgen.dev/**
```

---

### 2. Atualizar Email Templates

Vai a **Authentication** → **Email Templates** e atualiza cada template:

---

#### 📧 **Confirm Signup** (Confirmação de Registo)

```html
<h2>Confirma o teu email</h2>

<p>Olá,</p>

<p>Obrigado por te registares! Clica no link abaixo para confirmar o teu endereço de email:</p>

<p><a href="{{ .ConfirmationURL }}">Confirmar Email</a></p>

<p>Ou copia e cola este URL no teu browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p>Se não criaste esta conta, podes ignorar este email.</p>

<p>Cumprimentos,<br>
Equipa Imogest</p>
```

---

#### 🔐 **Reset Password** (Recuperação de Password)

```html
<h2>Recuperação de Password</h2>

<p>Olá,</p>

<p>Recebemos um pedido para redefinir a password da tua conta.</p>

<p>Clica no link abaixo para criar uma nova password:</p>

<p><a href="{{ .ConfirmationURL }}">Redefinir Password</a></p>

<p>Ou copia e cola este URL no teu browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p><strong>Este link expira em 60 minutos.</strong></p>

<p>Se não pediste para redefinir a password, podes ignorar este email.</p>

<p>Cumprimentos,<br>
Equipa Imogest</p>
```

---

#### 🔗 **Magic Link** (Link Mágico)

```html
<h2>O teu link de acesso</h2>

<p>Olá,</p>

<p>Clica no link abaixo para iniciar sessão:</p>

<p><a href="{{ .ConfirmationURL }}">Iniciar Sessão</a></p>

<p>Ou copia e cola este URL no teu browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p><strong>Este link expira em 60 minutos.</strong></p>

<p>Se não pediste este link, podes ignorar este email.</p>

<p>Cumprimentos,<br>
Equipa Imogest</p>
```

---

#### ✉️ **Change Email** (Alterar Email)

```html
<h2>Confirma o teu novo email</h2>

<p>Olá,</p>

<p>Recebemos um pedido para alterar o email da tua conta.</p>

<p>Clica no link abaixo para confirmar o novo endereço de email:</p>

<p><a href="{{ .ConfirmationURL }}">Confirmar Novo Email</a></p>

<p>Ou copia e cola este URL no teu browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p>Se não pediste esta alteração, por favor contacta-nos imediatamente.</p>

<p>Cumprimentos,<br>
Equipa Imogest</p>
```

---

#### 📧 **Invite User** (Convidar Utilizador)

```html
<h2>Foste convidado para o Imogest</h2>

<p>Olá,</p>

<p>Foste convidado para te juntares à plataforma Imogest.</p>

<p>Clica no link abaixo para criar a tua conta:</p>

<p><a href="{{ .ConfirmationURL }}">Aceitar Convite</a></p>

<p>Ou copia e cola este URL no teu browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p><strong>Este convite expira em 24 horas.</strong></p>

<p>Cumprimentos,<br>
Equipa Imogest</p>
```

---

### 3. Atualizar Variáveis de Ambiente

**No Vercel:**
1. Vai a **Settings** → **Environment Variables**
2. Atualiza/adiciona:

```bash
NEXT_PUBLIC_SITE_URL=https://seu-dominio-vercel.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://hantkriglxwmddbpddnw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=(a tua chave anon)
```

**No ficheiro `.env.local` (para desenvolvimento):**
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

### 4. Testar

1. **Testa a recuperação de password**:
   - Vai ao login
   - Clica em "Esqueci-me da password"
   - Introduz o teu email
   - Verifica se o link no email aponta para o URL correto

2. **Testa o registo**:
   - Cria uma conta nova
   - Verifica se o email de confirmação tem o URL correto

---

### 5. URLs de Callback (Importante!)

Certifica-te que tens uma página de callback para processar os tokens:

**Ficheiro:** `src/pages/auth/callback.tsx`

Se não existir, será necessário criar.

---

## Notas Importantes

⚠️ **Site URL** deve ser EXATAMENTE o domínio onde a aplicação está deployed
⚠️ **Redirect URLs** devem incluir `/**` no final para permitir wildcards
⚠️ Depois de alterar no Supabase, faz **Redeploy** na Vercel
⚠️ Limpa o cache do browser antes de testar

---

## Checklist

- [ ] Site URL configurado corretamente
- [ ] Redirect URLs adicionados
- [ ] Todos os 5 templates de email atualizados
- [ ] Variáveis de ambiente atualizadas na Vercel
- [ ] Redeploy feito na Vercel
- [ ] Cache do browser limpo
- [ ] Testado recuperação de password
- [ ] Testado registo de novo utilizador

---

## Suporte

Se continuares a ter problemas:
1. Verifica os logs no Supabase Dashboard → Logs
2. Verifica se o URL está correto (sem espaços ou caracteres extra)
3. Tenta usar o domínio customizado se tiveres um
4. Certifica-te que o SMTP está configurado (se aplicável)