import PhaserGame from './game/PhaserGame';
import './App.css';

function App() {
  return (
    <main className="app">
      <header className="game-header">
        <div>
          <p className="eyebrow">2D camouflage shooter</p>
          <h1>COLOR HUNT</h1>
        </div>

        <div className="ammo">
          <span>AMMO</span>
          <strong>5 / 5</strong>
        </div>
      </header>

      <PhaserGame />

      <footer className="game-footer">
        <span>이동: WASD / 방향키</span>
        <span>사격: 다음 단계에서 추가</span>
      </footer>
    </main>
  );
}

export default App;