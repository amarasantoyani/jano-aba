# Requisitos — Jano ABA

## 1. Objetivo

Desenvolver uma aplicação para registrar dados de sessões de terapia
ABA, organizando pacientes, programas terapêuticos, objetivos,
terapeutas autorizados e resultados das sessões.

A solução deve preservar o histórico de atendimentos mesmo após
a revogação da autorização de um terapeuta.

## 2. Requisitos explícitos do desafio

### Pacientes

- Registrar nome, nome do tutor/responsável e idade.
- Permitir que um paciente possua vários programas terapêuticos.

### Programas terapêuticos

- Associar cada programa ao paciente correspondente.
- Permitir os estados:
  - NOT_STARTED — não iniciado;
  - IN_PROGRESS — em andamento;
  - COMPLETED — concluído.
- Associar objetivos a cada programa.

### Terapeutas e autorizações

- Permitir que um paciente seja atendido somente por terapeutas
  previamente autorizados para ele.
- Permitir a revogação dessa autorização.
- Preservar as sessões anteriores após a revogação.

### Sessões e coletas

- Registrar atendimentos realizados ao longo do tempo.
- Identificar o terapeuta responsável por cada sessão.
- Registrar, por objetivo trabalhado em cada sessão, se o paciente
  realizou ou não o objetivo.

### Entrega

Conforme a adaptação do desafio comunicada pelo Tech Lead:

- Implementar a solução.
- Entregar o código versionado em Git.
- Disponibilizar a aplicação em um ambiente publicado.
- Permitir infraestrutura simplificada para a demonstração.

O enunciado também pede explicar:

- A organização da aplicação e do banco.
- Como publicar mudanças no código e no banco com segurança.
- O que automatizar no processo de publicação.
- Os cuidados com dados sensíveis de saúde.

## 3. Suposições adotadas na primeira versão

As decisões abaixo não estão completamente definidas no enunciado.
Foram adotadas para delimitar a implementação.

### Escopo

- O sistema atende uma única clínica.
- Cada sessão pertence a um único paciente.
- Cada sessão é conduzida por um único terapeuta.
- Cada programa pertence a um único paciente.
- Cada objetivo pertence a um único programa.
- Uma sessão pode trabalhar objetivos de diferentes programas,
  desde que todos pertençam ao paciente atendido.

### Resultados

- Existe no máximo uma coleta por objetivo em cada sessão.
- Uma coleta com resultado true significa que o objetivo foi realizado.
- Uma coleta com resultado false significa que o objetivo foi
  trabalhado, mas não foi realizado.
- Ausência de coleta significa que o objetivo não foi trabalhado.
- Não serão registrados resultados individuais de várias tentativas
  nem níveis de ajuda nesta versão.

### Perfis e permissões

- Haverá dois perfis: ADMIN e THERAPIST.
- ADMIN gerencia pacientes, programas, objetivos e autorizações.
- Usuários de demonstração são provisionados pelo seed; ADMIN consulta
  os terapeutas disponíveis, sem cadastro de usuários pela interface.
- ADMIN pode consultar o histórico de todos os pacientes da clínica.
- THERAPIST pode consultar somente pacientes para os quais possui
  autorização ativa e registrar seus próprios atendimentos.
- O terapeuta responsável pelo registro será identificado pela
  autenticação, sem permitir que ele se passe por outro terapeuta.

### Autorizações

- A autorização precisa estar ativa no momento em que o atendimento
  é salvo.
- A revogação bloqueia consultas e novos registros do terapeuta
  referentes àquele paciente.
- O histórico permanece disponível para ADMIN.
- Uma nova autorização pode ser concedida após uma revogação.
- Concessões e revogações anteriores devem permanecer registradas.

### Registro do atendimento

- A sessão e suas coletas são salvas juntas, em uma única transação.
- Se qualquer coleta for inválida, nada do atendimento será salvo.
- Não haverá sessões em rascunho na primeira versão.
- A primeira versão não permitirá editar ou excluir atendimentos
  salvos. Um fluxo de correção com rastreabilidade será documentado
  como evolução.
- A demonstração utilizará somente dados fictícios.

## 4. Regras de integridade

- Uma coleta só pode referenciar um objetivo do paciente da sessão.
- Não pode existir mais de uma coleta para o mesmo objetivo
  na mesma sessão.
- Não pode existir mais de uma autorização ativa para o mesmo
  par de paciente e terapeuta.
