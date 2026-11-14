import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>Lista de tareas API</h1>
      <p>
        API de tareas con Firebase Auth y Firestore. El contrato está en{" "}
        <code>docs/03-lista-de-tareas.md</code>.
      </p>
    </main>
  );
}
