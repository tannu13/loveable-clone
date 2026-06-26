const features = ["Prompt-driven edits", "Live React preview", "File tools"];

export function App() {
  return (
    <main className="project-page">
      <section className="hero">
        <p className="kicker">Editable project folder</p>
        <h1>Students update this app with Gemini tool calls.</h1>
        <p className="lede">
          This is the target React project. The main assignment app should inspect these files,
          ask Gemini what to change, write updates here, and show the running preview.
        </p>
        <div className="feature-row">
          {features.map((feature) => (
            <span key={feature}>{feature}</span>
          ))}
        </div>
      </section>
    </main>
  );
}
