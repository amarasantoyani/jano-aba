# O que esta entrega resolve

O ponto de partida foi a coleta de uma sessão: saber quem atendeu o paciente,
quais objetivos foram trabalhados e qual foi o resultado de cada um. A outra
regra central é que revogar o acesso do terapeuta não pode apagar o que ele
já registrou.

O enunciado original propõe uma conversa de modelagem e arquitetura. Nesta
entrega, o formato foi adaptado para código executável, repositório e deploy.

## Fluxo implementado

O administrador cadastra o paciente com nome, responsável e data de nascimento.
A idade é calculada na interface. Em seguida, cria os programas individuais,
adiciona os objetivos, inicia o programa e autoriza os terapeutas.

O terapeuta vê os pacientes para os quais tem autorização ativa. Ao registrar
um atendimento, escolhe os objetivos trabalhados e marca se foram realizados.
Uma sessão pode reunir objetivos de diferentes programas do mesmo paciente.
O histórico identifica o terapeuta e mantém cada resultado, inclusive false.

O administrador pode revogar uma autorização e conceder outra depois. As
sessões anteriores continuam disponíveis para ele. O terapeuta perde acesso
a novas consultas e gravações daquele paciente.

## Escolhas para fechar as ambiguidades

O enunciado não define quem administra as permissões. Foram adotados dois
perfis: ADMIN, que cuida dos cadastros e acessos, e THERAPIST, que registra
atendimentos. As contas iniciais vêm do seed; não há cadastro público.

Os estados seguem NOT_STARTED → IN_PROGRESS → COMPLETED. É preciso ter um
objetivo para iniciar. Somente programas em andamento recebem coletas. Essa
é uma regra da solução e precisaria ser confirmada com a clínica.

Um resultado false significa que o objetivo foi trabalhado e não realizado.
A ausência de registro significa que ele não foi trabalhado. Não há múltiplas
tentativas nem níveis de ajuda: isso exigiria uma coleta diferente da pedida.

A data de um atendimento pode ser passada, mas não futura nem anterior à
concessão utilizada. A autorização também precisa continuar ativa ao salvar.

## Correções de cadastro

O administrador pode editar nome, responsável e nascimento do paciente.
Pode excluir um paciente sem programas nem autorizações, inclusive revogadas.
Isso permite remover um cadastro feito por engano sem apagar vínculos antigos.

Um programa sem coletas pode ser excluído com seus objetivos. Um objetivo
isolado pode ser excluído antes do início do programa. Depois de haver coleta,
o programa e os objetivos usados são preservados. A API verifica essas regras,
mesmo quando a chamada não vem da interface.

Atendimentos salvos não são editados ou excluídos. Corrigir resultados clínicos
exigiria guardar a versão anterior, autor e motivo; isso ficou para evolução.

## Como conferir

O roteiro principal é cadastrar, autorizar, coletar, revogar e consultar o
histórico como administrador. Também é necessário tentar acessar sem permissão,
usar objetivo de outro paciente e repetir objetivo na mesma sessão: essas
operações devem falhar sem deixar atendimento parcialmente gravado.

As instruções de execução e testes estão no README. O projeto usa dados
fictícios e não inclui agenda, faturamento, múltiplas clínicas ou relatórios
clínicos avançados. Esses recursos não ajudam a responder ao problema central
deste desafio.
