# Sr. Dogão Pay — Checklist de ativação

- [x] Identificar tabela existente `public.srdogao_orders` e campo `public_token`.
- [x] Preparar migração isolada de pagamentos na branch de desenvolvimento.
- [ ] Revisar e aplicar migração no projeto Supabase correto.
- [ ] Configurar credenciais Asaas sandbox como secrets do backend.
- [ ] Implementar cobrança baseada exclusivamente no pedido validado no servidor.
- [ ] Implementar webhook com deduplicação persistente e atualização financeira atômica.
- [ ] Integrar checkout real sem alterar o carrinho ou o programa de pontos.
- [ ] Testar Pix, cartão, reenvio de webhook, cancelamento e estorno.
- [ ] Publicar após validação, com chave de ativação inicialmente desabilitada.

Não alterar a situação financeira de pedidos nem habilitar cobranças em produção antes dos testes.
