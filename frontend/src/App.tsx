import "./App.css";

const features = [
  {
    title: "Pacientes",
    description:
      "Cadastro dos pacientes e controle dos terapeutas autorizados."
  },
  {
    title: "Programas terapêuticos",
    description:
      "Organização dos objetivos e acompanhamento do estado dos programas."
  },
  {
    title: "Sessões",
    description:
      "Registro dos objetivos trabalhados e consulta ao histórico de atendimentos."
  }
];

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="container header-content">
          <span className="brand">Jano ABA</span>
          <span className="environment-badge">Demonstração</span>
        </div>
      </header>

      <main className="container main-content">
        <section aria-labelledby="page-title">
          <p className="eyebrow">Acompanhamento terapêutico</p>

          <h1 id="page-title">
            Organização e cuidado em cada atendimento.
          </h1>

          <p className="page-description">
            Pacientes, programas e registros de sessões de terapia ABA
            em um só lugar.
          </p>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <h2>{feature.title}</h2>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <p className="demo-notice">
          Ambiente de demonstração. Utilize somente dados fictícios.
        </p>
      </main>
    </div>
  );
}

export default App;