---
title: Associação Meta a imóvel ou empreendimento
status: in_progress
priority: high
type: feature
tags: [meta, leads, properties, developments]
created_by: agent
created_at: 2026-06-19T13:26:58Z
position: 32
---
## Notes
O utilizador quer poder definir, ao nível do formulário Meta, uma associação automática a um imóvel ou a um empreendimento. Quando uma lead nova entrar vinda desse formulário, a lead deve ficar ligada ao registo configurado sem passos manuais adicionais. A associação a imóvel é aplicada através de `properties.lead_id`; para empreendimentos, a lead fica marcada com `is_development`, `development_name` e o identificador do empreendimento em `custom_fields`.

## Checklist
- [x] Confirmar no esquema da base de dados como são guardadas associações de leads a imóveis e empreendimentos
- [x] Identificar na gestão de formulários Meta onde adicionar a opção de associação por formulário
- [x] Implementar a gravação da associação escolhida na configuração do formulário Meta
- [x] Aplicar a associação automática no webhook quando a lead entra da Meta
- [ ] Validar que leads novas de formulários configurados ficam associadas corretamente

## Acceptance
Ao configurar um formulário Meta, existe uma opção para associar automaticamente leads desse formulário a um imóvel ou a um empreendimento.
Quando entra uma nova lead por esse formulário, a lead fica ligada ao registo configurado sem intervenção manual.