- Revogar uma autorização não pode apagar sessões ou coletas.
- Registros referenciados pelo histórico não podem ser excluídos
  de forma que esse histórico seja perdido.
- As permissões devem ser verificadas no backend.
- A gravação de atendimentos e a revogação de autorizações devem
  ter comportamento consistente quando ocorrerem simultaneamente.

## 5. Fluxo principal de demonstração

1. ADMIN cadastra um paciente.
2. ADMIN cria programas e objetivos para esse paciente.
3. ADMIN autoriza um terapeuta a atendê-lo.
4. THERAPIST acessa o paciente.
5. THERAPIST registra uma sessão com os objetivos trabalhados
   e seus resultados.
6. ADMIN consulta o atendimento salvo.
7. ADMIN revoga a autorização do terapeuta.
8. THERAPIST deixa de conseguir acessar ou registrar atendimentos
   para esse paciente.
9. ADMIN continua consultando o histórico, incluindo a identificação
   do terapeuta responsável.

## 6. Critérios de aceite

- É possível cadastrar e consultar pacientes com os dados exigidos.
- É possível cadastrar vários programas para um paciente.
- É possível definir objetivos e alterar o estado de um programa.
- Um terapeuta autorizado consegue registrar um atendimento.
- Um terapeuta sem autorização não consegue acessar o paciente
  nem registrar atendimentos, inclusive por chamadas diretas à API.
- Uma sessão aceita objetivos de diferentes programas do mesmo paciente.
- Um objetivo de outro paciente é rejeitado.
- Coletas duplicadas para o mesmo objetivo e sessão são rejeitadas.
- Resultado false é preservado e distinguido de ausência de coleta.
- Uma falha ao salvar qualquer coleta não deixa o atendimento
  parcialmente gravado.
- A revogação bloqueia o acesso do terapeuta e preserva o histórico.
- O projeto pode ser executado seguindo o README.
- A versão publicada permite demonstrar o fluxo principal.

## 7. Qualidade e segurança da entrega

- Autenticação e autorização verificadas no servidor.
- Validação dos dados recebidos pela API.
- Credenciais e secrets fora do código versionado.
- HTTPS no ambiente publicado.
- Mensagens de erro sem stack traces ou informações sensíveis.
- Logs sem senhas, tokens ou conteúdo clínico.
- Alterações no banco controladas por migrations versionadas.
- Testes das principais regras de negócio, permissões e integridade.
- Instruções de configuração, execução e testes no README.

Esses itens definem a base técnica da demonstração. Não representam,
por si só, uma declaração de prontidão para operar com dados reais
de saúde.

## 8. Fora do escopo da primeira versão

- Agendamento de consultas.
- Faturamento e pagamentos.
- Prontuário clínico completo.
- Acesso de pacientes ou responsáveis ao sistema.
- Atendimento de múltiplas clínicas.
- Integrações com sistemas externos.
- Relatórios clínicos sofisticados ou exportação em PDF.
- Coleta por tentativa e registro de níveis de ajuda.
- Edição de atendimentos com histórico de versões.
- Infraestrutura de alta disponibilidade.

## 9. Decisões de escopo adotadas

Estas decisões complementam o enunciado e são suposições da solução.

- A idade será calculada a partir de birthDate.
- Programas seguem NOT_STARTED → IN_PROGRESS → COMPLETED,
  sem reabertura.
- Um programa precisa ter pelo menos um objetivo para iniciar.
- Novas coletas exigem programa IN_PROGRESS no momento da gravação.
- Objetivos só podem ser criados antes do início do programa.
- A primeira versão não permite editar objetivos.
- Cada atendimento exige pelo menos uma coleta.
- A data do atendimento pode ser passada, mas não pode ser futura
  nem anterior à concessão da autorização utilizada.
- A autorização também precisa estar ativa no momento da gravação.
- A sessão referencia a autorização, da qual são obtidos
  paciente e terapeuta.
- Campos, limites e regras transacionais estão definidos em
  docs/data-model.md.
- Bloqueios transacionais coordenam registro de atendimento,
  revogação e mudanças de estado dos programas.
- Não haverá exclusão de cadastros ou edição de atendimentos
  na primeira versão.

## 10. Documentação complementar

- README.md: apresentação, execução, testes e acesso à demonstração.
- docs/data-model.md: entidades, campos, relacionamentos e diagrama ER.
- docs/architecture.md: arquitetura implementada e evolução possível.
- docs/decisions.md: decisões relevantes, alternativas e trade-offs.