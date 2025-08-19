// --- Model ---
const Model = {
  boardSize: 8,
  words: [],
  board: [],
  placedWords: [],
  selectedCells: [],
  colors: ["#e57373", "#64b5f6", "#81c784", "#ffd54f", "#ba68c8", "#ff8a65", "#4dd0e1", "#dce775"],
  foundWords: new Set(),
  async loadWords() {
    // Carrega palavras do arquivo allwords.txt
    const response = await fetch("allwords.txt");
    const text = await response.text();
    const all = text.split(/\r?\n/).filter(w => w.length >= 3 && w.length <= 8);
    // Sorteia até 5 palavras únicas
    const chosen = [];
    while (chosen.length < 5 && all.length > 0) {
      const idx = Math.floor(Math.random() * all.length);
      const word = all[idx].toUpperCase();
      if (!chosen.includes(word)) chosen.push(word);
      all.splice(idx, 1);
    }
    this.words = chosen;
  },
  initBoard() {
    this.board = Array.from({ length: this.boardSize }, () => Array(this.boardSize).fill(""));
    this.placedWords = [];
  },
  placeWords() {
    // Tenta inserir cada palavra de forma contígua (não necessariamente reta)
    this.words.forEach((word, wIdx) => {
      let placed = false;
      for (let tries = 0; tries < 100 && !placed; tries++) {
        // Escolhe ponto inicial
        const x = Math.floor(Math.random() * this.boardSize);
        const y = Math.floor(Math.random() * this.boardSize);
        // Gera caminho contíguo
        const path = [[x, y]];
        let cx = x, cy = y;
        for (let i = 1; i < word.length; i++) {
          const dirs = [
            [0, 1], [1, 0], [0, -1], [-1, 0], // ortogonais
            [1, 1], [1, -1], [-1, 1], [-1, -1] // diagonais
          ];
          const valid = dirs
            .map(([dx, dy]) => [cx + dx, cy + dy])
            .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < this.boardSize && ny < this.boardSize &&
              !path.some(([px, py]) => px === nx && py === ny) && this.board[ny][nx] === "");
          if (valid.length === 0) break;
          const [nx, ny] = valid[Math.floor(Math.random() * valid.length)];
          path.push([nx, ny]);
          cx = nx; cy = ny;
        }
        if (path.length === word.length) {
          path.forEach(([px, py], i) => {
            this.board[py][px] = word[i];
          });
          this.placedWords.push({ word, path, color: this.colors[wIdx % this.colors.length] });
          placed = true;
        }
      }
    });
    // Preenche células vazias com letras aleatórias
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let y = 0; y < this.boardSize; y++) {
      for (let x = 0; x < this.boardSize; x++) {
        if (!this.board[y][x]) {
          this.board[y][x] = alphabet[Math.floor(Math.random() * alphabet.length)];
        }
      }
    }
  },
  getWordByPath(path) {
    return path.map(([x, y]) => this.board[y][x]).join("");
  },
  getPlacedWordByPath(path) {
    return this.placedWords.find(w => JSON.stringify(w.path) === JSON.stringify(path));
  }
};

// --- View ---
const View = {
  renderBoard(board, selectedCells, highlights) {
    const boardDiv = document.getElementById("board");
    boardDiv.innerHTML = "";
    for (let y = 0; y < board.length; y++) {
      for (let x = 0; x < board[y].length; x++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.textContent = board[y][x];
        cell.dataset.x = x;
        cell.dataset.y = y;
        if (selectedCells.some(([sx, sy]) => sx === x && sy === y)) cell.classList.add("selected");
        const highlight = highlights.find(h => h.path.some(([hx, hy]) => hx === x && hy === y));
        if (highlight) {
          cell.classList.add("highlight");
          cell.style.background = highlight.color;
        }
        boardDiv.appendChild(cell);
      }
    }
  },
  renderWords(words, foundWords, placedWords) {
    const listDiv = document.getElementById("words-list");
    listDiv.innerHTML = "";
    placedWords.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = w.word;
      span.style.background = w.color;
      if (foundWords.has(w.word)) span.style.opacity = 0.5;
      listDiv.appendChild(span);
    });
  },
  showMessage(msg) {
    document.getElementById("message").textContent = msg;
  }
};

// --- Controller ---
const Controller = {
  async init() {
    await Model.loadWords();
    Model.initBoard();
    Model.placeWords();
    Model.selectedCells = [];
    this.updateView();
    this.attachEvents();
  },
  updateView() {
    View.renderBoard(Model.board, Model.selectedCells, Model.placedWords.filter(w => Model.foundWords.has(w.word)));
    View.renderWords(Model.words, Model.foundWords, Model.placedWords);
  },
  attachEvents() {
    document.getElementById("board").addEventListener("click", (e) => {
      if (!e.target.classList.contains("cell")) return;
      const x = +e.target.dataset.x;
      const y = +e.target.dataset.y;
      // Seleção contígua
      if (Model.selectedCells.length === 0 || Controller.isContiguous(x, y)) {
        if (!Model.selectedCells.some(([sx, sy]) => sx === x && sy === y)) {
          Model.selectedCells.push([x, y]);
        }
      }
      Controller.checkSelection();
      this.updateView();
    });
    document.getElementById("board").addEventListener("contextmenu", (e) => {
      e.preventDefault();
      Model.selectedCells = [];
      View.showMessage("");
      this.updateView();
    });
  },
  isContiguous(x, y) {
    const last = Model.selectedCells[Model.selectedCells.length - 1];
    if (!last) return true;
    const [lx, ly] = last;
    return Math.abs(lx - x) <= 1 && Math.abs(ly - y) <= 1;
  },
  checkSelection() {
    if (Model.selectedCells.length < 3) return;
    // Verifica se corresponde a alguma palavra
    for (const w of Model.placedWords) {
      if (Controller.pathsEqual(w.path, Model.selectedCells)) {
        Model.foundWords.add(w.word);
        View.showMessage(`Você encontrou: ${w.word}`);
        Model.selectedCells = [];
        if (Model.foundWords.size === Model.placedWords.length) {
          View.showMessage("Parabéns! Todas as palavras foram encontradas!");
        }
        return;
      }
    }
  },
  pathsEqual(path1, path2) {
    if (path1.length !== path2.length) return false;
    for (let i = 0; i < path1.length; i++) {
      if (path1[i][0] !== path2[i][0] || path1[i][1] !== path2[i][1]) return false;
    }
    return true;
  }
};

window.addEventListener("DOMContentLoaded", () => Controller.init());
