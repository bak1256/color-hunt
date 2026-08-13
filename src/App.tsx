import PhaserGame from './game/PhaserGame';
import './App.css';

function App() {
  return (
    <main className="app">
      <header className="game-header">
        <div>
          <p className="eyebrow">2D camouflage shooter</p>
          <h1>CHAMELEON HUNT</h1>
        </div>

      </header>

      <PhaserGame />

      <footer className="game-footer">
        <span></span>
      </footer>
    </main>
  );
}

export default App;