# Sr. Dogão Pay — integração Asaas

## Objetivo
Adicionar Pix e cartão ao checkout existente do Sr. Dogão, sem substituir o cardápio, carrinho ou programa de pontos.

## Fluxo
1. O checkout atual cria um pedido pendente no backend com itens, frete e total calculados no servidor.
2. O backend cria cobrança no Asaas com referência interna do pedido e chave de idempotência.
3. Pix: mostrar QR Code e código copia e cola retornados pelo Asaas. Cartão: usar checkout hospedado do Asaas; nunca coletar dados de cartão diretamente no frontend.
4. Um webhook autenticado recebe eventos de pagamento, verifica o pagamento no Asaas e atualiza o pedido de forma idempotente.
5. O painel do restaurante mostra aguardando pagamento, pago, expirado, cancelado e estornado.

## Segurança e implantação
- Credenciais ASAAS_API_KEY e token do webhook somente em variáveis secretas no backend.
- Nunca confiar em preços, totais ou status enviados pelo navegador.
- Salvar payment_id, order_id, event_id e trilha de auditoria, com unicidade para evitar duplicidade.
- Verificar que o pagamento pertence ao pedido, ao valor e à conta Asaas configurada.
- Criar primeiro em sandbox; não ativar cobrança real antes de testes completos.
- Confirmar titularidade da conta Asaas recebedora e regras fiscais antes de produção.
- Não alterar o arquivo index.html nem o deploy da branch main até identificar o checkout atual efetivamente publicado.

## Próximos passos técnicos
- Localizar código vigente do checkout e esquema de pedidos.
- Definir endpoint POST /payments para Pix/cartão e webhook /payments/asaas.
- Definir migração das tabelas de pagamentos e eventos.
- Testar Pix, cartão, reenvio de webhook, divergência de valor e estorno.
