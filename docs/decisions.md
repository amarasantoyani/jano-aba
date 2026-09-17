# Decisões técnicas

As decisões abaixo orientam a implementação.
Mudanças relevantes devem atualizar este documento.

## 1. TypeScript no frontend e backend

- Contexto: prazo de três dias e equipe utiliza TypeScript e React.
- Decisão: React no frontend e Express no backend.
- Motivo: aproximar a entrega da stack da equipe com uma API pequena.
- Alternativa: backend em .NET.
- Trade-off: menor familiaridade com alguns componentes em troca
  de maior alinhamento com a vaga.

## 2. Aplicação única no deploy

- Contexto: demonstração com escopo e prazo limitados.
- Decisão: Node.js serve a API e o build React.
- Motivo: simplificar hospedagem e manter a mesma origem.
- Alternativa: publicar frontend e backend separadamente.
- Trade-off: publicação conjunta; separação futura continua possível.

## 3. PostgreSQL e Prisma

- Contexto: dados relacionados com exigências de integridade.
- Decisão: banco relacional com migrations versionadas.
- Motivo: utilizar FKs, unicidade, constraints e transações.
- Alternativa: consultas SQL sem ORM.
- Trade-off: Prisma reduz código repetitivo, mas recursos específicos
  exigem SQL, como índice parcial e bloqueios de linhas.

## 4. UUID como chave primária

- Contexto: entidades precisam de identificadores internos estáveis.
- Decisão: usar UUID e não coletar CPF.
- Motivo: evitar dependência de dados pessoais nos relacionamentos.
- Alternativa: inteiro sequencial.
- Trade-off: UUID ocupa mais espaço e não resolve duplicidade
  de pessoas nem substitui autorização.

## 5. Data de nascimento

- Contexto: o desafio exige idade.
- Decisão: guardar birthDate e calcular a idade.
- Motivo: evitar idade desatualizada.
- Alternativa: idade informada com data de referência.
- Trade-off: solicitar um dado mais específico que o enunciado.

## 6. Histórico de autorizações

- Contexto: permissões podem ser revogadas sem apagar atendimentos.
- Decisão: uma linha por período de autorização.
- Motivo: preservar concessão, revogação e seus responsáveis.
- Alternativa: alternar um campo ativo em uma única linha.
- Trade-off: mais registros e consultas considerando períodos.

## 7. Sessão vinculada à autorização

- Contexto: identificar paciente, terapeuta e permissão utilizada.
- Decisão: TherapySession referencia a autorização.
- Motivo: evitar repetir paciente e terapeuta na sessão.
- Alternativa: armazenar essas referências também na sessão.
- Trade-off: consultas exigem uma relação adicional, mas evitamos
  campos redundantes que poderiam divergir.

## 8. Resultados por objetivo e sessão

- Contexto: registrar se o paciente realizou cada objetivo trabalhado.
- Decisão: uma coleta booleana por objetivo e sessão.
- Motivo: atender ao enunciado sem adicionar coleta por tentativa.
- Alternativa: registrar várias tentativas e níveis de ajuda.
- Trade-off: menor detalhamento clínico.
- Ausência de coleta é diferente de resultado false.

## 9. Gravação atômica e concorrência

- Contexto: evitar atendimentos parciais e verificações invalidadas
  por operações simultâneas.
- Decisão: transação para sessão e coletas, com bloqueios nas
  autorizações e nos programas envolvidos.
- Motivo: coordenar gravação, revogação e conclusão de programas.
- Alternativa: isolamento serializável com tratamento de retries.
- Trade-off: operações sobre as mesmas linhas podem esperar;
  transações precisam ser curtas e seguir ordem consistente.

## 10. Preservação do significado histórico

- Contexto: alterar objetivos pode mudar a interpretação das coletas.
- Decisão: objetivos são criados antes de iniciar o programa e não podem ser editados nesta versão.
- Motivo: preservar seu significado sem implementar versionamento.
- Alternativa: versões de objetivos ou snapshots nas coletas.
- Trade-off: menor flexibilidade nesta primeira versão.

## 11. Atendimentos sem edição

- Contexto: correções clínicas exigem rastreabilidade.
- Decisão: não permitir editar ou excluir atendimentos nesta versão.
- Motivo: evitar sobrescrever resultados sem histórico.
- Alternativa: correções versionadas com autor, data e justificativa.
- Trade-off: registros incorretos não poderão ser corrigidos pela
  demonstração. Esse fluxo é necessário antes de uso operacional real.

## 12. Sessões de login no servidor

- Contexto: aplicação web publicada na mesma origem.
- Decisão: sessão persistida no PostgreSQL e cookie HttpOnly.
- Motivo: permitir expiração e invalidação no logout sem colocar
  tokens de autenticação no armazenamento acessível ao JavaScript.
- Alternativa: autenticação com tokens bearer.
- Trade-off: manutenção de estado no servidor e necessidade
  de proteção contra CSRF.