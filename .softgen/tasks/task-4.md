---
title: OpenAPI / Swagger Specification
status: done
priority: high
type: feature
tags:
  - api
  - openapi
  - gpt
created_by: agent
---

## Notes
Generate the OpenAPI spec required by ChatGPT Custom Actions so the user can easily plug the API into their GPT.

## Checklist
- [ ] Create `public/openapi.yaml` or a dedicated route `GET /api/gpt/openapi.yaml` exposing the API schema.
- [ ] Document all 5 endpoints with proper descriptions, parameters, request bodies, and response schemas.
- [ ] Include Bearer Auth definition in the security scheme.