# Decisões e alternativas

## Por que essa stack

TypeScript e React aproximam o projeto das tecnologias da equipe. Express
atende a uma API pequena sem exigir muita estrutura. PostgreSQL combina com
os relacionamentos e com a necessidade de salvar sessão e resultados juntos.

Prisma ajuda com os tipos, consultas e migrations. Não elimina SQL: o índice
parcial e os bloqueios precisam de recursos específicos do PostgreSQL. SQL
sem ORM também atenderia ao problema, com mais mapeamento manual dos dados.

As regras ficaram nas rotas. Extrair serviços faria sentido se as mesmas
operações fossem reutilizadas ou os módulos crescessem. Uma camada que apenas
repassasse chamadas do Prisma acrescentaria arquivos sem ajudar neste escopo.

## Identificação e idade

CPF não é necessário para registrar atendimentos, então não é coletado.
UUID funciona como identificador interno; um inteiro sequencial também
serviria e ocuparia menos espaço. Nenhum deles substitui controle de acesso
nem impede cadastrar a mesma pessoa duas vezes.

O enunciado pede idade. Guardar nascimento evita uma idade desatualizada depois
do aniversário, mas exige um dado mais específico. Essa escolha pressupõe que
a clínica conheça a data de nascimento; vale confirmar isso no uso real.

## O que significa uma autorização

Alternar um campo ativo na relação paciente-terapeuta seria mais curto, mas
perderia os períodos anteriores. Uma linha por concessão mantém quem autorizou,
quem revogou e quando. A sessão aponta para essa linha. Consultar o responsável
exige uma relação adicional, em troca de não duplicar paciente e terapeuta.

Uma nova concessão não reabre a autorização antiga. Também não permite lançar
um atendimento anterior à nova concessão. Se a clínica precisar desse fluxo,
a regra de lançamento retroativo precisa ser revista explicitamente.

## Corrigir cadastro sem apagar atendimento

Editar os dados básicos do paciente resolve erros de digitação. Excluir
cadastros ainda sem vínculos resolve registros criados por engano. Programas
sem coletas podem sair junto com seus objetivos; os que têm resultados ficam.

Não foi adotado soft delete em todas as tabelas: exigiria decidir o que esconder
em cada consulta. A exclusão física limitada por vínculos atende aos cadastros
sem histórico. Para pacientes que já têm atendimentos, arquivamento seria uma
extensão melhor que remover dados. Já a correção de uma coleta exige versões
e justificativa, não apenas um botão de editar.

## Sessão de login e sessão clínica são coisas diferentes

O login usa cookie HttpOnly e uma sessão no PostgreSQL. Isso permite invalidar
o login no logout e aproveita o banco que já existe. O custo é manter estado
no servidor e proteger as escritas contra CSRF. A API confere a origem das
requisições e utiliza cookie SameSite; em HTTPS, o cookie também é Secure.

## Onde simplificar o deploy

Um processo serve React e API no mesmo endereço. A publicação fica conjunta,
mas reduz a configuração e evita separar origens só para este exercício.
Render hospeda a aplicação e o banco. Docker é usado para o banco local.
A evolução para operação real está em [architecture.md](architecture.md).

## Dependências transitivas

O Prisma 7.10.0 trazia versões de mysql2 e deepmerge-ts com alertas. Os overrides
fixam mysql2 3.24.4 e deepmerge-ts 8.0.2. A última verificação anterior a estes
ajustes não reportou vulnerabilidades no npm audit; isso não é uma garantia
permanente. O npm 11.19.1 reconhece corretamente essas substituições.

Manter overrides tem custo de manutenção, especialmente porque deepmerge-ts
mudou de versão principal. Configuração, migrations, build e testes precisam
continuar passando. Ao atualizar o Prisma, é preciso conferir se os overrides
ainda são necessários e removê-los quando houver suporte nas dependências dele.
